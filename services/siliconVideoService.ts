/**
 * SiliconFlow Video AI Integration Service
 * 
 * Provides direct cloud-based Text-to-Video and Image-to-Video generation
 * via SiliconFlow API (LTX-Video, HunyuanVideo, CogVideoX).
 * Runs 100% on cloud without needing local Chrome or Python server.
 */

export interface SiliconVideoParams {
    prompt: string;
    aspectRatio: '16:9' | '9:16';
    model?: string;
    inputImageBase64?: string;
    outputCount?: number;
    onProgress?: (status: string, elapsedSeconds: number) => void;
}

export interface SiliconVideoResult {
    url: string;
    urls: string[];
    duration?: number;
}

export interface SiliconUserInfo {
    ok: boolean;
    name?: string;
    email?: string;
    balance?: string;
    error?: string;
}

const SILICONFLOW_API_BASE = 'https://api.siliconflow.cn/v1';
const SILICONFLOW_KEY_STORAGE = 'siliconflow_api_key';
const SILICONFLOW_MODEL_STORAGE = 'siliconflow_video_model';

export const SILICON_MODELS = [
    {
        id: 'Lightricks/LTX-Video',
        name: 'LTX-Video (Khuyên dùng)',
        badge: 'Siêu tốc 5s',
        desc: 'Tốc độ cực nhanh ~5s, chi phí siêu rẻ ~250đ/video, tối ưu cho người & chuyển động',
        supportI2V: true,
    },
    {
        id: 'tencent/HunyuanVideo',
        name: 'HunyuanVideo (Tencent)',
        badge: 'Điện ảnh cao cấp',
        desc: 'Model video mã nguồn mở mạnh nhất thế giới, độ nét và chi tiết cinematic đỉnh cao',
        supportI2V: false,
    },
    {
        id: 'THUDM/CogVideoX-5b',
        name: 'CogVideoX-5B',
        badge: 'Mượt mà',
        desc: 'Model nổi tiếng từ Tsinghua, chuyển động êm dịu và tự nhiên',
        supportI2V: true,
        i2vId: 'THUDM/CogVideoX-5b-I2V',
    },
];

export const getSiliconFlowApiKey = (): string => {
    return localStorage.getItem(SILICONFLOW_KEY_STORAGE) || '';
};

export const setSiliconFlowApiKey = (key: string): void => {
    const trimmed = key.trim();
    if (!trimmed) {
        localStorage.removeItem(SILICONFLOW_KEY_STORAGE);
    } else {
        localStorage.setItem(SILICONFLOW_KEY_STORAGE, trimmed);
    }
};

export const getSavedSiliconModel = (): string => {
    return localStorage.getItem(SILICONFLOW_MODEL_STORAGE) || 'Lightricks/LTX-Video';
};

export const setSavedSiliconModel = (modelId: string): void => {
    localStorage.setItem(SILICONFLOW_MODEL_STORAGE, modelId);
};

/**
 * Kiểm tra kết nối và số dư tài khoản SiliconFlow
 */
export const checkSiliconFlowUser = async (apiKeyOverride?: string): Promise<SiliconUserInfo> => {
    const apiKey = (apiKeyOverride || getSiliconFlowApiKey()).trim();
    if (!apiKey) {
        return { ok: false, error: 'Chưa nhập API Key SiliconFlow' };
    }

    try {
        const resp = await fetch(`${SILICONFLOW_API_BASE}/user/info`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });

        if (!resp.ok) {
            if (resp.status === 401 || resp.status === 403) {
                return { ok: false, error: 'API Key không hợp lệ hoặc đã hết hạn.' };
            }
            return { ok: false, error: `Lỗi máy chủ (${resp.status})` };
        }

        const resData = await resp.json();
        if (resData.code !== 20000 && resData.code !== 0 && !resData.data) {
            return { ok: false, error: resData.message || 'Key không hợp lệ' };
        }

        const u = resData.data || resData;
        const bal = u.balance !== undefined ? String(u.balance) : (u.totalBalance !== undefined ? String(u.totalBalance) : 'Khả dụng');
        return {
            ok: true,
            name: u.name || u.username || 'Silicon User',
            email: u.email,
            balance: bal,
        };
    } catch (err: any) {
        return { ok: false, error: err?.message || 'Không thể kết nối đến máy chủ SiliconFlow' };
    }
};

/**
 * Tạo Video qua Cloud API SiliconFlow (Text-to-Video & Image-to-Video)
 */
