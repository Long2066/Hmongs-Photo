/**
 * Service tích hợp Google Flow AI (Veo 3.1) từ local flow-py-main server (cổng 8100)
 */

export interface VideoGenerationParams {
    prompt: string;
    aspectRatio: '16:9' | '9:16';
    model?: string;
    outputCount?: number;
    inputImageBase64?: string; // Tùy chọn: dùng cho chế độ Image -> Video
    onProgress?: (status: string, elapsedSeconds: number) => void;
}

export interface FlowPoolAccount {
    id: string;
    label: string;
    project_id?: string | null;
    cookie_count: number;
    enabled: boolean;
    added_at?: number;
}

export interface VideoServerHealth {
    online: boolean;
    engine?: string;
    backendMode?: string;
    activeBackend?: string;
    authenticated?: boolean;
    email?: string | null;
    projectId?: string | null;
    credits?: number | null;
    tier?: string | null;
    loginInProgress?: boolean;
    authError?: string | null;
    error?: string;
}

const DEFAULT_SERVER_URL = 'http://localhost:8100';

export const getVideoServerUrl = (): string => {
    return localStorage.getItem('gemini_video_server_url') || DEFAULT_SERVER_URL;
};

export const setVideoServerUrl = (url: string): void => {
    localStorage.setItem('gemini_video_server_url', url.replace(/\/+$/, ''));
};

/**
 * Kiểm tra kết nối và trạng thái xác thực tới server local flow-py-main
 */
export const checkVideoServerHealth = async (refresh: boolean = false): Promise<VideoServerHealth> => {
    const baseUrl = getVideoServerUrl();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const url = refresh ? `${baseUrl}/health?refresh=true` : `${baseUrl}/health`;
        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            return { online: false, error: `HTTP ${response.status}` };
        }

        const data = await response.json();
        return {
            online: data.status === 'ok',
            engine: data.engine || 'flow-py',
            backendMode: data.backend_mode,
            activeBackend: data.active_backend,
            authenticated: !!data.authenticated,
            email: data.email || null,
            projectId: data.project_id || null,
            credits: typeof data.credits === 'number' ? data.credits : null,
            tier: data.tier || null,
            loginInProgress: !!data.login_in_progress,
            authError: data.auth_error || null,
        };
    } catch (err: any) {
        return {
            online: false,
            error: err.name === 'AbortError' ? 'Timeout kết nối' : 'Server chưa bật (cổng 8100)'
        };
    }
};

/**
 * Mở cửa sổ trình duyệt để đăng nhập Google Flow 1 lần (lưu session tự động)
 */
export const triggerFlowBrowserLogin = async (): Promise<{ status: string; message: string }> => {
    const baseUrl = getVideoServerUrl();
    const resp = await fetch(`${baseUrl}/v1/auth/login`, {
        method: 'POST',
    });
    if (!resp.ok) {
        throw new Error(`Không thể mở trình duyệt đăng nhập (${resp.status})`);
    }
    return await resp.json();
};

/**
 * Thiết lập Project ID cho Google Flow
 */
