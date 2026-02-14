import { Scene } from 'phaser';
import { getGameConfig } from '../gameConfig';

/**
 * Boot Scene - Stage 1: Load minimal assets for Preloader UI
 *
 * Strategy: Two-stage loading
 * - Stage 1 (Boot): Load only assets needed for loading screen
 * - Stage 2 (Preloader): Load all game assets with progress bar
 *
 * Benefits:
 * - Fast initial feedback
 * - Visual progress indication
 * - Better perceived performance
 */
export class Boot extends Scene
{
    constructor ()
    {
        super('Boot');
    }

    preload ()
    {
        const gameCode = this.registry.get('gameCode') as string | undefined;
        const gameConfig = getGameConfig(gameCode);
        const assetRoot = gameConfig.assetRoot;

        // Ensure assets resolve from site root even on /game/* routes
        this.load.setPath('/assets');

        // Load only minimal assets needed for Preloader UI
        // These should be small file sizes as there's no progress bar yet

        if (gameConfig.code === 'train_game') {
            // Train assets don't include layered backgrounds; reuse the same image.
            const loaderBg = `${assetRoot}/background.png`;
            this.load.image('bg-1', loaderBg);
            this.load.image('bg-2', loaderBg);
            this.load.image('bg-3', loaderBg);
            this.load.image('bg-4', loaderBg);
            this.load.image('bg-5', loaderBg);
            this.load.image('bg-6', loaderBg);

            // Logo for branding during load
            this.load.image('logo', `${assetRoot}/background.png`);
        } else {
            // Mobile-safe loader layers: avoid giant 9k-tall textures.
            const loaderBg = `${assetRoot}/maps/All map.png`;
            this.load.image('bg-1', loaderBg);
            this.load.image('bg-2', loaderBg);
            this.load.image('bg-3', loaderBg);
            this.load.image('bg-4', loaderBg);
            this.load.image('bg-5', loaderBg);
            this.load.image('bg-6', loaderBg);

            // Logo for branding during load
            this.load.image('logo', `${assetRoot}/ui/logo.png`);
        }
    }

    create ()
    {
        // Transition to Preloader to load main game assets
        this.scene.start('Preloader');
    }
}
