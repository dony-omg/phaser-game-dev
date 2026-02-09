import { GameObjects, Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { startGameSession } from '../../services/api';
import { getGameConfig, resolveGameCode } from '../gameConfig';

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;
    description: GameObjects.Text;
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

        this.startButton = this.createButton(width / 2, 590, 'Bắt đầu');

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

        const gameConfig = getGameConfig(this.gameCode);
        startGameSession(gameConfig.code)
            .then((res) => {
                const data = res.data;
                this.scene.start('Game', {
                    gameCode: this.gameCode,
                    gameId: data.game_id,
                    questions: data.game_session_questions,
                    timeLimit: data.game.time_limit
                });
            })
            .catch((err) => {
                console.error('startGameSession failed, fallback to local questions', err);
                this.scene.start('Game', {
                    gameCode: this.gameCode,
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
