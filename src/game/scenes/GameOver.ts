import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { getGameConfig, resolveGameCode } from '../gameConfig';
import { endGameSession } from '../../services/api';

type GameOverData = {
    gameId?: string | null;
    score: number;
    bonus: number;
    result: 'win' | 'lose';
    reason: string;
};

export class GameOver extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    background: Phaser.GameObjects.Image;
    gameOverText : Phaser.GameObjects.Text;
    detailText: Phaser.GameObjects.Text;
    restartButton: Phaser.GameObjects.Container;
    dataPayload?: GameOverData;

    constructor ()
    {
        super('GameOver');
    }

    init (data: GameOverData)
    {
        this.dataPayload = data;
    }

    create ()
    {
        const { width, height } = this.scale;
        const gameCode = resolveGameCode(this.registry.get('gameCode') as string | undefined);
        const gameConfig = getGameConfig(gameCode);
        const { gameId, score, bonus, result, reason } = this.dataPayload || {
            gameId: null,
            score: 0,
            bonus: 0,
            result: 'lose',
            reason: ''
        };

        if (gameId) {
            endGameSession(gameId, score).catch((error) => {
                console.error('endGameSession failed', error);
            });
        }

        this.camera = this.cameras.main
        this.camera.setBackgroundColor(result === 'win' ? 0x16a34a : 0xdc2626);

        this.background = this.add.image(width / 2, height / 2, gameConfig.mapKey);
        this.background.setAlpha(0.5);

        this.gameOverText = this.add.text(width / 2, 220, result === 'win' ? 'Chiến Thắng!' : 'Hết Giờ', {
            fontFamily: 'Arial Black', fontSize: 64, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5).setDepth(100);

        const bonusText = bonus > 0 ? `(+${bonus} thưởng)` : '';
        this.detailText = this.add.text(width / 2, 340,
            `Điểm: ${score} ${bonusText}\n${reason}`,
            {
                fontFamily: 'Arial', fontSize: 26, color: '#e2e8f0',
                align: 'center'
            }
        ).setOrigin(0.5).setDepth(100);

        this.restartButton = this.createButton(width / 2, 520, 'Chơi lại');
        EventBus.emit('current-scene-ready', this);
    }

    createButton (x: number, y: number, label: string)
    {
        const button = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, 240, 56, 0x1f2937).setStrokeStyle(2, 0xfbbf24);
        const text = this.add.text(0, 0, label, {
            fontFamily: 'Arial Black', fontSize: 24, color: '#f8fafc'
        }).setOrigin(0.5);

        button.add([bg, text]);
        button.setSize(240, 56);
        button.setInteractive(new Phaser.Geom.Rectangle(-120, -28, 240, 56), Phaser.Geom.Rectangle.Contains);
        button.on('pointerover', () => bg.setFillStyle(0x334155));
        button.on('pointerout', () => bg.setFillStyle(0x1f2937));
        button.on('pointerdown', () => this.changeScene());

        return button;
    }

    changeScene ()
    {
        const gameCode = resolveGameCode(this.registry.get('gameCode') as string | undefined);
        this.scene.start('MainMenu', { gameCode });
    }
}
