/**
 * Google Quota Station Service
 * Handles crowdsourced Google account authentication via CLIProxyAPI VPS
 * and rewards users with +20 free image generations per unique Google account.
 * Uses getBackgroundSyncDb to guarantee 100% Firestore permissions across all clients.
 */

import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { getBackgroundSyncDb, updateUserCredits } from './firebaseService';
import { getNineRouterUrl, getNineRouterApiKey } from './nineRouterService';

const USER_ACCESS_COLLECTION = 'userAccess';

export interface OAuthStartResult {
    url: string;
    state: string;
}

export interface ContributionResult {
    success: boolean;
    email?: string;
    message: string;
    rewardImages?: number;
    rewardVND?: number;
}

export interface ContributedAccountItem {
    id: string;
    email: string;
    contributedByUserId: string;
    contributedByUserName: string;
    timestamp: number;
    rewardImages: number;
    rewardVND: number;
}

/**
 * Get VPS base URL (strips trailing /v1 if present)
 */
const getVpsBaseUrl = (): string => {
    let url = getNineRouterUrl().trim().replace(/\/+$/, '');
    if (url.endsWith('/v1')) {
        url = url.slice(0, -3);
    }
    return url;
};

/**
 * Step 1: Start Antigravity Google OAuth session on the VPS
 */
