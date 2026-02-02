import { GameObjects, Scene } from 'phaser';

/**
 * EmoteCharacter - Nhân vật robot từ emotes spritesheet
 *
 * 3 trạng thái:
 * - idle: Robot bình thường (frame 0)
 * - correct: Robot vui mừng (frame 1)
 * - incorrect: Robot tức giận (frame 2)
 *
 * File: emotes/emo.png - chứa 3 nhân vật theo chiều ngang
 */
export class EmoteCharacter
{
    private scene: Scene;
    private container: GameObjects.Container;
    private characterImage: GameObjects.Image;
    private shadowSprite: GameObjects.Ellipse;

    // State
    private currentState: 'idle' | 'correct' | 'incorrect' = 'idle';
    private isFlipped: boolean = false;

    // Config
    private readonly spriteScale = 0.5;
    private readonly shadowAlpha = 0.3;

    constructor(scene: Scene, x: number, y: number)
    {
        this.scene = scene;

        // Create container
        this.container = scene.add.container(x, y);

        // Shadow (rendered first = behind)
        this.shadowSprite = scene.add.ellipse(0, 60, 120, 30, 0x000000, this.shadowAlpha);
        this.container.add(this.shadowSprite);

        // Character image - dùng 1 trong 3 file riêng biệt
        // Mặc định load idle
        this.characterImage = scene.add.image(0, 0, 'emote-happy');
        this.characterImage.setScale(this.spriteScale);
        this.container.add(this.characterImage);
    }

    /**
     * Get container for positioning
     */
    getContainer(): GameObjects.Container
    {
        return this.container;
    }

    /**
     * Get x position
     */
    get x(): number
    {
        return this.container.x;
    }

    /**
     * Get y position
     */
    get y(): number
    {
        return this.container.y;
    }

    /**
     * Set position
     */
    setPosition(x: number, y: number): void
    {
        this.container.setPosition(x, y);
    }

    /**
     * Set trạng thái nhân vật
     */
    setState(state: 'idle' | 'correct' | 'incorrect'): void
    {
        this.currentState = state;

        // Đổi texture theo state
        const textureMap = {
            'idle': 'emote-happy',
            'correct': 'emote-happy-tran',
            'incorrect': 'emote-fail'
        };
        this.characterImage.setTexture(textureMap[state]);
    }

    /**
     * Get current state
     */
    getState(): 'idle' | 'correct' | 'incorrect'
    {
        return this.currentState;
    }

    /**
     * Flip character direction
     */
    flip(faceRight: boolean): void
    {
        this.isFlipped = faceRight;
        this.characterImage.setFlipX(faceRight);
    }

    /**
     * Jump to a target position with animation
     */
    jumpTo(targetX: number, targetY: number, duration: number = 600): Promise<void>
    {
        return new Promise((resolve) => {
            // Determine direction
            const movingRight = targetX > this.container.x;
            if (movingRight !== this.isFlipped) {
                this.flip(movingRight);
            }

            // Hide shadow during jump
            this.scene.tweens.add({
                targets: this.shadowSprite,
                alpha: 0,
                scaleX: 0.5,
                scaleY: 0.5,
                duration: duration * 0.3
            });

            // Main jump movement
            this.scene.tweens.add({
                targets: this.container,
                x: targetX,
                y: targetY,
                duration: duration,
                ease: 'Power2',
                onComplete: () => {
                    resolve();
                }
            });

            // Scale effect (simulate height)
            this.scene.tweens.add({
                targets: this.characterImage,
                scale: this.spriteScale * 1.3,
                duration: duration * 0.5,
                yoyo: true,
                ease: 'Sine.easeOut'
            });

            // Shadow reappears at end
            this.scene.tweens.add({
                targets: this.shadowSprite,
                alpha: this.shadowAlpha,
                scaleX: 1,
                scaleY: 1,
                duration: duration * 0.3,
                delay: duration * 0.7
            });
        });
    }

    /**
     * Idle animation (subtle breathing effect)
     */
    playIdle(): void
    {
        this.scene.tweens.add({
            targets: this.characterImage,
            y: -10,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    /**
     * Stop idle animation
     */
    stopIdle(): void
    {
        this.scene.tweens.killTweensOf(this.characterImage);
        this.characterImage.y = 0;
    }

    /**
     * Show "correct" state temporarily then return to idle
     */
    showCorrect(duration: number = 1000): void
    {
        this.setState('correct');

        // Pop effect
        this.scene.tweens.add({
            targets: this.characterImage,
            scale: this.spriteScale * 1.2,
            duration: 200,
            yoyo: true
        });

        // Return to idle after delay
        this.scene.time.delayedCall(duration, () => {
            this.setState('idle');
        });
    }

    /**
     * Show "incorrect" state temporarily then return to idle
     */
    showIncorrect(duration: number = 1000): void
    {
        this.setState('incorrect');

        // Shake effect
        this.scene.tweens.add({
            targets: this.container,
            x: this.container.x + 5,
            duration: 50,
            yoyo: true,
            repeat: 5
        });

        // Return to idle after delay
        this.scene.time.delayedCall(duration, () => {
            this.setState('idle');
        });
    }

    /**
     * Check if currently jumping (based on active tweens)
     */
    isJumping(): boolean
    {
        return this.scene.tweens.getTweensOf(this.container).length > 0;
    }
}
