import { GameObjects, Scene } from 'phaser';
import { EventBus } from '../EventBus';

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;
    description: GameObjects.Text;
    startButton: GameObjects.Container;

    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        const { width, height } = this.scale;

        this.background = this.add.image(width / 2, height / 2, 'background').setDisplaySize(width, height);

        this.logo = this.add.image(width / 2, 220, 'logo').setDepth(100).setScale(0.9);

        this.title = this.add.text(width / 2, 360, 'Đua Từ Vựng', {
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
            button.setScale(0.95);
            this.time.delayedCall(100, () => this.changeScene());
        });

        return button;
    }

    changeScene ()
    {
        this.scene.start('Game');
    }
}
