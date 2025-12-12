import type { User, HistoryItem } from '../types';

// Constants for user auth in localStorage
const USERS_KEY = 'image_gen_users';
const LOGGED_IN_USER_KEY = 'image_gen_logged_in_user';
const API_KEY_PREFIX = 'api_key_';

// Constants for history in IndexedDB
const DB_NAME = 'ImageGenDB';
const DB_VERSION = 1;
const HISTORY_STORE_NAME = 'history';
const HISTORY_EXPIRATION_MS = 72 * 60 * 60 * 1000; // 72 hours

// --- API Key Management (localStorage) ---
// Single key (legacy support)
export const saveApiKey = (service: 'gemini' | 'openai' | 'perplexity', key: string): void => {
    const trimmedKey = key.trim();
    if (trimmedKey) {
        localStorage.setItem(`${API_KEY_PREFIX}${service}`, trimmedKey);
    } else {
        localStorage.removeItem(`${API_KEY_PREFIX}${service}`);
    }
};

export const getApiKey = (service: 'gemini' | 'openai' | 'perplexity'): string | null => {
    // Multi-key system only for gemini
    if (service === 'gemini') {
        const keys = getApiKeys('gemini');
        if (keys.length > 0) {
            return getNextValidKey('gemini');
        }
    }
    // Fallback to legacy single key
    return localStorage.getItem(`${API_KEY_PREFIX}${service}`);
};

// Multi-key support (up to 5 keys)
const MULTI_KEY_PREFIX = 'api_keys_';
const MAX_KEYS = 5;

export interface ApiKeyInfo {
    key: string;
    status: 'valid' | 'invalid' | 'quota_exceeded' | 'unchecked';
    lastChecked?: number;
}

export const saveApiKeys = (service: 'gemini', keys: ApiKeyInfo[]): void => {
    const validKeys = keys.slice(0, MAX_KEYS).filter(k => k.key.trim());
    localStorage.setItem(`${MULTI_KEY_PREFIX}${service}`, JSON.stringify(validKeys));
};

export const getApiKeys = (service: 'gemini'): ApiKeyInfo[] => {
    const stored = localStorage.getItem(`${MULTI_KEY_PREFIX}${service}`);
    if (!stored) return [];
    try {
        return JSON.parse(stored) as ApiKeyInfo[];
    } catch {
        return [];
    }
};

export const updateKeyStatus = (service: 'gemini', keyIndex: number, status: ApiKeyInfo['status']): void => {
    const keys = getApiKeys(service);
    if (keys[keyIndex]) {
        keys[keyIndex].status = status;
        keys[keyIndex].lastChecked = Date.now();
        saveApiKeys(service, keys);
    }
};

// Round-robin key selection, skipping invalid/quota keys
let currentKeyIndex = 0;
export const getNextValidKey = (service: 'gemini'): string | null => {
    const keys = getApiKeys(service);
    if (keys.length === 0) return null;

    // Try to find a valid key starting from current index
    for (let i = 0; i < keys.length; i++) {
        const index = (currentKeyIndex + i) % keys.length;
        const keyInfo = keys[index];
        if (keyInfo.status !== 'invalid') {
            currentKeyIndex = (index + 1) % keys.length;
            return keyInfo.key;
        }
    }

    // If all are invalid, just return the first one
    return keys[0]?.key || null;
};

export const removeApiKey = (service: 'gemini', index: number): void => {
    const keys = getApiKeys(service);
    keys.splice(index, 1);
    saveApiKeys(service, keys);
};


// --- User Management (localStorage) ---

const getUsers = (): Record<string, string> => {
    const users = localStorage.getItem(USERS_KEY);
    return users ? JSON.parse(users) : {};
};

const saveUsers = (users: Record<string, string>) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const signupUser = (username: string, password: string): User => {
    if (!username.trim() || !password.trim()) {
        throw new Error('Tên đăng nhập và mật khẩu không được để trống.');
    }
    const users = getUsers();
    if (users[username]) {
        throw new Error('Tên đăng nhập đã tồn tại.');
    }
    users[username] = password;
    saveUsers(users);
    const newUser: User = { id: username, username, name: username.split('@')[0], avatar: `https://ui-avatars.com/api/?name=${username}&background=random` };
    localStorage.setItem(LOGGED_IN_USER_KEY, JSON.stringify(newUser));
    return newUser;
};

