import { Scene } from 'phaser';

/**
 * Preloader Scene - Stage 2: Load all game assets with visual progress
 *
 * Features:
 * - Visual progress bar with outline and fill
 * - Percentage text display
 * - Loading status text
 * - Error handling for failed loads
 * - Smooth transition to MainMenu
 */
export class Preloader extends Scene
{
    private progressBar!: Phaser.GameObjects.Rectangle;
    private progressText!: Phaser.GameObjects.Text;
    private statusText!: Phaser.GameObjects.Text;
    private loadErrors: string[] = [];
    private parallaxLayers: Phaser.GameObjects.TileSprite[] = [];

    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        const { width, height } = this.cameras.main;
        const centerX = width / 2;
        const centerY = height / 2;

        // Parallax background (loaded in Boot scene)
        this.createParallaxLoaderBackground();

        // Logo at top
        const logo = this.add.image(centerX, centerY - 120, 'logo');
        logo.setScale(0.8);

        // Loading text
        this.add.text(centerX, centerY - 40, 'Loading Game...', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);

        // Progress bar container (outline)
        const barWidth = 400;
        const barHeight = 24;
        const barX = centerX - barWidth / 2;
        const barY = centerY + 20;

        // Progress bar background (dark)
        this.add.rectangle(centerX, barY + barHeight / 2, barWidth + 4, barHeight + 4, 0x000000, 0.5);

        // Progress bar outline
        this.add.rectangle(centerX, barY + barHeight / 2, barWidth, barHeight).setStrokeStyle(2, 0xffffff);

        // Progress bar fill (starts at 0 width)
        this.progressBar = this.add.rectangle(
            barX + 2,
            barY + 2,
            0,
            barHeight - 4,
            0x00ff88
        );
        this.progressBar.setOrigin(0, 0);

