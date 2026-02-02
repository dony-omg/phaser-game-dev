import { GameObjects, Scene, Tweens } from 'phaser';

/**
 * Player Sprite - Custom Game Object cho nhân vật chính
 *
 * Features:
 * - State management (idle, jump)
 * - Smooth animations
 * - Emote display
 * - Flip direction based on movement
 */
export class PlayerSprite extends GameObjects.Container
{
    private characterSprite: GameObjects.Sprite;
    private emoteSprite: GameObjects.Image | null = null;
    private shadowSprite: GameObjects.Ellipse;

    // State
    private currentState: 'idle' | 'jump' = 'idle';
    private isFlipped: boolean = false;

    // Config
    private readonly normalScale = 0.24;
    private readonly jumpScale = 0.56;
    private readonly shadowAlpha = 0.3;

    constructor(scene: Scene, x: number, y: number)
    {
        super(scene, x, y);

        // Shadow (rendered first = behind)
        this.shadowSprite = scene.add.ellipse(0, 20, 60, 20, 0x000000, this.shadowAlpha);
        this.add(this.shadowSprite);

        // Character sprite
        this.characterSprite = scene.add.sprite(0, 0, 'character');
        this.characterSprite.setScale(this.normalScale);
        this.characterSprite.play('character-fly');
        this.add(this.characterSprite);

        // Enable physics if needed
        // scene.physics.add.existing(this);

        // Add to scene
        scene.add.existing(this);
    }

    /**
     * Jump to a target position with animation
     */
    jumpTo(targetX: number, targetY: number, duration: number = 600): Promise<void>
    {
        return new Promise((resolve) => {
            this.currentState = 'jump';

            // Determine direction
            const movingRight = targetX > this.x;
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
                targets: this,
                x: targetX,
                y: targetY,
                duration: duration,
                ease: 'Power2',
                onComplete: () => {
                    this.currentState = 'idle';
                    resolve();
                }
            });

            // Scale effect (simulate height)
            this.scene.tweens.add({
                targets: this.characterSprite,
                scale: this.jumpScale,
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
     * Show emote above player
     */
    showEmote(type: 'happy' | 'fail', duration: number = 1000): void
    {
        // Remove existing emote
        if (this.emoteSprite) {
            this.emoteSprite.destroy();
            this.emoteSprite = null;
        }

        const texture = type === 'happy' ? 'emote-happy' : 'emote-fail';

        this.emoteSprite = this.scene.add.image(0, -80, texture);
        this.emoteSprite.setScale(0.15);
        this.add(this.emoteSprite);

        // Bring emote to front
        this.emoteSprite.setDepth(10);

        // Animate emote
        this.scene.tweens.add({
            targets: this.emoteSprite,
            y: -140,
            alpha: 0,
            duration: duration,
            ease: 'Power1',
            onComplete: () => {
                if (this.emoteSprite) {
                    this.emoteSprite.destroy();
                    this.emoteSprite = null;
                }
            }
        });

        // Scale pop effect
        this.scene.tweens.add({
            targets: this.emoteSprite,
            scale: 0.2,
            duration: 200,
            yoyo: true
        });
    }

    /**
     * Flip character direction
     */
    flip(faceRight: boolean): void
    {
        this.isFlipped = faceRight;
        this.characterSprite.setFlipX(faceRight);
    }

    /**
     * Idle animation (subtle breathing effect)
     */
    playIdle(): void
    {
        if (this.currentState === 'jump') return;

        // Subtle bounce
        this.scene.tweens.add({
            targets: this.characterSprite,
            y: -5,
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
     * Get current state
     */
    getState(): 'idle' | 'jump'
    {
        return this.currentState;
    }

    /**
     * Check if player is currently jumping
     */
    isJumping(): boolean
    {
        return this.currentState === 'jump';
    }

    /**
     * Set position with optional animation
     */
    setPositionWithAnimation(x: number, y: number, duration: number = 300): void
    {
        this.scene.tweens.add({
            targets: this,
            x,
            y,
            duration,
            ease: 'Power2'
        });
    }
}