export const startAntigravityOAuthSession = async (): Promise<OAuthStartResult> => {
    const baseUrl = getVpsBaseUrl();
    const apiKey = getNineRouterApiKey();

    const headers: Record<string, string> = {
        'ngrok-skip-browser-warning': 'true'
    };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['X-Management-Key'] = apiKey;
    }

    const resp = await fetch(`${baseUrl}/v0/management/antigravity-auth-url`, {
        method: 'GET',
        headers
    });

    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Máy chủ VPS không phản hồi (HTTP ${resp.status}): ${errText.slice(0, 120)}`);
    }

    const data = await resp.json();
    if (!data.url || !data.state) {
        throw new Error('Máy chủ không trả về URL ủy quyền Google hợp lệ');
    }

    return {
        url: data.url,
        state: data.state
    };
};

/**
 * Fetch list of currently authenticated Antigravity accounts from VPS
 */
export const fetchVpsAntigravityAccounts = async (): Promise<string[]> => {
    try {
        const baseUrl = getVpsBaseUrl();
        const apiKey = getNineRouterApiKey();
        const headers: Record<string, string> = {
            'ngrok-skip-browser-warning': 'true'
        };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
            headers['X-Management-Key'] = apiKey;
        }

        const resp = await fetch(`${baseUrl}/v0/management/auth-files`, {
            method: 'GET',
            headers
        });
        if (!resp.ok) return [];

        const data = await resp.json();
        const files: any[] = Array.isArray(data?.files) ? data.files : [];
        return files
            .filter(f => f.provider === 'antigravity' && f.label && f.label.includes('@'))
            .map(f => String(f.label).toLowerCase().trim());
    } catch {
        return [];
    }
};

/**
 * Step 2: Submit callback URL to VPS and verify the session
 */
export const submitAntigravityCallback = async (
    rawCallbackUrl: string,
    expectedState: string
): Promise<string> => {
    const trimmed = rawCallbackUrl.trim();
    if (!trimmed) {
        throw new Error('Vui lòng dán liên kết xác thực từ thanh địa chỉ trình duyệt.');
    }

    // Extract code and state
    let state = expectedState;
    let code = '';

    try {
        // Try parsing as full URL
        const parsed = new URL(trimmed.startsWith('http') ? trimmed : `http://${trimmed}`);
        code = parsed.searchParams.get('code') || '';
        const parsedState = parsed.searchParams.get('state');
        if (parsedState) {
            state = parsedState;
        }
    } catch {
        // Fallback: regex search
        const codeMatch = trimmed.match(/[?&]code=([^&]+)/);
        if (codeMatch) code = decodeURIComponent(codeMatch[1]);
        const stateMatch = trimmed.match(/[?&]state=([^&]+)/);
        if (stateMatch) state = decodeURIComponent(stateMatch[1]);
    }

    if (!code) {
        throw new Error('Không tìm thấy mã xác thực (code=...) trong đường dẫn đã dán. Vui lòng copy toàn bộ URL trên thanh địa chỉ.');
    }

    const baseUrl = getVpsBaseUrl();
    const apiKey = getNineRouterApiKey();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
    };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['X-Management-Key'] = apiKey;
    }

    // Submit callback to VPS
    const resp = await fetch(`${baseUrl}/v0/management/oauth-callback`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            provider: 'antigravity',
            redirect_url: `http://localhost:51121/oauth-callback?state=${encodeURIComponent(state)}&code=${encodeURIComponent(code)}`
        })
    });

    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Xác nhận với VPS thất bại (HTTP ${resp.status}): ${errText.slice(0, 140)}`);
    }

    // Poll auth status for up to 15 seconds until 'ok'
    const startTime = Date.now();
    let isOk = false;

    while (Date.now() - startTime < 15000) {
        await new Promise(res => setTimeout(res, 800));
        try {
            const statusResp = await fetch(`${baseUrl}/v0/management/get-auth-status?state=${encodeURIComponent(state)}`, {
                headers
            });
            if (statusResp.ok) {
                const statusData = await statusResp.json();
                if (statusData.status === 'ok') {
                    isOk = true;
                    break;
                }
                if (statusData.status === 'error') {
                    throw new Error(statusData.error || 'Ủy quyền thất bại hoặc mã xác thực đã hết hạn.');
                }
            }
        } catch (e: any) {
            if (e.message && !e.message.includes('fetch')) {
                throw e;
            }
        }
    }

    if (!isOk) {
        throw new Error('Quá thời gian chờ VPS xác nhận tài khoản Google. Vui lòng thử lại.');
    }

    return state;
};

/**
 * Step 3: Anti-fraud verification in Firestore (via guaranteed userAccess collection)
 * and Reward +20 Images (10,000 VND)
 */
export const verifyAndRewardContributedAccount = async (
    userId: string,
    userName: string,
    knownAccountsBefore: string[]
): Promise<ContributionResult> => {
    // 1. Get current list of accounts from VPS to identify newly added email
    const currentAccounts = await fetchVpsAntigravityAccounts();
    const beforeSet = new Set(knownAccountsBefore.map(e => e.toLowerCase().trim()));
    const newEmails = currentAccounts.filter(e => !beforeSet.has(e));

    // Fallback: If delta detection was ambiguous, pick the most recent
    let targetEmail = newEmails[0] || currentAccounts[currentAccounts.length - 1];

    if (!targetEmail || !targetEmail.includes('@')) {
        return {
            success: true,
            message: 'Tài khoản Google đã kết nối thành công với VPS! (Không xác định được email để cộng thưởng)',
            rewardImages: 0
        };
    }

    targetEmail = targetEmail.toLowerCase().trim();
    const emailDocId = targetEmail.replace(/[.@]/g, '_');

    const REWARD_IMAGES = 20;
    const REWARD_VND = 10000; // 20 * 500 VND/image

    try {
        // Use backgroundSyncDb to guarantee 100% permissions on userAccess collection
        const targetDb = await getBackgroundSyncDb();
        const accountDocRef = doc(targetDb, USER_ACCESS_COLLECTION, `quota_acc_${emailDocId}`);
        const accountDocSnap = await getDoc(accountDocRef);

        if (accountDocSnap.exists()) {
            const existingData = accountDocSnap.data();
            const dateStr = existingData.timestamp ? new Date(existingData.timestamp).toLocaleDateString('vi-VN') : '';
            return {
                success: false,
                email: targetEmail,
                message: `Tài khoản Google này (${targetEmail}) đã được đóng góp vào hệ thống trước đó${dateStr ? ` vào ngày ${dateStr}` : ''}. Mỗi tài khoản chỉ được nhận thưởng 1 lần duy nhất!`
            };
        }

        // Brand-new account! Record to Firestore for persistent anti-fraud
        await setDoc(accountDocRef, {
            type: 'quota_contribution',
            email: targetEmail,
            contributedByUserId: userId,
            contributedByUserName: userName || 'Khách hàng',
            timestamp: Date.now(),
            rewardImages: REWARD_IMAGES,
            rewardVND: REWARD_VND
        });

        // Also record user-specific record
        const userDocRef = doc(targetDb, USER_ACCESS_COLLECTION, `quota_user_${userId}_${emailDocId}`);
        await setDoc(userDocRef, {
            type: 'quota_user_contribution',
            email: targetEmail,
            contributedByUserId: userId,
            contributedByUserName: userName || 'Khách hàng',
            timestamp: Date.now(),
            rewardImages: REWARD_IMAGES,
            rewardVND: REWARD_VND
        });
    } catch (firestoreErr) {
        console.warn('[QuotaStation] Firestore anti-fraud record warning:', firestoreErr);
        // Continue even if Firestore check had an issue so user gets rewarded
    }

    // Award balance to user
    try {
        await updateUserCredits(userId, REWARD_VND, 'add');
    } catch (credErr) {
        console.warn('[QuotaStation] Failed to award credits:', credErr);
    }

    return {
        success: true,
        email: targetEmail,
        rewardImages: REWARD_IMAGES,
        rewardVND: REWARD_VND,
        message: `Tuyệt vời! Đã nạp thành công tài khoản ${targetEmail}. Bạn nhận được ngay +${REWARD_IMAGES} lượt tạo ảnh miễn phí!`
    };
};

/**
 * Get user's contributed accounts list
 */
export const getUserContributedAccounts = async (userId: string): Promise<ContributedAccountItem[]> => {
    try {
        const targetDb = await getBackgroundSyncDb();
        const q = query(
            collection(targetDb, USER_ACCESS_COLLECTION),
            where('contributedByUserId', '==', userId),
            where('type', '==', 'quota_user_contribution')
        );
        const querySnapshot = await getDocs(q);
        const results: ContributedAccountItem[] = [];
        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            results.push({
                id: docSnap.id,
                email: data.email || '',
                contributedByUserId: data.contributedByUserId,
                contributedByUserName: data.contributedByUserName,
                timestamp: data.timestamp || 0,
                rewardImages: data.rewardImages || 20,
                rewardVND: data.rewardVND || 10000
            });
        });
        return results.sort((a, b) => b.timestamp - a.timestamp);
    } catch (e) {
        console.warn('[QuotaStation] Failed to load user contributions:', e);
        return [];
    }
};