        // Percentage text
        this.progressText = this.add.text(centerX, barY + barHeight / 2, '0%', {
            fontFamily: 'Arial',
            fontSize: '16px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        // Status text (shows current file being loaded)
        this.statusText = this.add.text(centerX, barY + barHeight + 20, '', {
            fontFamily: 'Arial',
            fontSize: '14px',
            color: '#cccccc'
        }).setOrigin(0.5);

        // Progress event - update bar width and percentage
        this.load.on('progress', (progress: number) => {
            this.progressBar.width = (barWidth - 4) * progress;
            this.progressText.setText(`${Math.round(progress * 100)}%`);
        });

        // File load event - show current file name
        this.load.on('load', (file: Phaser.Loader.File) => {
            this.statusText.setText(`Loading: ${file.key}`);
        });

        // Error handling - track failed loads
        this.load.on('loaderror', (file: Phaser.Loader.File) => {
            this.loadErrors.push(file.key);
            console.warn(`Failed to load: ${file.key}`);
            this.statusText.setText(`Error loading: ${file.key}`);
            this.statusText.setColor('#ff6666');
        });
    }

    update ()
    {
        if (!this.parallaxLayers.length) return;

        const time = this.time.now;
        this.parallaxLayers.forEach((layer) => {
            const speed = layer.getData('speed') as number;
            layer.tilePositionY = time * speed;
        });
    }

    preload ()
    {
        // Set base path for all assets
        this.load.setPath('assets');

        // ==================== UI ASSETS ====================
        this.load.image('star', 'ui/star.png');
        this.load.image('ui-example', 'ui/example.png');

        // ==================== GAMEPLAY ASSETS ====================
        this.load.image('bg-1', 'backgrounds/1.png');
        this.load.image('bg-2', 'backgrounds/2.png');
        this.load.image('bg-3', 'backgrounds/3.png');
        this.load.image('bg-4', 'backgrounds/4.png');
        this.load.image('bg-5', 'backgrounds/5.png');
        this.load.image('bg-6', 'backgrounds/6.png');
        this.load.image('bg-main', 'backgrounds/bg 2.png');

        // ==================== CHARACTER ASSETS ====================
        this.load.spritesheet('character', 'characters/character animation tran.png', {
            frameWidth: 515,
            frameHeight: 1128,
            margin: 15
        });
        this.load.image('char-jump', 'char-jump.png');
        this.load.image('char-emotes', 'char-emotes.png');

        // ==================== EMOTE ASSETS ====================
        // Load 3 trạng thái nhân vật robot từ spritesheet
        // File emo.png chứa 3 frame: Idle | Correct | Incorrect
        this.load.spritesheet('emote-robot', 'emotes/emo.png', {
            frameWidth: 512,
            frameHeight: 512
        });

        // Legacy emotes
        this.load.image('emote-happy', 'emotes/emo.png');
        this.load.image('emote-tran-idle', 'emotes/emo tran .png');
        this.load.image('emote-tran-idle-flipped', 'emotes/emo tran flipped idle.png');
        this.load.image('emote-tran-correct', 'emotes/emo tran correct.png');
        this.load.image('emote-tran-correct-flipped', 'emotes/emo tran flipped correct.png');
        this.load.image('emote-tran-incorrect', 'emotes/emo tran incorrect.png');
        this.load.image('emote-tran-incorrect-flipped', 'emotes/emo tran flipped incorrect.png');

        // ==================== TILE ASSETS ====================
        this.load.image('tile-1', 'tiles/1.png');
        this.load.image('tile-2', 'tiles/2.png');
        this.load.image('tile-3', 'tiles/3.png');
        this.load.image('tile-4', 'tiles/4.png');
        this.load.image('tile-5', 'tiles/5.png');
        this.load.image('tile-6', 'tiles/6.png');
        this.load.image('tile-flower', 'tiles/flower.png');
        this.load.image('tile-green', 'tiles/green.png');
        this.load.image('tile-shadow', 'tiles/shadoe.png');

        // ==================== MAP ASSETS ====================
        this.load.image('map-all', 'maps/All map.png');
    }

    private createParallaxLoaderBackground ()
    {
        const { width, height } = this.cameras.main;
        const layerKeys = ['bg-1', 'bg-2', 'bg-3', 'bg-4', 'bg-5', 'bg-6'];
        const speeds = [0.01, 0.02, 0.03, 0.04, 0.055, 0.07];

        this.parallaxLayers = layerKeys.map((key, index) => {
            const layer = this.add.tileSprite(0, 0, width, height, key)
                .setOrigin(0, 0)
                .setScrollFactor(0)
                .setDepth(-100 + index);
            layer.setData('speed', speeds[index]);
            return layer;
        });
    }

    create ()
    {
        // Log any loading errors
        if (this.loadErrors.length > 0) {
            console.warn('Assets failed to load:', this.loadErrors);
        }

        // Create global animations here if needed
        this.createGlobalAnimations();

        // Transition directly to Game scene (skip MainMenu during development)
        this.time.delayedCall(300, () => {
            this.cameras.main.fadeOut(200, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                this.scene.start('Game');
            });
        });
    }

    /**
     * Create animations that will be used across multiple scenes
     */
    private createGlobalAnimations(): void
    {
        // Robot character animations from emote-robot spritesheet
        // Frame 0: Idle, Frame 1: Correct, Frame 2: Incorrect

        this.anims.create({
            key: 'robot-idle',
            frames: [{ key: 'emote-robot', frame: 0 }],
            frameRate: 1,
            repeat: 0
        });

        this.anims.create({
            key: 'robot-correct',
            frames: [{ key: 'emote-robot', frame: 1 }],
            frameRate: 1,
            repeat: 0
        });

        this.anims.create({
            key: 'robot-incorrect',
            frames: [{ key: 'emote-robot', frame: 2 }],
            frameRate: 1,
            repeat: 0
        });

        this.anims.create({
            key: 'character-fly',
            frames: this.anims.generateFrameNumbers('character', { start: 0, end: 9 }),
            frameRate: 10,
            repeat: -1
        });

        this.anims.create({
            key: 'tran-jump',
            frames: this.anims.generateFrameNumbers('character', { start: 0, end: 4 }),
            frameRate: 6,
            repeat: -1
        });
    }
}
