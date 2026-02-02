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
    private characterSprite: GameObjects.Sprite;
    private shadowSprite: GameObjects.Ellipse;
    private stateResetTimer?: Phaser.Time.TimerEvent;

    // State
    private currentState: 'idle' | 'correct' | 'incorrect' = 'idle';
    private isFlipped: boolean = false;

    // Config
    private readonly spriteScale = 0.16;
    private readonly shadowAlpha = 0.3;
    private readonly jumpScale = 0.36;

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
        this.characterSprite = scene.add.sprite(0, 0, 'emote-tran-idle');
        this.characterSprite.setScale(this.spriteScale);
        this.container.add(this.characterSprite);
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
        const idleTexture = this.isFlipped ? 'emote-tran-idle-flipped' : 'emote-tran-idle';
        const correctTexture = this.isFlipped ? 'emote-tran-correct-flipped' : 'emote-tran-correct';
        const incorrectTexture = this.isFlipped ? 'emote-tran-incorrect-flipped' : 'emote-tran-incorrect';
        const textureMap = {
            'idle': idleTexture,
            'correct': correctTexture,
            'incorrect': incorrectTexture
        };
        this.characterSprite.anims?.stop();
        this.characterSprite.setScale(this.spriteScale);
        this.characterSprite.setTexture(textureMap[state]);
        this.characterSprite.setFlipX(false);
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
        this.isFlipped = !faceRight;
        if (this.currentState === 'idle') {
            this.setState('idle');
            return;
        }
        this.setState(this.currentState);
    }

    /**
     * Jump to a target position with animation
     */
    jumpTo(targetX: number, targetY: number, duration: number = 600): Promise<void>
    {
        return new Promise((resolve) => {
            if (this.stateResetTimer) {
                this.stateResetTimer.remove(false);
                this.stateResetTimer = undefined;
            }
            this.scene.tweens.killTweensOf(this.characterSprite);
            // Determine direction
            const movingRight = targetX > this.container.x;
            const shouldFlipX = !movingRight;
            if (shouldFlipX !== this.isFlipped) {
                this.flip(movingRight);
            }

            // Switch to jump spritesheet animation
            this.characterSprite.anims?.stop();
            this.characterSprite.setTexture('character');
            this.characterSprite.setScale(this.jumpScale);
            this.characterSprite.setFlipX(this.isFlipped);
            this.characterSprite.y = 0;
            this.characterSprite.play('tran-jump', true);

            // Hide shadow during jump
            this.scene.tweens.add({
                targets: this.shadowSprite,
                alpha: 0,
                scaleX: 0.5,
                scaleY: 0.5,
                duration: duration * 0.3
            });

            // Main jump movement (parabolic arc)
            const startX = this.container.x;
            const startY = this.container.y;
            const distance = Phaser.Math.Distance.Between(startX, startY, targetX, targetY);
            const jumpHeight = Phaser.Math.Clamp(distance * 0.35, 80, 180);

            this.scene.tweens.add({
                targets: this.container,
                x: targetX,
                duration: duration,
                ease: 'Sine.easeInOut',
                onUpdate: (tween) => {
                    const t = tween.progress;
                    const baseY = Phaser.Math.Linear(startY, targetY, t);
                    const arcY = Math.sin(Math.PI * t) * jumpHeight;
                    this.container.y = baseY - arcY;
                },
                onComplete: () => {
                    this.scene.tweens.killTweensOf(this.characterSprite);
                    this.characterSprite.setScale(this.spriteScale);
                    this.characterSprite.anims?.stop();
                    this.setState('idle');
                    resolve();
                }
            });

            // Squash/stretch + vertical arc for jump feel
            this.scene.tweens.add({
                targets: this.characterSprite,
                scaleX: this.jumpScale * 0.95,
                scaleY: this.jumpScale * 1.08,
                duration: duration * 0.5,
                yoyo: true,
                ease: 'Sine.easeInOut'
            });

            this.characterSprite.y = 0;


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
            targets: this.characterSprite,
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
        this.scene.tweens.killTweensOf(this.characterSprite);
        this.characterSprite.y = 0;
    }

    /**
     * Show "correct" state temporarily then return to idle
     */
    showCorrect(duration: number = 1000): void
    {
        if (this.stateResetTimer) {
            this.stateResetTimer.remove(false);
            this.stateResetTimer = undefined;
        }
        this.setState('correct');

        // Pop effect
        this.scene.tweens.add({
            targets: this.characterSprite,
            scale: this.spriteScale * 1.2,
            duration: 200,
            yoyo: true
        });

        // Return to idle after delay
        this.stateResetTimer = this.scene.time.delayedCall(duration, () => {
            this.setState('idle');
            this.stateResetTimer = undefined;
        });
    }

    /**
     * Show "incorrect" state temporarily then return to idle
     */
    showIncorrect(duration: number = 1000): void
    {
        if (this.stateResetTimer) {
            this.stateResetTimer.remove(false);
            this.stateResetTimer = undefined;
        }
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
        this.stateResetTimer = this.scene.time.delayedCall(duration, () => {
            this.setState('idle');
            this.stateResetTimer = undefined;
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