export const setFlowProjectId = async (projectId: string): Promise<any> => {
    const baseUrl = getVideoServerUrl();
    const resp = await fetch(`${baseUrl}/v1/auth/project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
    });
    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(err || 'Không thể lưu Project ID');
    }
    return await resp.json();
};

/**
 * Phân tích chuỗi Cookie (từ Cookie-Editor JSON hoặc Header) thành danh sách cookie object
 */
export const parseRawCookies = (rawCookieText: string): any[] => {
    let cookies: any[] = [];
    const trimmed = rawCookieText.trim();
    if (!trimmed) return cookies;

    if (trimmed.startsWith('[')) {
        cookies = JSON.parse(trimmed);
    } else if (trimmed.startsWith('{')) {
        cookies = [JSON.parse(trimmed)];
    } else {
        const parts = trimmed.split(/[;\n]+/).map(s => s.trim()).filter(Boolean);
        for (const p of parts) {
            if (p.includes('=')) {
                const [k, ...rest] = p.split('=');
                cookies.push({
                    name: k.trim(),
                    value: rest.join('=').trim(),
                    domain: '.google.com',
                    path: '/',
                    secure: true,
                });
            }
        }
    }
    return cookies;
};

export const getSavedUserFlowCookies = (): string => {
    return localStorage.getItem('flow_user_raw_cookies') || '';
};

export const setSavedUserFlowCookies = (raw: string): void => {
    if (!raw.trim()) {
        localStorage.removeItem('flow_user_raw_cookies');
    } else {
        localStorage.setItem('flow_user_raw_cookies', raw.trim());
    }
};

export const getSavedUserFlowProjectId = (): string => {
    return localStorage.getItem('flow_user_project_id') || '';
};

export const setSavedUserFlowProjectId = (pid: string): void => {
    if (!pid.trim()) {
        localStorage.removeItem('flow_user_project_id');
    } else {
        localStorage.setItem('flow_user_project_id', pid.trim());
    }
};

/**
 * Đồng bộ Cookie từ Cookie-Editor (JSON) hoặc chuỗi Cookie sang Google Flow Server
 */
export const syncFlowCookiesRaw = async (rawCookieText: string, projectId?: string): Promise<any> => {
    const baseUrl = getVideoServerUrl();
    const cookies = parseRawCookies(rawCookieText);
    setSavedUserFlowCookies(rawCookieText);
    if (projectId !== undefined) {
        setSavedUserFlowProjectId(projectId);
    }

    const resp = await fetch(`${baseUrl}/v1/auth/cookies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            cookies,
            project_id: projectId?.trim() || getSavedUserFlowProjectId() || undefined,
        }),
    });
    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(err || 'Không thể đồng bộ Cookie');
    }
    return await resp.json();
};

/**
 * Lấy danh sách các tài khoản trong Hồ sơ xoay vòng (Account Pool) trên Server
 */
export const getFlowAccountsPool = async (): Promise<FlowPoolAccount[]> => {
    const baseUrl = getVideoServerUrl();
    try {
        const resp = await fetch(`${baseUrl}/v1/auth/accounts-pool`);
        if (!resp.ok) return [];
        const data = await resp.json();
        return Array.isArray(data.accounts) ? data.accounts : [];
    } catch {
        return [];
    }
};

/**
 * Thêm 1 tài khoản (từ Cookie JSON/Header) vào Hồ sơ xoay vòng
 */
