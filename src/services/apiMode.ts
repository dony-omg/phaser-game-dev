export type ApiMode = 'real' | 'mock';

const API_MODE_STORAGE_KEY = 'debug_api_mode';
const ENV_DEFAULT_MODE: ApiMode = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true' ? 'mock' : 'real';

export function getApiMode(): ApiMode {
    if (typeof window === 'undefined') return ENV_DEFAULT_MODE;

    const value = window.localStorage.getItem(API_MODE_STORAGE_KEY);
    if (value === 'mock' || value === 'real') {
        return value;
    }

    return ENV_DEFAULT_MODE;
}

export function setApiMode(mode: ApiMode): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(API_MODE_STORAGE_KEY, mode);
}

export function getDefaultApiMode(): ApiMode {
    return ENV_DEFAULT_MODE;
}

export function isMockApiMode(): boolean {
    return getApiMode() === 'mock';
}
