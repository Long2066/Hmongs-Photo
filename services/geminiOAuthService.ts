/**
 * Google OAuth Service for Gemini API
 * 
 * Frontend service that communicates with Electron main process
 * to handle Google OAuth authentication for Gemini API access.
 * 
 * This allows users to use their Google account (with Gemini access)
 * instead of manually entering API keys.
 * 
 * WARNING: This is an unofficial integration. Using third-party OAuth
 * clients may result in Google account restrictions.
 */

// --- Types ---
export interface OAuthStatus {
    configured: boolean;
    email?: string;
    projectId?: string;
    isExpired?: boolean;
    expiresAt?: number;
    hasRefreshToken?: boolean;
    error?: string;
}

export interface OAuthTokenResult {
    success: boolean;
    token?: string;
    projectId?: string;
    email?: string;
    error?: string;
}

export interface OAuthStartResult {
    success: boolean;
    email?: string;
    projectId?: string;
    expiresAt?: number;
    error?: string;
}

export interface GeminiCliCheck {
    installed: boolean;
    hasEnvVars?: boolean;
    error?: string;
}

// --- Electron API Bridge ---
// Access the preloaded electronAPI
const getElectronAPI = (): any => {
    return (window as any).electronAPI;
};

const isElectron = (): boolean => {
    return !!(window as any).electronAPI?.isElectron;
};

// --- LocalStorage Keys ---
const OAUTH_ENABLED_KEY = 'google_oauth_enabled';
const OAUTH_EMAIL_KEY = 'google_oauth_email';

// --- Storage Functions ---
export const setOAuthEnabled = (enabled: boolean): void => {
    localStorage.setItem(OAUTH_ENABLED_KEY, enabled ? 'true' : 'false');
    // Dispatch event for real-time UI updates
    window.dispatchEvent(new CustomEvent('oauth-status-changed', {
        detail: { enabled }
    }));
};

export const isOAuthEnabled = (): boolean => {
    return localStorage.getItem(OAUTH_ENABLED_KEY) === 'true';
};

export const getOAuthEmail = (): string | null => {
    return localStorage.getItem(OAUTH_EMAIL_KEY);
};

export const setOAuthEmail = (email: string | null): void => {
    if (email) {
        localStorage.setItem(OAUTH_EMAIL_KEY, email);
    } else {
        localStorage.removeItem(OAUTH_EMAIL_KEY);
    }
};

// --- Main API Functions ---

/**
 * Start Google OAuth login flow
 * Opens browser for Google sign-in, returns result
 */
export const startGoogleOAuth = async (): Promise<OAuthStartResult> => {
    if (!isElectron()) {
        return { success: false, error: 'OAuth chỉ hỗ trợ trong ứng dụng Electron (Desktop)' };
    }

    try {
        const api = getElectronAPI();
        const result = await api.googleOAuthStart();

        if (result.success) {
            setOAuthEmail(result.email || null);
            setOAuthEnabled(true);
            console.log('[OAuth Service] Login successful:', result.email);
        }

        return result;
    } catch (error: any) {
        console.error('[OAuth Service] Start failed:', error);
        return { success: false, error: error.message || 'OAuth login failed' };
    }
};

/**
 * Get a valid access token for Gemini API
 * Auto-refreshes if token is expired
 * Returns null if not configured
 */
export const getOAuthAccessToken = async (): Promise<OAuthTokenResult> => {
    if (!isElectron() || !isOAuthEnabled()) {
        return { success: false, error: 'OAuth not enabled' };
    }

    try {
        const api = getElectronAPI();
        const result = await api.googleOAuthGetToken();
        return result;
    } catch (error: any) {
        console.error('[OAuth Service] Get token failed:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Check OAuth connection status
 */
export const checkOAuthStatus = async (): Promise<OAuthStatus> => {
    if (!isElectron()) {
        return { configured: false, error: 'Not in Electron' };
    }

    try {
        const api = getElectronAPI();
        return await api.googleOAuthStatus();
    } catch (error: any) {
        return { configured: false, error: error.message };
    }
};

/**
 * Logout - clear all OAuth tokens
 */
export const logoutOAuth = async (): Promise<boolean> => {
    if (!isElectron()) return false;

    try {
        const api = getElectronAPI();
        const result = await api.googleOAuthLogout();

        if (result.success) {
            setOAuthEnabled(false);
            setOAuthEmail(null);
            console.log('[OAuth Service] Logged out');
        }

        return result.success;
    } catch (error: any) {
        console.error('[OAuth Service] Logout failed:', error);
        return false;
    }
};

/**
 * Check if Gemini CLI is installed (required for OAuth)
 */
export const checkGeminiCliInstalled = async (): Promise<GeminiCliCheck> => {
    if (!isElectron()) {
        return { installed: false, error: 'Not in Electron' };
    }

    try {
        const api = getElectronAPI();
        return await api.googleOAuthCheckCli();
    } catch (error: any) {
        return { installed: false, error: error.message };
    }
};

/**
 * Check if OAuth mode is available and ready to use
 */
export const isOAuthReady = async (): Promise<boolean> => {
    if (!isElectron() || !isOAuthEnabled()) return false;

    try {
        const status = await checkOAuthStatus();
        return status.configured && (status.hasRefreshToken || !status.isExpired);
    } catch {
        return false;
    }
};

export default {
    startGoogleOAuth,
    getOAuthAccessToken,
    checkOAuthStatus,
    logoutOAuth,
    checkGeminiCliInstalled,
    isOAuthEnabled,
    setOAuthEnabled,
    isOAuthReady,
    getOAuthEmail,
    setOAuthEmail,
};
