import { Boot } from './scenes/Boot';
import { GameOver } from './scenes/GameOver';
import { Game as MainGame } from './scenes/Game';
import { TrainGame } from './scenes/TrainGame';
import { MainMenu } from './scenes/MainMenu';
import Phaser, { AUTO, Game } from 'phaser';
import { Preloader } from './scenes/Preloader';
import { DEFAULT_GAME_CODE, resolveGameCode } from './gameConfig';

//  Find out more information about the Game Config at:
//  https://newdocs.phaser.io/docs/3.70.0/Phaser.Types.Core.GameConfig
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    parent: 'game-container',
    backgroundColor: '#3fb3e8',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 720,
        height: 1280
    },
    scene: [
        Boot,
        Preloader,
        MainMenu,
        MainGame,
        TrainGame,
        GameOver
    ]
};

type StartGameOptions = {
    gameCode?: string | null;
};

const StartGame = (parent: string, options?: StartGameOptions) => {
    const gameCode = resolveGameCode(options?.gameCode ?? DEFAULT_GAME_CODE);

    return new Game({
        ...config,
        parent,
        callbacks: {
            preBoot: (game) => {
                game.registry.set('gameCode', gameCode);
            }
        }
    });

}

export default StartGame;
