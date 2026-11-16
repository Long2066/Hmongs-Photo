export type ConcurrencySetting = 'auto' | 2 | 4 | 6 | 8 | 10;
export type ConcurrencyKind = 'image' | 'video';

export const CONCURRENCY_OPTIONS: ReadonlyArray<ConcurrencySetting> = ['auto', 2, 4, 6, 8, 10];
export const CONCURRENCY_EVENT = 'concurrency-setting-changed';

const STORAGE_KEYS: Record<ConcurrencyKind, string> = {
    image: 'image_concurrency_setting',
    video: 'video_concurrency_setting',
};

const VALID_NUMERIC_SETTINGS = new Set([2, 4, 6, 8, 10]);

export const parseConcurrencySetting = (raw: unknown): ConcurrencySetting => {
    if (raw === 'auto' || raw === undefined || raw === null || raw === '') return 'auto';
    const num = Number(raw);
    if (VALID_NUMERIC_SETTINGS.has(num)) return num as ConcurrencySetting;
    return 'auto';
};

export const getConcurrencySetting = (kind: ConcurrencyKind): ConcurrencySetting => {
    try {
        if (typeof localStorage !== 'undefined') {
            return parseConcurrencySetting(localStorage.getItem(STORAGE_KEYS[kind]));
        }
    } catch {
        // Ignore storage restrictions
    }
    return 'auto';
};

export const setConcurrencySetting = (kind: ConcurrencyKind, setting: ConcurrencySetting): void => {
    const normalized = parseConcurrencySetting(setting);
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEYS[kind], String(normalized));
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(CONCURRENCY_EVENT, { detail: { kind, setting: normalized } }));
        }
    } catch {
        // Ignore storage restrictions
    }
};

export interface ResolveConcurrencyOptions {
    modelId?: string;
    isNineRouter?: boolean;
    isVipMode?: boolean;
    isAntigravity?: boolean;
    settingOverride?: ConcurrencySetting;
}

/**
 * Resolve effective parallel worker count (1..10) based on user setting and active backend gateway.
 * - Multi-account Muse VPS pool (8 accounts behind muse2api) & 9Router support 8-10 concurrent threads smoothly.
 * - Single-account Google Antigravity OAuth stays capped at 4 in 'auto' mode to avoid instant throttling.
 */
export const resolveEffectiveConcurrency = (
    kind: ConcurrencyKind,
    itemCount: number,
    options: ResolveConcurrencyOptions = {}
): number => {
    const total = Math.max(1, Math.floor(Number(itemCount) || 1));
    const setting = options.settingOverride ?? getConcurrencySetting(kind);
    const modelLower = String(options.modelId || '').toLowerCase();

    if (setting !== 'auto') {
        return Math.min(total, Math.max(1, Math.min(10, Number(setting))));
    }

    if (kind === 'video') {
        if (modelLower.startsWith('muse/')) {
            return Math.min(total, 10);
        }
        return Math.min(total, 8);
    }

    // Image generation
    if (options.isAntigravity && !options.isNineRouter && !modelLower.includes('muse')) {
        return Math.min(total, 4);
    }
    if (modelLower.includes('muse') || options.isNineRouter) {
        return Math.min(total, 10);
    }
    if (options.isVipMode) {
        return Math.min(total, 6);
    }
    return Math.min(total, 8);
};

export const isTransientHttpOrNetworkError = (status?: number, message?: string): boolean => {
    if (typeof status === 'number') {
        if ([408, 425, 429, 500, 502, 503, 504, 520, 522, 524].includes(status)) {
            return true;
        }
        if (status >= 400 && status < 500) {
            return false;
        }
    }
    const msg = String(message || '').toLowerCase();
    if (!msg) return false;
    if (
        msg.includes('abort') && !msg.includes('timeout') ||
        msg.includes('content_policy') ||
        msg.includes('safety') ||
        msg.includes('invalid_api_key') ||
        msg.includes('insufficient balance')
    ) {
        return false;
    }
    return (
        msg.includes('429') ||
        msg.includes('502') ||
        msg.includes('503') ||
        msg.includes('504') ||
        msg.includes('rate limit') ||
        msg.includes('too many requests') ||
        msg.includes('temporarily unavailable') ||
        msg.includes('service unavailable') ||
        msg.includes('bad gateway') ||
        msg.includes('gateway timeout') ||
        msg.includes('overloaded') ||
        msg.includes('capacity') ||
        msg.includes('quota') ||
        msg.includes('econnreset') ||
        msg.includes('etimedout') ||
        msg.includes('socket hang up') ||
        msg.includes('failed to fetch') ||
        msg.includes('network') ||
        msg.includes('timeout')
    );
};

export const computeJitteredBackoffMs = (
    attempt: number,
    baseMs = 1500,
    maxMs = 10000
): number => {
    const exp = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, attempt)));
    const jitter = Math.floor(Math.random() * Math.min(800, Math.round(exp * 0.3)));
    return Math.min(maxMs, exp + jitter);
};

export const sleepWithAbort = (ms: number, abortSignal?: AbortSignal): Promise<void> => {
    if (abortSignal?.aborted) {
        return Promise.reject(new Error('ABORTED'));
    }
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            abortSignal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(timer);
            abortSignal?.removeEventListener('abort', onAbort);
            reject(new Error('ABORTED'));
        };
        abortSignal?.addEventListener('abort', onAbort, { once: true });
    });
};