export const addAccountToFlowPool = async (label: string, rawCookieText: string, projectId?: string): Promise<any> => {
    const baseUrl = getVideoServerUrl();
    const cookies = parseRawCookies(rawCookieText);
    if (!cookies.length) {
        throw new Error('Cookie không hợp lệ hoặc trống.');
    }
    const resp = await fetch(`${baseUrl}/v1/auth/accounts-pool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            label: label.trim() || `Acc Flow`,
            cookies,
            project_id: projectId?.trim() || undefined,
        }),
    });
    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(err || 'Không thể thêm tài khoản vào Pool');
    }
    return await resp.json();
};

/**
 * Lưu nhanh phiên trình duyệt Chrome đang đăng nhập hiện tại vào Hồ sơ xoay vòng
 */
export const snapshotCurrentBrowserToFlowPool = async (label?: string): Promise<any> => {
    const baseUrl = getVideoServerUrl();
    const q = label?.trim() ? `?label=${encodeURIComponent(label.trim())}` : '';
    const resp = await fetch(`${baseUrl}/v1/auth/accounts-pool/snapshot${q}`, {
        method: 'POST',
    });
    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(err || 'Không thể lưu phiên trình duyệt hiện tại vào Pool');
    }
    return await resp.json();
};

/**
 * Xoá 1 tài khoản khỏi Hồ sơ xoay vòng
 */
export const removeAccountFromFlowPool = async (accId: string): Promise<any> => {
    const baseUrl = getVideoServerUrl();
    const resp = await fetch(`${baseUrl}/v1/auth/accounts-pool/${accId}`, {
        method: 'DELETE',
    });
    if (!resp.ok) {
        throw new Error('Không thể xoá tài khoản khỏi Pool');
    }
    return await resp.json();
};

/**
 * Khởi tạo tác vụ tạo video (Text->Video hoặc Image->Video) qua flow-py và thăm dò kết quả
 */
export const generateVideo = async (params: VideoGenerationParams): Promise<{ url: string; urls: string[]; bytes?: number }> => {
    const baseUrl = getVideoServerUrl();
    const { prompt, aspectRatio, model, outputCount, inputImageBase64, onProgress } = params;

    // 1. Tạo request payload
    const bodyPayload: Record<string, any> = {
        prompt: prompt.trim(),
        aspect_ratio: aspectRatio,
        count: outputCount || 1,
    };
    if (model && model !== 'auto') {
        bodyPayload.model = model;
    }

    // Nếu user có lưu Cookie / Project ID riêng trên trình duyệt thì đính kèm theo request
    const savedRawCookies = getSavedUserFlowCookies();
    if (savedRawCookies) {
        try {
            const parsed = parseRawCookies(savedRawCookies);
            if (parsed.length > 0) {
                bodyPayload.cookies = parsed;
            }
        } catch {
            // ignore invalid saved cookies
        }
    }
    const savedPid = getSavedUserFlowProjectId();
    if (savedPid) {
        bodyPayload.project_id = savedPid;
    }

    // Nếu có ảnh đầu vào (Image -> Video)
    if (inputImageBase64) {
        const formattedImage = inputImageBase64.startsWith('data:')
            ? inputImageBase64
            : `data:image/png;base64,${inputImageBase64}`;
        bodyPayload.images = [formattedImage];
    }

    onProgress?.('Đang gửi yêu cầu tới Google Flow (Veo 3.1)...', 0);

    let createResp: Response;
    try {
        createResp = await fetch(`${baseUrl}/v1/videos/generations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload),
        });
    } catch (err: any) {
        throw new Error(`Không thể kết nối tới Server Flow (${baseUrl}). Vui lòng đảm bảo server flow-py-main đang chạy.`);
    }

    if (!createResp.ok) {
        const errorText = await createResp.text();
        let errMsg = `Lỗi khởi tạo (${createResp.status})`;
        try {
            const errJson = JSON.parse(errorText);
            if (errJson.detail) errMsg = errJson.detail;
        } catch {
            if (errorText) errMsg = errorText;
        }
        throw new Error(errMsg);
    }

    const jobData = await createResp.json();
    const jobId = jobData.id;
    if (!jobId) {
        throw new Error('Server không trả về Job ID hợp lệ.');
    }

    // 2. Vòng lặp Polling kiểm tra trạng thái
    const startTime = Date.now();
    const POLL_INTERVAL = 4000; // mỗi 4s check 1 lần
    const MAX_WAIT_TIME = 650000; // tối đa ~10 phút

    while (Date.now() - startTime < MAX_WAIT_TIME) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
        const elapsed = Math.round((Date.now() - startTime) / 1000);

        try {
            const pollResp = await fetch(`${baseUrl}/v1/videos/generations/${jobId}`);
            if (!pollResp.ok) continue;

            const job = await pollResp.json();
            const status = job.status;

            if (status === 'completed') {
                const finalUrl = job.url || job.download_url;
                const finalUrls: string[] = Array.isArray(job.urls) && job.urls.length > 0 ? job.urls : (finalUrl ? [finalUrl] : []);
                if (!finalUrl && finalUrls.length === 0) {
                    throw new Error('Video đã hoàn thành nhưng không tìm thấy URL tải về.');
                }
                onProgress?.('Hoàn tất! Đang tải video...', elapsed);
                return {
                    url: finalUrls[0] || finalUrl,
                    urls: finalUrls,
                    bytes: job.bytes,
                };
            }

            if (status === 'failed') {
                throw new Error(job.error || 'Quá trình tạo video thất bại từ Google Flow.');
            }

            const statusText = job.progress_text || `Google Flow (Veo 3.1) đang render video (${elapsed}s)...`;
            onProgress?.(statusText, elapsed);
        } catch (pollErr: any) {
            if (pollErr.message && !pollErr.message.includes('fetch')) {
                throw pollErr;
            }
        }
    }

    throw new Error('Thời gian render video vượt quá giới hạn (Timeout). Vui lòng thử lại sau.');
};
