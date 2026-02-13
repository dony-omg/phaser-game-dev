export type GameOption = {
    id?: string;
    text: string;
    is_correct: boolean;
};

export type GameQuestion = {
    session_question_id?: string;
    question: {
        content: string;
        options: GameOption[];
    };
};

type RawSessionQuestion = {
    id: string;
    order: number;
    is_answered: boolean;
    question_id: string;
};

export type StartGameSessionData = {
    id: string;
    game_id: string;
    game_session_questions: RawSessionQuestion[];
    game: {
        code?: string;
        time_limit: number;
    };
};

export type GameListItem = {
    id: string;
    code: string;
    name: string;
    is_accessible: boolean;
};

export type AnswerSubmitResponse = {
    remain_sec: number;
    is_end_game: boolean;
    is_win: boolean;
    is_lose: boolean;
    is_correct: boolean;
    is_answered: boolean;
    session: {
        id: string;
        score: number;
        current_question: number;
    };
};

type ApiResponse<T> = {
    success: boolean;
    message?: string;
    data: T;
};

type ApiCallOptions = {
    forceReal?: boolean;
};

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? process.env.VITE_API_URL ?? '').replace(/\/$/, '');
const STATIC_DEBUG_TOKEN = process.env.NEXT_PUBLIC_DEBUG_BEARER_TOKEN ?? 'debug-static-token';

const mockGameSession: StartGameSessionData = {
    id: 'session_mock_001',
    game_id: 'game_mock_001',
    game_session_questions: [
        { id: 'q_1', order: 1, is_answered: false, question_id: 'question_1' },
        { id: 'q_2', order: 2, is_answered: false, question_id: 'question_2' },
        { id: 'q_3', order: 3, is_answered: false, question_id: 'question_3' }
    ],
    game: {
        code: 'vocab_race',
        time_limit: 180
    }
};