export const loginUser = (username: string, password: string): User => {
    const users = getUsers();
    if (!users[username] || users[username] !== password) {
        throw new Error('Tên đăng nhập hoặc mật khẩu không đúng.');
    }
    // Try to get existing user info if we stored it properly, otherwise recreate default
    const storedUser = localStorage.getItem(`${USERS_KEY}_profile_${username}`);
    const user: User = storedUser ? JSON.parse(storedUser) : { id: username, username, name: username.split('@')[0], avatar: `https://ui-avatars.com/api/?name=${username}&background=random` };

    localStorage.setItem(LOGGED_IN_USER_KEY, JSON.stringify(user));
    return user;
};

export const updateUser = (user: User) => {
    localStorage.setItem(LOGGED_IN_USER_KEY, JSON.stringify(user));
    // Persist profile data separately so it survives logout/login
    localStorage.setItem(`${USERS_KEY}_profile_${user.username}`, JSON.stringify(user));
}

export const resetPassword = (username: string, newPass: string) => {
    const users = getUsers();
    if (!users[username]) throw new Error("Người dùng không tồn tại.");
    users[username] = newPass;
    saveUsers(users);
}

export const getLoggedInUser = (): User | null => {
    const user = localStorage.getItem(LOGGED_IN_USER_KEY);
    return user ? JSON.parse(user) : null;
};

export const logoutUser = () => {
    localStorage.removeItem(LOGGED_IN_USER_KEY);
};


// --- History Management (IndexedDB) ---

let dbPromise: Promise<IDBDatabase> | null = null;

const initDB = (): Promise<IDBDatabase> => {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB error:', request.error);
            reject('Không thể mở cơ sở dữ liệu để lưu lịch sử.');
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(HISTORY_STORE_NAME)) {
                const store = db.createObjectStore(HISTORY_STORE_NAME, { keyPath: 'id' });
                store.createIndex('username', 'username', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
    return dbPromise;
};

export const saveHistory = async (username: string, item: HistoryItem): Promise<void> => {
    try {
        const db = await initDB();
        const tx = db.transaction(HISTORY_STORE_NAME, 'readwrite');
        const store = tx.objectStore(HISTORY_STORE_NAME);
        await new Promise<void>((resolve, reject) => {
            const req = store.put({ ...item, username });
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (error) {
        console.error("Lỗi khi lưu lịch sử vào IndexedDB:", error);
    }
};

export const getHistory = async (username: string): Promise<HistoryItem[]> => {
    try {
        const db = await initDB();
        const tx = db.transaction(HISTORY_STORE_NAME, 'readonly');
        const store = tx.objectStore(HISTORY_STORE_NAME);
        const index = store.index('username');

        const allItems: (HistoryItem & { username: string })[] = await new Promise((resolve, reject) => {
            const req = index.getAll(username);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        // Filter out items older than 3 days (Auto-deletion logic on read)
        // In a real backend, you'd run a cron job. Here we filter on fetch.
        const now = Date.now();
        const validHistory: HistoryItem[] = [];
        const expiredIds: string[] = [];

        allItems.forEach(item => {
            if ((now - item.timestamp) < HISTORY_EXPIRATION_MS) {
                validHistory.push(item);
            } else {
                expiredIds.push(item.id);
            }
        });

        // Clean up expired items lazily
        if (expiredIds.length > 0) {
            const deleteTx = db.transaction(HISTORY_STORE_NAME, 'readwrite');
            const deleteStore = deleteTx.objectStore(HISTORY_STORE_NAME);
            expiredIds.forEach(id => deleteStore.delete(id));
        }

        return validHistory.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
        console.error("Lỗi khi lấy lịch sử từ IndexedDB:", error);
        return [];
    }
};

export const deleteHistoryItem = async (id: string): Promise<void> => {
    try {
        const db = await initDB();
        const tx = db.transaction(HISTORY_STORE_NAME, 'readwrite');
        const store = tx.objectStore(HISTORY_STORE_NAME);
        await new Promise<void>((resolve, reject) => {
            const req = store.delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (error) {
        console.error("Lỗi khi xóa lịch sử:", error);
        throw error;
    }
};

export const clearUserHistory = async (username: string): Promise<void> => {
    try {
        const db = await initDB();
        const tx = db.transaction(HISTORY_STORE_NAME, 'readwrite');
        const store = tx.objectStore(HISTORY_STORE_NAME);
        const index = store.index('username');

        // We get keys first then delete. 
        // Note: IndexedDB doesn't have a simple "delete where index = x" without cursor iteration.
        const req = index.openCursor(IDBKeyRange.only(username));

        await new Promise<void>((resolve, reject) => {
            req.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            req.onerror = () => reject(req.error);
        });
    } catch (error) {
        console.error("Lỗi khi xóa tất cả lịch sử:", error);
        throw error;
    }
}