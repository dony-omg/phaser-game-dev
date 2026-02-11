import { GameObjects, Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { fetchGameList, startGameSession } from '../../services/api';
import { getApiMode } from '../../services/apiMode';
import { getGameConfig, resolveGameCode } from '../gameConfig';

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;
    description: GameObjects.Text;
    debugText: GameObjects.Text;
    startButton: GameObjects.Container;
    isStarting: boolean = false;
    gameCode: string = 'vocab_race';

    constructor ()
    {
        super('MainMenu');
    }

    init (data: { gameCode?: string | null })
    {
        this.gameCode = resolveGameCode(data?.gameCode ?? (this.registry.get('gameCode') as string | undefined));
        this.registry.set('gameCode', this.gameCode);
    }

    create ()
    {
        const { width, height } = this.scale;
        const gameConfig = getGameConfig(this.gameCode);

        this.background = this.add.image(width / 2, height / 2, gameConfig.mapKey).setDisplaySize(width, height);

        this.logo = this.add.image(width / 2, 220, 'logo').setDepth(100).setScale(0.9);

        this.title = this.add.text(width / 2, 360, gameConfig.label, {
            fontFamily: 'Arial Black', fontSize: 46, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5).setDepth(100);

        this.description = this.add.text(width / 2, 460,
            'Nhấn nút NEXT để nhảy!\nĐạt điểm cao nhất có thể!',
            {
                fontFamily: 'Arial', fontSize: 28, color: '#e2e8f0',
                align: 'center',
                wordWrap: { width: 600 }
            }
        ).setOrigin(0.5).setDepth(100);

        const tokenSource = process.env.NEXT_PUBLIC_DEBUG_BEARER_TOKEN ? 'env_debug_token' : 'hardcoded_debug_token';
        this.debugText = this.add.text(width / 2, 660, `DEBUG: ready | token=static (${tokenSource})`, {
            fontFamily: 'Arial',
            fontSize: 16,
            color: '#f8fafc',
            align: 'center',
            wordWrap: { width: 640 }
        }).setOrigin(0.5).setDepth(120);

        this.startButton = this.createButton(width / 2, 590, 'Bắt đầu');

        if (gameConfig.code === 'vocab_race') {
            this.debugText.setText('DEBUG: preflight -> calling /game/list-game ...');
            fetchGameList({ forceReal: true })
                .then((res) => {
                    console.error('[GAME][PREFLIGHT] list-game success', {
                        count: res.data?.length ?? 0
                    });
                    this.debugText.setText(`DEBUG: preflight success | list=${res.data?.length ?? 0}`);
                })
                .catch((error) => {
                    const msg = error instanceof Error ? error.message : String(error);
                    console.error('[GAME][PREFLIGHT] list-game failed', { error: msg });
                    this.debugText.setText(`DEBUG: preflight failed | ${msg}`);
                });
        }

        EventBus.emit('current-scene-ready', this);
    }
    
    createButton (x: number, y: number, label: string)
    {
        const button = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, 300, 80, 0x1f2937).setStrokeStyle(3, 0x38bdf8);
        const text = this.add.text(0, 0, label, {
            fontFamily: 'Arial Black', fontSize: 32, color: '#f8fafc'
        }).setOrigin(0.5);

        button.add([bg, text]);
        
        // Ensure size is set 
        button.setSize(300, 80);

        // Make interactive with a clear hit area
        button.setInteractive(new Phaser.Geom.Rectangle(-150, -40, 300, 80), Phaser.Geom.Rectangle.Contains);
        
        button.on('pointerover', () => { 
            bg.setFillStyle(0x334155); 
            button.setScale(1.1);
            this.input.setDefaultCursor('pointer'); 
        });
        
        button.on('pointerout', () => { 
            bg.setFillStyle(0x1f2937); 
            button.setScale(1);
            this.input.setDefaultCursor('default'); 
        });
        
        button.on('pointerdown', () => {
            if (this.isStarting) return;
            button.setScale(0.95);
            this.time.delayedCall(100, () => this.changeScene());
        });

        return button;
    }

    changeScene ()
    {
        if (this.isStarting) return;
        this.isStarting = true;
        this.startButton.setAlpha(0.6);
        console.log('[GAME][SESSION] Start button clicked', { gameCode: this.gameCode });
        this.debugText.setText('DEBUG: start clicked -> calling startGameSession...');

        const gameConfig = getGameConfig(this.gameCode);
        const forceReal = gameConfig.code === 'vocab_race';
        startGameSession(gameConfig.code, { forceReal })
            .then((res) => {
                const data = res.data;
                console.log('[GAME][SESSION] startGameSession success', {
                    gameCode: this.gameCode,
                    apiMode: getApiMode(),
                    forceReal,
                    sessionId: data.id,
                    gameId: data.game_id,
                    questionCount: data.questions?.length ?? 0,
                    timeLimit: data.game?.time_limit ?? null
                });
                this.debugText.setText(`DEBUG: API success | questions=${data.questions?.length ?? 0}`);
                const nextScene = gameConfig.code === 'train_game' ? 'TrainGame' : 'Game';
                this.scene.start(nextScene, {
                    gameCode: this.gameCode,
                    sessionId: data.id,
                    gameId: data.game_id,
                    questions: data.questions,
                    timeLimit: data.game.time_limit
                });
            })
            .catch((err) => {
                console.error('[GAME][SESSION] startGameSession failed, fallback to local questions', {
                    gameCode: this.gameCode,
                    apiMode: getApiMode(),
                    forceReal,
                    error: err
                });
                const errorMessage = err instanceof Error ? err.message : String(err);
                this.debugText.setText(`DEBUG: API failed -> ${errorMessage}`);

                if (forceReal) {
                    this.description.setText('Không lấy được câu hỏi từ REAL API.\nKiểm tra token/API rồi thử lại.');
                    return;
                }

                const nextScene = gameConfig.code === 'train_game' ? 'TrainGame' : 'Game';
                this.scene.start(nextScene, {
                    gameCode: this.gameCode,
                    sessionId: null,
                    gameId: null,
                    questions: null,
                    timeLimit: null
                });
            })
            .finally(() => {
                this.isStarting = false;
                this.startButton.setAlpha(1);
            });
    }
}
