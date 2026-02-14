export type GameCode = 'vocab_race' | 'train_game';

export type GameConfig = {
    code: GameCode;
    label: string;
    mapKey: string;
    mapPath: string;
    assetRoot: string;
    backgroundColor: number;
    useTexturePath: boolean;
};

const gameConfigs: Record<GameCode, GameConfig> = {
    vocab_race: {
        code: 'vocab_race',
        label: 'Tower',
        mapKey: 'bg-tower',
        mapPath: 'maps/All map.png',
        assetRoot: 'games/tower',
        backgroundColor: 0x3fb3e8,
        useTexturePath: true
    },
    train_game: {
        code: 'train_game',
        label: 'Nối Đuôi Xe Lửa',
        mapKey: 'bg-train',
        mapPath: 'background copy 2.png',
        assetRoot: 'games/train',
        backgroundColor: 0xf59e0b,
        useTexturePath: false
    }
};

export const DEFAULT_GAME_CODE: GameCode = 'vocab_race';

export function resolveGameCode(raw?: string | null): GameCode {
    if (!raw) return DEFAULT_GAME_CODE;

    if (raw === 'tower') return 'vocab_race';
    if (raw === 'town') return 'vocab_race';
    if (raw === 'train') return 'train_game';

    return (raw in gameConfigs ? raw : DEFAULT_GAME_CODE) as GameCode;
}

export function getGameConfig(raw?: string | null): GameConfig {
    const code = resolveGameCode(raw);
    return gameConfigs[code];
}