const mockQuestions: GameQuestion[] = [
    {
        session_question_id: 'q_1',
        question: {
            content: 'Thủ đô của Việt Nam là gì?',
            options: [
                { id: 'q_1_o_1', text: 'Hà Nội', is_correct: true },
                { id: 'q_1_o_2', text: 'Đà Nẵng', is_correct: false },
                { id: 'q_1_o_3', text: 'Hải Phòng', is_correct: false },
                { id: 'q_1_o_4', text: 'Cần Thơ', is_correct: false }
            ]
        }
    },
    {
        session_question_id: 'q_2',
        question: {
            content: 'Phaser sử dụng ngôn ngữ nào?',
            options: [
                { id: 'q_2_o_1', text: 'TypeScript/JavaScript', is_correct: true },
                { id: 'q_2_o_2', text: 'C#', is_correct: false },
                { id: 'q_2_o_3', text: 'Python', is_correct: false },
                { id: 'q_2_o_4', text: 'Go', is_correct: false }
            ]
        }
    },
    {
        session_question_id: 'q_3',
        question: {
            content: 'Chọn từ trái nghĩa của “fast”.',
            options: [
                { id: 'q_3_o_1', text: 'slow', is_correct: true },
                { id: 'q_3_o_2', text: 'far', is_correct: false },
                { id: 'q_3_o_3', text: 'high', is_correct: false },
                { id: 'q_3_o_4', text: 'small', is_correct: false }
            ]
        }
    }
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ALWAYS_USE_MOCK_API = true;

function shouldUseMock(options?: ApiCallOptions): boolean {
    if (ALWAYS_USE_MOCK_API) return true;
    if (options?.forceReal) return false;
    return true;
}

function toApiGameCode(gameCode: string): string {
    if (gameCode === 'train_game' || gameCode === 'train') return 'trains_cars';
    if (gameCode === 'tower') return 'vocab_race';
    if (gameCode === 'town') return 'vocab_race';
    return gameCode;
}

function ensureApiBaseUrl(): string {
    if (!API_BASE_URL) {
        throw new Error('Missing NEXT_PUBLIC_API_URL (or VITE_API_URL)');
    }

    return API_BASE_URL;
}

function getAuthHeader(): Record<string, string> {
    return {
        Authorization: `Bearer ${STATIC_DEBUG_TOKEN}`
    };
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
    const baseUrl = ensureApiBaseUrl();
    const authHeader = getAuthHeader();
    console.log('[API][HTTP] request', {
        url: `${baseUrl}${path}`,
        method: init?.method ?? 'GET',
        hasAuthToken: Boolean(authHeader.Authorization),
        authSource: process.env.NEXT_PUBLIC_DEBUG_BEARER_TOKEN ? 'env_debug_token' : 'hardcoded_debug_token'
    });
    console.error('[API][HTTP] request-visible', `${init?.method ?? 'GET'} ${baseUrl}${path}`);

    const response = await fetch(`${baseUrl}${path}`, {
        method: init?.method ?? 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...authHeader,
            ...(init?.headers ?? {})
        },
        ...init
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const payload = (await response.json()) as ApiResponse<T>;
    if (!payload?.success) {
        throw new Error(payload?.message ?? 'API response was not successful');
    }

    return payload;
}

async function fetchQuestionDetail(sessionId: string, sessionQuestionId: string): Promise<GameQuestion | null> {
    type QuestionDetailResponse = {
        id: string;
        question: {
            content: string;
            options: Array<{
                id: string;
                text: string;
                is_correct: boolean;
            }>;
        };
    };

    try {
        const res = await requestJson<QuestionDetailResponse>(
            `/api/v1/game/${sessionId}/question/${sessionQuestionId}`
        );

        return {
            session_question_id: res.data.id,
            question: {
                content: res.data.question.content,
                options: res.data.question.options.map((opt) => ({
                    id: opt.id,
                    text: opt.text,
                    is_correct: opt.is_correct
                }))
            }
        };
    } catch (error) {
        console.error('fetchQuestionDetail failed', error);
        return null;
    }
}

async function fetchSessionQuestionWithFallback(
    sessionId: string,
    item: RawSessionQuestion
): Promise<GameQuestion | null> {
    const bySessionQuestionId = await fetchQuestionDetail(sessionId, item.id);
    if (bySessionQuestionId) return bySessionQuestionId;

    if (item.question_id && item.question_id !== item.id) {
        const byQuestionId = await fetchQuestionDetail(sessionId, item.question_id);
        if (byQuestionId) return byQuestionId;
    }

    console.error('[API][REAL] Cannot resolve question detail from both ids', {
        sessionId,
        sessionQuestionId: item.id,
        questionId: item.question_id
    });
    return null;
}

export async function startGameSession(
    gameCode: string,
    options?: ApiCallOptions
): Promise<ApiResponse<StartGameSessionData & { questions: GameQuestion[] }>> {
    console.log('[API] startGameSession invoked', {
        gameCode,
        forceReal: Boolean(options?.forceReal),
        mockMode: shouldUseMock(options)
    });

    if (shouldUseMock(options)) {
        await delay(200);
        console.log('[API][MOCK] startGameSession', {
            gameCode,
            sessionId: mockGameSession.id,
            gameId: mockGameSession.game_id,
            questionCount: mockQuestions.length
        });
        return {
            success: true,
            message: `Mock start for ${gameCode}`,
            data: {
                ...mockGameSession,
                questions: mockQuestions
            }
        };
    }

    const apiGameCode = toApiGameCode(gameCode);
    const sessionRes = await requestJson<StartGameSessionData>('/api/v1/game/start-game', {
        method: 'POST',
        body: JSON.stringify({ game_code: apiGameCode })
    });

    const sessionId = sessionRes.data.id;
    const sessionQuestions = sessionRes.data.game_session_questions ?? [];

    const details = await Promise.all(
        sessionQuestions
            .sort((a, b) => a.order - b.order)
            .map((item) => fetchSessionQuestionWithFallback(sessionId, item))
    );

    const questions = details.filter((item): item is GameQuestion => item !== null);
    if (questions.length === 0) {
        throw new Error('No question details resolved from real API');
    }

    return {
        ...sessionRes,
        data: {
            ...sessionRes.data,
            questions
        }
    };
}

export async function fetchGameList(options?: ApiCallOptions): Promise<ApiResponse<GameListItem[]>> {
    if (shouldUseMock(options)) {
        await delay(120);
        return {
            success: true,
            message: 'Mock game list',
            data: [
                { id: 'mock_town', code: 'vocab_race', name: 'Town', is_accessible: true },
                { id: 'mock_train', code: 'trains_cars', name: 'Train', is_accessible: true }
            ]
        };
    }

    return requestJson<GameListItem[]>('/api/v1/game/list-game');
}

export async function submitAnswer(
    sessionId: string,
    sessionQuestionId: string,
    answerId: string,
    options?: ApiCallOptions
): Promise<ApiResponse<AnswerSubmitResponse>> {
    if (shouldUseMock(options)) {
        await delay(120);
        console.log('[API][MOCK] submitAnswer', {
            sessionId,
            sessionQuestionId,
            answerId
        });
        return {
            success: true,
            message: 'Mock answer submitted',
            data: {
                remain_sec: 0,
                is_end_game: false,
                is_win: false,
                is_lose: false,
                is_correct: true,
                is_answered: true,
                session: {
                    id: sessionId,
                    score: 0,
                    current_question: 0
                }
            }
        };
    }

    return requestJson<AnswerSubmitResponse>('/api/v1/game/answer', {
        method: 'POST',
        body: JSON.stringify({
            session_id: sessionId,
            question_id: sessionQuestionId,
            answer_id: answerId
        })
    });
}

export async function endGameSession(
    gameId: string,
    score: number,
    options?: ApiCallOptions
): Promise<ApiResponse<Record<string, unknown>>> {
    if (shouldUseMock(options)) {
        await delay(150);
        console.log('[API][MOCK] endGameSession', { gameId, score });
        return {
            success: true,
            message: `Mock end for ${gameId} with score ${score}`,
            data: { ok: true }
        };
    }

    return requestJson<Record<string, unknown>>('/api/v1/game/answer-batching', {
        method: 'POST',
        body: JSON.stringify({ game_id: gameId, score })
    });
}
