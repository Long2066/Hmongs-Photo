/**
 * balanceService.ts
 * Service for managing user balance in VND (Vietnamese Dong)
 * Replaces the old credits system with real currency
 */

import { getLoggedInUser } from './storageService';

// ===== CONSTANTS =====
const BALANCE_CACHE_PREFIX = 'user_balance_vnd_';
const USAGE_HISTORY_PREFIX = 'user_usage_history_';

// ===== TYPES =====
export interface UsageRecord {
    id: string;
    timestamp: number;
    modelId: string;
    modelName: string;
    imageCount: number;
    pricePerImage: number;
    totalCost: number; // VND
    resolution: string;
    type: 'image_generation' | 'id_photo' | 'upscale' | 'edit' | 'profile_pro' | 'dream_job' | 'restore';
}

export interface UserBalance {
    balanceVND: number; // Current balance in VND
    totalDeposited: number; // Total amount ever deposited
    totalSpent: number; // Total amount spent
    lastUpdated: number;
}

export interface UsageStats {
    totalImages: number;
    totalSpentVND: number;
    byModel: Record<string, { count: number; spent: number }>;
    byType: Record<string, { count: number; spent: number }>;
}

// ===== LOCAL STORAGE HELPERS =====

/**
 * Get cached balance for current user
 */
export const getCachedBalance = (): number => {
    const user = getLoggedInUser();
    if (!user) return 0;

    const cached = localStorage.getItem(BALANCE_CACHE_PREFIX + user.id);
    if (cached) {
        try {
            const data = JSON.parse(cached) as UserBalance;
            return data.balanceVND || 0;
        } catch {
            return parseInt(cached) || 0;
        }
    }
    return 0;
};

/**
 * Set cached balance for current user
 */
export const setCachedBalance = (balance: UserBalance): void => {
    const user = getLoggedInUser();
    if (!user) return;

    localStorage.setItem(BALANCE_CACHE_PREFIX + user.id, JSON.stringify(balance));

    // Also update the old credits cache for backward compatibility with isProUser()
    localStorage.setItem('user_credits_' + user.id, Math.floor(balance.balanceVND / 100).toString());
};

/**
 * Get user balance object
 */
export const getUserBalance = (): UserBalance => {
    const user = getLoggedInUser();
    if (!user) return { balanceVND: 0, totalDeposited: 0, totalSpent: 0, lastUpdated: Date.now() };

    const cached = localStorage.getItem(BALANCE_CACHE_PREFIX + user.id);
    if (cached) {
        try {
            return JSON.parse(cached) as UserBalance;
        } catch {
            return { balanceVND: 0, totalDeposited: 0, totalSpent: 0, lastUpdated: Date.now() };
        }
    }
    return { balanceVND: 0, totalDeposited: 0, totalSpent: 0, lastUpdated: Date.now() };
};

/**
 * Add deposit to user balance
 */
export const addDeposit = (amountVND: number): UserBalance => {
    const current = getUserBalance();
    const updated: UserBalance = {
        balanceVND: current.balanceVND + amountVND,
        totalDeposited: current.totalDeposited + amountVND,
        totalSpent: current.totalSpent,
        lastUpdated: Date.now()
    };
    setCachedBalance(updated);
    return updated;
};

/**
 * Deduct from user balance
 */
export const deductBalance = (amountVND: number, usageRecord?: Partial<UsageRecord>): boolean => {
    const current = getUserBalance();

    if (current.balanceVND < amountVND) {
        console.warn('[Balance] Insufficient balance:', current.balanceVND, 'required:', amountVND);
        return false;
    }

    const updated: UserBalance = {
        balanceVND: current.balanceVND - amountVND,
        totalDeposited: current.totalDeposited,
        totalSpent: current.totalSpent + amountVND,
        lastUpdated: Date.now()
    };
    setCachedBalance(updated);

    // Record usage history
    if (usageRecord) {
        addUsageRecord({
            ...usageRecord,
            id: Date.now().toString(),
            timestamp: Date.now(),
            totalCost: amountVND
        } as UsageRecord);
    }

    return true;
};

/**
 * Check if user has enough balance
 */
export const hasEnoughBalance = (requiredVND: number): boolean => {
    const balance = getCachedBalance();
    return balance >= requiredVND;
};

// ===== USAGE HISTORY =====

/**
 * Get usage history for current user
 */
export const getUsageHistory = (): UsageRecord[] => {
    const user = getLoggedInUser();
    if (!user) return [];

    const stored = localStorage.getItem(USAGE_HISTORY_PREFIX + user.id);
    if (stored) {
        try {
            return JSON.parse(stored) as UsageRecord[];
        } catch {
            return [];
        }
    }
    return [];
};

/**
 * Add usage record
 */
export const addUsageRecord = (record: UsageRecord): void => {
    const user = getLoggedInUser();
    if (!user) return;

    const history = getUsageHistory();
    history.unshift(record); // Add to beginning

    // Keep only last 100 records
    const trimmed = history.slice(0, 100);
    localStorage.setItem(USAGE_HISTORY_PREFIX + user.id, JSON.stringify(trimmed));
};

/**
 * Get usage statistics
 */
export const getUsageStats = (): UsageStats => {
    const history = getUsageHistory();

    const stats: UsageStats = {
        totalImages: 0,
        totalSpentVND: 0,
        byModel: {},
        byType: {}
    };

    for (const record of history) {
        stats.totalImages += record.imageCount;
        stats.totalSpentVND += record.totalCost;

        // By model
        if (!stats.byModel[record.modelId]) {
            stats.byModel[record.modelId] = { count: 0, spent: 0 };
        }
        stats.byModel[record.modelId].count += record.imageCount;
        stats.byModel[record.modelId].spent += record.totalCost;

        // By type
        if (!stats.byType[record.type]) {
            stats.byType[record.type] = { count: 0, spent: 0 };
        }
        stats.byType[record.type].count += record.imageCount;
        stats.byType[record.type].spent += record.totalCost;
    }

    return stats;
};

// ===== FORMATTING =====

/**
 * Format VND amount with thousand separators
 */
export const formatVND = (amount: number): string => {
    return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + 'đ';
};

/**
 * Format VND amount as compact (e.g., 1.2K, 1.5M)
 */
export const formatVNDCompact = (amount: number): string => {
    if (amount >= 1000000) {
        return (amount / 1000000).toFixed(1) + 'Tr đ';
    }
    if (amount >= 1000) {
        return (amount / 1000).toFixed(1) + 'K đ';
    }
    return amount + 'đ';
};

export default {
    getCachedBalance,
    setCachedBalance,
    getUserBalance,
    addDeposit,
    deductBalance,
    hasEnoughBalance,
    getUsageHistory,
    addUsageRecord,
    getUsageStats,
    formatVND,
    formatVNDCompact
};
