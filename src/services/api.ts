export type GameOption = {
    text: string;
    is_correct: boolean;
};

export type GameQuestion = {
    question: {
        content: string;
        options: GameOption[];
    };
};

export type StartGameSessionData = {
    game_id: string;
    game_session_questions: GameQuestion[];
    game: {
        time_limit: number;
    };
};

type ApiResponse<T> = {
    success: boolean;
    message?: string;
    data: T;
};

const USE_MOCK = true;

const mockGameSession: StartGameSessionData = {
    game_id: 'session_mock_001',
    game_session_questions: [
        {
            question: {
                content: 'Thủ đô của Việt Nam là gì?',
                options: [
                    { text: 'Hà Nội', is_correct: true },
                    { text: 'Đà Nẵng', is_correct: false },
                    { text: 'Hải Phòng', is_correct: false },
                    { text: 'Cần Thơ', is_correct: false }
                ]
            }
        },
        {
            question: {
                content: 'Phaser sử dụng ngôn ngữ nào?',
                options: [
                    { text: 'TypeScript/JavaScript', is_correct: true },
                    { text: 'C#', is_correct: false },
                    { text: 'Python', is_correct: false },
                    { text: 'Go', is_correct: false }
                ]
            }
        },
        {
            question: {
                content: 'Từ đúng để hoàn thành câu: The robot ___ across the river.',
                options: [
                    { text: 'jumps', is_correct: true },
                    { text: 'jump', is_correct: false },
                    { text: 'jumping', is_correct: false },
                    { text: 'jumped', is_correct: false }
                ]
            }
        },
        {
            question: {
                content: 'Chọn từ trái nghĩa của “fast”.',
                options: [
                    { text: 'slow', is_correct: true },
                    { text: 'far', is_correct: false },
                    { text: 'high', is_correct: false },
                    { text: 'small', is_correct: false }
                ]
            }
        },
        {
            question: {
                content: 'Màu của lá trong game là màu gì?',
                options: [
                    { text: 'Xanh lá', is_correct: true },
                    { text: 'Đỏ', is_correct: false },
                    { text: 'Tím', is_correct: false },
                    { text: 'Vàng', is_correct: false }
                ]
            }
        },
        {
            question: {
                content: 'Từ nào là danh từ?',
                options: [
                    { text: 'river', is_correct: true },
                    { text: 'run', is_correct: false },
                    { text: 'quickly', is_correct: false },
                    { text: 'blue', is_correct: false }
                ]
            }
        },
        {
            question: {
                content: 'Chọn đáp án đúng: She ___ to school every day.',
                options: [
                    { text: 'goes', is_correct: true },
                    { text: 'go', is_correct: false },
                    { text: 'going', is_correct: false },
                    { text: 'gone', is_correct: false }
                ]
            }
        },
        {
            question: {
                content: 'Từ nào có nghĩa là “nhảy”?',
                options: [
                    { text: 'jump', is_correct: true },
                    { text: 'swim', is_correct: false },
                    { text: 'crawl', is_correct: false },
                    { text: 'sleep', is_correct: false }
                ]
            }
        }
    ],
    game: {
        time_limit: 180
    }
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function startGameSession(gameCode: string): Promise<ApiResponse<StartGameSessionData>> {
    if (USE_MOCK) {
        await delay(300);
        return {
            success: true,
            message: `Mock start for ${gameCode}`,
            data: mockGameSession
        };
    }

    throw new Error('startGameSession real API not implemented');
}

export async function endGameSession(gameId: string, score: number): Promise<ApiResponse<{ ok: boolean }>> {
    if (USE_MOCK) {
        await delay(200);
        return {
            success: true,
            message: `Mock end for ${gameId} with score ${score}`,
            data: { ok: true }
        };
    }

    throw new Error('endGameSession real API not implemented');
}
