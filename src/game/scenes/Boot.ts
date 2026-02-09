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

        // Parallax background layers for loader
        this.load.image('bg-1', `${assetRoot}/backgrounds/1.png`);
        this.load.image('bg-2', `${assetRoot}/backgrounds/2.png`);
        this.load.image('bg-3', `${assetRoot}/backgrounds/3.png`);
        this.load.image('bg-4', `${assetRoot}/backgrounds/4.png`);
        this.load.image('bg-5', `${assetRoot}/backgrounds/5.png`);
        this.load.image('bg-6', `${assetRoot}/backgrounds/6.png`);

        // Logo for branding during load
        this.load.image('logo', `${assetRoot}/ui/logo.png`);
    }

    create ()
    {
        // Transition to Preloader to load main game assets
        this.scene.start('Preloader');
    }
}