export const generateSiliconVideo = async (params: SiliconVideoParams): Promise<SiliconVideoResult> => {
    const { prompt, aspectRatio, model, inputImageBase64, onProgress } = params;
    const apiKey = getSiliconFlowApiKey().trim();

    if (!apiKey) {
        throw new Error('Vui lòng nhập API Key SiliconFlow để tạo video. Bấm vào phần cấu hình để dán Key (hoặc đăng ký miễn phí tại cloud.siliconflow.cn nhận 14 triệu tokens).');
    }

    // 1. Xác định model & endpoint
    let chosenModel = model || getSavedSiliconModel();
    const isImageMode = !!inputImageBase64;

    // Special handling for CogVideoX I2V
    if (isImageMode && chosenModel === 'THUDM/CogVideoX-5b') {
        chosenModel = 'THUDM/CogVideoX-5b-I2V';
    }

    // Map aspect ratio to image_size
    const imageSize = aspectRatio === '9:16' ? '720x1280' : '1280x720';

    // 2. Chuẩn bị payload submit
    const submitBody: Record<string, any> = {
        model: chosenModel,
        prompt: prompt.trim(),
        image_size: imageSize,
    };

    if (isImageMode && inputImageBase64) {
        let formattedImage = inputImageBase64.trim();
        if (!formattedImage.startsWith('data:')) {
            formattedImage = `data:image/jpeg;base64,${formattedImage}`;
        }
        submitBody.image = formattedImage;
    }

    onProgress?.('Đang gửi lệnh tạo video tới SiliconFlow Cloud...', 0);

    // 3. Gửi lệnh Submit
    let submitResp: Response;
    try {
        submitResp = await fetch(`${SILICONFLOW_API_BASE}/video/submit`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(submitBody),
        });
    } catch (netErr: any) {
        throw new Error(`Lỗi kết nối mạng tới SiliconFlow: ${netErr.message || netErr}`);
    }

    const submitJson = await submitResp.json().catch(() => ({}));
    if (!submitResp.ok || (submitJson.code && submitJson.code !== 20000 && submitJson.code !== 0)) {
        const msg = submitJson.message || `Lỗi Submit (${submitResp.status})`;
        if (submitJson.code === 30014 || submitResp.status === 401) {
            throw new Error('API Key SiliconFlow không hợp lệ hoặc đã hết hạn.');
        }
        if (submitJson.code === 20015 || msg.toLowerCase().includes('balance')) {
            throw new Error('Tài khoản SiliconFlow của bạn đã hết số dư.');
        }
        throw new Error(`SiliconFlow từ chối lệnh: ${msg}`);
    }

    const requestId = submitJson.requestId || submitJson.data?.requestId || submitJson.task_id || submitJson.id;
    if (!requestId) {
        throw new Error('SiliconFlow không trả về mã tác vụ (requestId) hợp lệ.');
    }

    // 4. Polling trạng thái qua /video/status
    const startTime = Date.now();
    const POLL_INTERVAL = 3000; // mỗi 3 giây check 1 lần
    const MAX_WAIT_MS = 360000; // tối đa 6 phút

    while (Date.now() - startTime < MAX_WAIT_MS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
        const elapsed = Math.round((Date.now() - startTime) / 1000);

        let statusResp: Response;
        try {
            statusResp = await fetch(`${SILICONFLOW_API_BASE}/video/status`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ requestId }),
            });
        } catch {
            continue; // Bỏ qua lỗi mạng tạm thời trong lúc poll
        }

        if (!statusResp.ok) continue;

        const statusJson = await statusResp.json().catch(() => ({}));
        const sData = statusJson.data || statusJson;
        const taskStatus = (sData.status || '').toLowerCase();

        if (taskStatus === 'succeed' || taskStatus === 'success') {
            const videos = sData.results?.videos || sData.videos || [];
            let videoUrl = videos[0]?.url || sData.results?.url || sData.url;

            if (!videoUrl) {
                throw new Error('Video đã render xong nhưng không tìm thấy URL tải về.');
            }

            onProgress?.('Hoàn tất! Đang tải video...', elapsed);
            return {
                url: videoUrl,
                urls: [videoUrl],
                duration: elapsed,
            };
        }

        if (taskStatus === 'failed') {
            const reason = sData.reason || statusJson.message || 'SiliconFlow báo lỗi render video.';
            throw new Error(reason);
        }

        const modelShortName = chosenModel.split('/').pop() || 'AI';
        onProgress?.(`SiliconFlow (${modelShortName}) đang xử lý (${elapsed}s)...`, elapsed);
    }

    throw new Error('Thời gian tạo video trên SiliconFlow vượt quá giới hạn (Timeout). Vui lòng thử lại sau.');
};
