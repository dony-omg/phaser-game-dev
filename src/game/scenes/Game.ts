import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { PlayerSprite } from '../objects/PlayerSprite';

export class Game extends Scene
{
    camera: Phaser.Cameras.Scene2D.Camera;
    leaves: Phaser.GameObjects.Image[];
    player!: PlayerSprite;
    parallaxLayers: Phaser.GameObjects.Image[];

    // UI
    jumpButton: Phaser.GameObjects.Container;
    scoreText: Phaser.GameObjects.Text;

    // Game State
    score: number = 0;
    currentLeafIndex: number = 0;

    
    constructor ()
    {
        super('Game');
    }

    create ()
    {
        const { width, height } = this.scale;
        this.camera = this.cameras.main;

        // Parallax background
        this.createParallaxBackground();

        // Track (Leaves) - Tile vertically
        // The asset is 1024x1024.
        this.leaves = [];
        for (let i = 0; i < 10; i++) {
            const track = this.add.image(width / 2, 1280 - (i * 1024), 'track-leaves');
            track.setScale(1); // It's 1024 wide, screen is 720. Scale 1 is fine, covers width.
            this.leaves.push(track);
        }

        // Player Setup - Using PlayerSprite (animated spritesheet)
        const startPos = this.getLeafPosition(0);
        this.player = new PlayerSprite(this, startPos.x, startPos.y);
        this.currentLeafIndex = 0;

        // Start idle animation
        this.player.playIdle();

        // Initial Camera Position
        this.camera.scrollY = startPos.y - 900;

        // UI
        this.createUI();

        EventBus.emit('current-scene-ready', this);
    }

    createParallaxBackground() {
        const { width, height } = this.scale;
        const layerKeys = ['bg-1', 'bg-2', 'bg-3', 'bg-4', 'bg-5', 'bg-6'];
        const scrollFactors = [0.03, 0.05, 0.08, 0.12, 0.16, 0.2];

        this.parallaxLayers = layerKeys.map((key, index) => {
            const layer = this.add.image(width / 2, height / 2, key)
                .setScrollFactor(0)
                .setDepth(-100 + index);

            const scaleX = width / layer.width;
            layer.setDisplaySize(width, layer.height * scaleX);
            layer.setData('baseY', height / 2);

            return layer;
        });

        this.parallaxLayers.forEach((layer, index) => {
            layer.setData('scrollFactor', scrollFactors[index]);
        });
    }

    update() {
        if (!this.parallaxLayers?.length) return;
        const scrollY = this.camera.scrollY;

        this.parallaxLayers.forEach((layer) => {
            const factor = layer.getData('scrollFactor') as number;
            const baseY = layer.getData('baseY') as number;
            layer.y = baseY + scrollY * factor;
        });
    }

    createUI() {
        const { width, height } = this.scale;
        
        // Fixed UI Container
        const uiContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(100);

        // Score
        this.scoreText = this.add.text(20, 40, 'Score: 0', {
            fontFamily: 'Arial Black', fontSize: '32px', color: '#f8fafc',
            stroke: '#000000', strokeThickness: 4
        });
        uiContainer.add(this.scoreText);

        // Jump Button
        this.jumpButton = this.createJumpButton(width / 2, height - 150);
        uiContainer.add(this.jumpButton);
    }

    createJumpButton(x: number, y: number) {
        const container = this.add.container(x, y);
        
        const bg = this.add.rectangle(0, 0, 300, 100, 0xfbbf24)
            .setStrokeStyle(4, 0xffffff)
            .setFillStyle(0x22c55e);
            
        const text = this.add.text(0, 0, 'NEXT JUMP!', {
            fontFamily: 'Arial Black', fontSize: '32px', color: '#ffffff'
        }).setOrigin(0.5);

        container.add([bg, text]);
        container.setSize(300, 100);
        container.setInteractive(new Phaser.Geom.Rectangle(-150, -50, 300, 100), Phaser.Geom.Rectangle.Contains);

        container.on('pointerdown', () => {
            bg.setFillStyle(0x16a34a);
            this.handleJump();
        });
        
        container.on('pointerup', () => {
            bg.setFillStyle(0x22c55e);
        });
        
        container.on('pointerout', () => {
            bg.setFillStyle(0x22c55e);
        });

        // Add simple pulse tween
        this.tweens.add({
            targets: container,
            scale: 1.05,
            duration: 800,
            yoyo: true,
            repeat: -1
        });

        return container;
    }

    async handleJump() {
        if (this.player.isJumping()) return;

        const nextIndex = this.currentLeafIndex + 1;
        const targetPos = this.getLeafPosition(nextIndex);

        // Visual feedback
        this.score += 10;
        this.scoreText.setText(`Score: ${this.score}`);
        this.player.showEmote('happy');

        // Stop idle animation during jump
        this.player.stopIdle();

        // Scroll Camera
        this.tweens.add({
            targets: this.camera,
            scrollY: targetPos.y - 800,
            duration: 600,
            ease: 'Power2'
        });

        // Perform jump using EmoteCharacter
        await this.player.jumpTo(targetPos.x, targetPos.y, 600);

        // Update state after jump completes
        this.currentLeafIndex = nextIndex;

        // Resume idle animation
        this.player.playIdle();
    }

    getLeafPosition(index: number) {
        const centerX = this.scale.width / 2;
        // The zig-zag in the generated image might not be perfect, 
        // but we'll approximate a zig-zag path.
        // Image is 1024x1024. 
        // Let's assume a roughly consistent pattern or just generic zig zag.
        
        const sideOffset = 150;
        const isLeft = index % 2 === 0;
        
        // Moving up
        const y = 950 - (index * 200); 
        const x = isLeft ? centerX - sideOffset : centerX + sideOffset;
        
        return { x, y };
    }

    /**
     * Show player state - correct or incorrect
     */
    showPlayerState(state: 'correct' | 'incorrect') {
        if (state === 'correct') {
            this.player.showEmote('happy');
        } else {
            this.player.showEmote('fail');
        }
    }
}
