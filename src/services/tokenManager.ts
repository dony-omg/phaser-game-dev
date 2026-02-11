type TokenMessage = {
    type?: string;
    token?: string;
    data?: {
        token?: string;
    };
};

const TOKEN_STORAGE_KEY = 'authToken';

class TokenManager {
    private token: string | null = null;
    private initialized = false;

    constructor() {
        this.token = this.readStoredToken();
    }

    setupListeners(): void {
        if (this.initialized || typeof window === 'undefined') return;
        this.initialized = true;

        const listener = (event: MessageEvent<string>) => {
            this.consumeRawMessage(event.data);
        };

        window.addEventListener('message', listener);
        document.addEventListener('message', listener as unknown as EventListener);
    }

    getToken(): string | null {
        if (this.token) return this.token;
        this.token = this.readStoredToken();
        return this.token;
    }

    setToken(token: string): void {
        const sanitized = token.trim();
        if (!sanitized) return;

        this.token = sanitized;
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(TOKEN_STORAGE_KEY, sanitized);
        }
    }

    clearToken(): void {
        this.token = null;
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
    }

    private readStoredToken(): string | null {
        if (typeof window === 'undefined') return null;
        return window.localStorage.getItem(TOKEN_STORAGE_KEY);
    }

    private consumeRawMessage(raw: string | TokenMessage): void {
        const payload = this.normalizeMessage(raw);
        if (!payload) return;

        const type = (payload.type ?? '').toUpperCase();
        if (type !== 'AUTH_TOKEN' && type !== 'TOKEN') return;

        const maybeToken = payload.token ?? payload.data?.token;
        if (typeof maybeToken === 'string' && maybeToken.trim()) {
            this.setToken(maybeToken);
        }
    }

    private normalizeMessage(raw: string | TokenMessage): TokenMessage | null {
        if (!raw) return null;
        if (typeof raw === 'string') {
            try {
                return JSON.parse(raw) as TokenMessage;
            } catch {
                return null;
            }
        }

        if (typeof raw === 'object') {
            return raw;
        }

        return null;
    }
}

export const tokenManager = new TokenManager();
