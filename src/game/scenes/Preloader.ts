import { Scene } from 'phaser';
import { getGameConfig } from '../gameConfig';

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
        const gameCode = this.registry.get('gameCode') as string | undefined;
        const gameConfig = getGameConfig(gameCode);
        const assetRoot = gameConfig.assetRoot;

        // Ensure assets resolve from site root even on /game/* routes
        this.load.setPath('/assets');

        if (gameConfig.code === 'train_game') {
            // ==================== TRAIN GAME ASSETS ====================
            this.load.image('star', '/assets/games/tower/ui/star.png');
            this.load.image('train-bg', `${assetRoot}/background copy 2.png`);
            this.load.image('train-engine', `${assetRoot}/train.png`);
            this.load.image('train-light', `${assetRoot}/light.png`);
            this.load.image('train-light-red', `${assetRoot}/Fox and Traffic light/Red.png`);
            this.load.image('train-light-yellow', `${assetRoot}/Fox and Traffic light/Yellow.png`);
            this.load.image('train-light-green', `${assetRoot}/Fox and Traffic light/Green.png`);
            this.load.image('train-fox-idle', `${assetRoot}/Fox and Traffic light/Idle.png`);
            this.load.image('train-fox-correct', `${assetRoot}/Fox and Traffic light/Correct.png`);
            this.load.image('train-fox-incorrect', `${assetRoot}/Fox and Traffic light/Incorrect.png`);
            this.load.image('train-barrier', `${assetRoot}/s.png`);

            for (let i = 1; i <= 11; i += 1) {
                this.load.image(`train-car-${i}`, `${assetRoot}/Train/${i}.png`);
            }

            this.load.image(gameConfig.mapKey, `${assetRoot}/${gameConfig.mapPath}`);
        } else {
            // ==================== UI ASSETS ====================
            this.load.image('star', `${assetRoot}/ui/star.png`);
            this.load.image('ui-example', `${assetRoot}/ui/example.png`);

            // ==================== GAMEPLAY ASSETS ====================
            this.load.image('bg-1', `${assetRoot}/backgrounds/1.png`);
            this.load.image('bg-2', `${assetRoot}/backgrounds/2.png`);
            this.load.image('bg-3', `${assetRoot}/backgrounds/3.png`);
            this.load.image('bg-4', `${assetRoot}/backgrounds/4.png`);
            this.load.image('bg-5', `${assetRoot}/backgrounds/5.png`);
            this.load.image('bg-6', `${assetRoot}/backgrounds/6.png`);
            this.load.image(gameConfig.mapKey, `${assetRoot}/${gameConfig.mapPath}`);

            // ==================== CHARACTER ASSETS ====================
            this.load.spritesheet('character', `${assetRoot}/characters/character animation tran.png`, {
                frameWidth: 515,
                frameHeight: 1128,
                margin: 15
            });
            // char-jump.png is not present in assets; skip loading to avoid load error
            this.load.image('char-emotes', `${assetRoot}/characters/char-emotes.png`);

            // ==================== EMOTE ASSETS ====================
            // Legacy emotes
            this.load.image('emote-tran-idle', `${assetRoot}/emotes/emo tran .png`);
            this.load.image('emote-tran-idle-flipped', `${assetRoot}/emotes/emo tran flipped idle.png`);
            this.load.image('emote-tran-correct', `${assetRoot}/emotes/emo tran correct.png`);
            this.load.image('emote-tran-correct-flipped', `${assetRoot}/emotes/emo tran flipped correct.png`);
            this.load.image('emote-tran-incorrect', `${assetRoot}/emotes/emo tran incorrect.png`);
            this.load.image('emote-tran-incorrect-flipped', `${assetRoot}/emotes/emo tran flipped incorrect.png`);

            // ==================== TILE ASSETS ====================
            this.load.image('tile-1', `${assetRoot}/tiles/1.png`);
            this.load.image('tile-2', `${assetRoot}/tiles/2.png`);
            this.load.image('tile-3', `${assetRoot}/tiles/3.png`);
            this.load.image('tile-4', `${assetRoot}/tiles/4.png`);
            this.load.image('tile-5', `${assetRoot}/tiles/5.png`);
            this.load.image('tile-6', `${assetRoot}/tiles/6.png`);
            this.load.image('tile-flower', `${assetRoot}/tiles/flower.png`);
            this.load.image('tile-green', `${assetRoot}/tiles/green.png`);
            this.load.image('tile-shadow', `${assetRoot}/tiles/shadoe.png`);

            // ==================== MAP ASSETS ====================
            this.load.image('map-all', `${assetRoot}/maps/All map.png`);
        }
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

        const gameCode = this.registry.get('gameCode') as string | undefined;

        // Create global animations here if needed
        if (getGameConfig(gameCode).code !== 'train_game') {
            this.createGlobalAnimations();
        }

        // Skip MainMenu and go straight into Game
        this.time.delayedCall(300, () => {
            this.cameras.main.fadeOut(200, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                if (getGameConfig(gameCode).code === 'train_game') {
                    this.scene.start('TrainGame', { gameCode });
                } else {
                    this.scene.start('Game', { gameCode });
                }
            });
        });
    }

    /**
     * Create animations that will be used across multiple scenes
     */
    private createGlobalAnimations(): void
    {
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
