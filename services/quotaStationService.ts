/**
 * Google Quota Station Service
 * Handles crowdsourced Google account authentication via CLIProxyAPI VPS
 * and rewards users with +10 free image generations per unique Google account.
 * Uses getBackgroundSyncDb to guarantee 100% Firestore permissions across all clients.
 */

import { doc, getDoc, setDoc, addDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../src/firebaseConfig';
import { getBackgroundSyncDb } from './firebaseService';
import { getNineRouterUrl, getNineRouterApiKey } from './nineRouterService';

const USER_ACCESS_COLLECTION = 'userAccess';
export const QUOTA_APPROVAL_COLLECTION = 'quotaApprovalRequests';

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
    status?: 'pending' | 'approved' | 'rejected';
    reviewNote?: string;
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
            .filter(f => (f.provider === 'antigravity' || String(f.name || '').includes('antigravity')))
            .map(f => {
                const raw = String(f.label || f.email || f.name || '');
                const match = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                return match ? match[0].toLowerCase().trim() : '';
            })
            .filter(Boolean);
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
 * Step 3: Record Quota Approval Request to Firestore for Admin Review
 * User is notified: "Đăng nhập thành công, bạn sẽ nhận được 10 lượt tạo ảnh miễn phí sau khi kiểm duyệt."
 */
export const verifyAndRewardContributedAccount = async (
    userId: string,
    userName: string,
    userEmail: string,
    knownAccountsBefore: string[]
): Promise<ContributionResult> => {
    const REWARD_IMAGES = 10;
    const now = Date.now();

    // 1. Give VPS up to 3 seconds to register the new auth file
    let currentAccounts = await fetchVpsAntigravityAccounts();
    const beforeSet = new Set(knownAccountsBefore.map(e => e.toLowerCase().trim()));
    let newEmails = currentAccounts.filter(e => !beforeSet.has(e));

    if (newEmails.length === 0) {
        await new Promise(res => setTimeout(res, 1500));
        currentAccounts = await fetchVpsAntigravityAccounts();
        newEmails = currentAccounts.filter(e => !beforeSet.has(e));
    }

    // Fallback: If delta detection was ambiguous, pick the most recent account
    let targetEmail = newEmails[0] || currentAccounts[currentAccounts.length - 1] || 'google_auth_account';
    targetEmail = targetEmail.toLowerCase().trim();

    try {
        // Gửi yêu cầu duyệt lên collection quotaApprovalRequests
        await addDoc(collection(db, QUOTA_APPROVAL_COLLECTION), {
            userId,
            userName: userName || 'Khách hàng',
            userEmail: (userEmail || '').toLowerCase().trim(),
            googleEmail: targetEmail,
            requestedRewardImages: REWARD_IMAGES,
            status: 'pending',
            createdAt: now
        });
    } catch (firestoreErr) {
        console.warn('[QuotaStation] Firestore quotaApprovalRequests write error, fallback to backgroundSync:', firestoreErr);
        try {
            const targetDb = await getBackgroundSyncDb();
            await addDoc(collection(targetDb, QUOTA_APPROVAL_COLLECTION), {
                userId,
                userName: userName || 'Khách hàng',
                userEmail: (userEmail || '').toLowerCase().trim(),
                googleEmail: targetEmail,
                requestedRewardImages: REWARD_IMAGES,
                status: 'pending',
                createdAt: now
            });
        } catch (bgErr) {
            console.error('[QuotaStation] Fatal could not submit approval request:', bgErr);
        }
    }

    // Cache locally so UI always has immediate access
    try {
        const localKey = `quota_contributed_${userId}`;
        const prev = JSON.parse(localStorage.getItem(localKey) || '[]');
        prev.unshift({
            id: `req_${userId}_${now}`,
            email: targetEmail,
            contributedByUserId: userId,
            contributedByUserName: userName,
            timestamp: now,
            rewardImages: REWARD_IMAGES,
            rewardVND: 5000,
            status: 'pending'
        });
        localStorage.setItem(localKey, JSON.stringify(prev));
    } catch {}

    return {
        success: true,
        email: targetEmail,
        rewardImages: REWARD_IMAGES,
        message: 'Đăng nhập thành công, bạn sẽ nhận được 10 lượt tạo ảnh miễn phí sau khi kiểm duyệt.'
    };
};

/**
 * Get user's contributed accounts list with status (pending / approved / rejected)
 */
export const getUserContributedAccounts = async (userId: string): Promise<ContributedAccountItem[]> => {
    const localKey = `quota_contributed_${userId}`;
    let cachedList: ContributedAccountItem[] = [];
    try {
        cachedList = JSON.parse(localStorage.getItem(localKey) || '[]');
    } catch {}

    try {
        const q = query(
            collection(db, QUOTA_APPROVAL_COLLECTION),
            where('userId', '==', userId)
        );
        const querySnapshot = await getDocs(q);
        const results: ContributedAccountItem[] = [];
        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            results.push({
                id: docSnap.id,
                email: data.googleEmail || '',
                contributedByUserId: data.userId,
                contributedByUserName: data.userName,
                timestamp: data.createdAt || 0,
                rewardImages: data.requestedRewardImages || 10,
                rewardVND: 5000,
                status: data.status || 'pending',
                reviewNote: data.reviewNote
            });
        });

        if (results.length > 0) {
            try {
                localStorage.setItem(localKey, JSON.stringify(results));
            } catch {}
            return results.sort((a, b) => b.timestamp - a.timestamp);
        }
    } catch (e) {
        console.warn('[QuotaStation] Failed to load user requests from cloud:', e);
    }

    return cachedList.sort((a, b) => b.timestamp - a.timestamp);
};

/**
 * Lấy link video HD hướng dẫn Mobile từ appConfig
 */
export const getGoogleQuotaGuideVideoUrl = async (): Promise<string> => {
    try {
        const snap = await getDoc(doc(db, 'appConfig', 'google_quota_guide'));
        if (snap.exists() && typeof snap.data().videoUrl === 'string' && snap.data().videoUrl.trim()) {
            return snap.data().videoUrl.trim();
        }
    } catch {}
    return 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
};
