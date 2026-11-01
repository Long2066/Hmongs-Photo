/**
 * Fal.ai Video AI Integration Service
 * 
 * Provides direct cloud-based Text-to-Video and Image-to-Video generation
 * via Fal.ai API (LTX-Video, HunyuanVideo).
 * 1-click login with Google/GitHub, zero real-name verification, 100% global.
 */

export interface FalVideoParams {
    prompt: string;
    aspectRatio: '16:9' | '9:16';
    model?: string;
    inputImageBase64?: string;
    outputCount?: number;
    onProgress?: (status: string, elapsedSeconds: number) => void;
}

export interface FalVideoResult {
    url: string;
    urls: string[];
    duration?: number;
}

export interface FalUserInfo {
    ok: boolean;
    name?: string;
    error?: string;
}

const FAL_KEY_STORAGE = 'fal_api_key';
const FAL_MODEL_STORAGE = 'fal_video_model';

export const FAL_MODELS = [
    {
        id: 'fal-ai/ltx-video',
        i2vId: 'fal-ai/ltx-video/image-to-video',
        name: 'LTX-Video (Khuyên dùng)',
        badge: 'Siêu tốc 5s',
        desc: 'Tốc độ cực nhanh ~5-10s, chuyển động nhân vật sắc nét, hỗ trợ cả Text & Ảnh sang Video',
        supportI2V: true,
    },
    {
        id: 'fal-ai/hunyuan-video',
        i2vId: 'fal-ai/hunyuan-video',
        name: 'HunyuanVideo (Tencent)',
        badge: 'Điện ảnh cao cấp',
        desc: 'Độ nét và chi tiết cinematic đỉnh cao từ Tencent',
        supportI2V: false,
    },
];

export const getFalApiKey = (): string => {
    return localStorage.getItem(FAL_KEY_STORAGE) || '';
};

export const setFalApiKey = (key: string): void => {
    const trimmed = key.trim();
    if (!trimmed) {
        localStorage.removeItem(FAL_KEY_STORAGE);
    } else {
        localStorage.setItem(FAL_KEY_STORAGE, trimmed);
    }
};

export const getSavedFalModel = (): string => {
    return localStorage.getItem(FAL_MODEL_STORAGE) || 'fal-ai/ltx-video';
};

export const setSavedFalModel = (modelId: string): void => {
    localStorage.setItem(FAL_MODEL_STORAGE, modelId);
};

/**
 * Kiểm tra tính hợp lệ của Fal.ai API Key
 */
export const checkFalUser = async (apiKeyOverride?: string): Promise<FalUserInfo> => {
    const apiKey = (apiKeyOverride || getFalApiKey()).trim();
    if (!apiKey) {
        return { ok: false, error: 'Chưa nhập API Key Fal.ai' };
    }

    try {
        // Test key against queue endpoint with dummy request
        const resp = await fetch('https://queue.fal.run/fal-ai/ltx-video', {
            method: 'POST',
            headers: {
                'Authorization': `Key ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
        });

        if (resp.status === 401 || resp.status === 403) {
            return { ok: false, error: 'API Key Fal.ai không hợp lệ hoặc đã hết hạn.' };
        }

        // Status 422 (validation error on empty body) means key is valid and authorized!
        // Status 200/201 also means authorized
        if (resp.status === 422 || resp.status === 200 || resp.status === 201) {
            return {
                ok: true,
                name: 'Fal.ai Cloud Account',
            };
        }

        const data = await resp.json().catch(() => ({}));
        if (data.detail && typeof data.detail === 'string' && data.detail.toLowerCase().includes('key')) {
            return { ok: false, error: data.detail };
        }

        return {
            ok: true,
            name: 'Fal.ai Cloud Account',
        };
    } catch (err: any) {
        return { ok: false, error: err?.message || 'Không thể kết nối đến máy chủ Fal.ai' };
    }
};

/**
 * Tạo Video qua Cloud API Fal.ai (Text-to-Video & Image-to-Video)
 */
export const generateFalVideo = async (params: FalVideoParams): Promise<FalVideoResult> => {
    const { prompt, aspectRatio, model, inputImageBase64, onProgress } = params;
    const apiKey = getFalApiKey().trim();

    if (!apiKey) {
        throw new Error('Vui lòng nhập API Key Fal.ai để tạo video. Bấm vào phần cấu hình để lấy Key (đăng nhập Google 1 click tại fal.ai/dashboard/keys).');
    }

    const isImageMode = !!inputImageBase64;
    const chosenModelDef = FAL_MODELS.find(m => m.id === model) || FAL_MODELS[0];
    const endpointId = isImageMode && chosenModelDef.i2vId ? chosenModelDef.i2vId : chosenModelDef.id;

    const queueUrl = `https://queue.fal.run/${endpointId}`;

    // Payload configuration
    const payload: Record<string, any> = {
        prompt: prompt.trim(),
    };

    if (isImageMode && inputImageBase64) {
        let formattedImage = inputImageBase64.trim();
        if (!formattedImage.startsWith('data:')) {
            formattedImage = `data:image/jpeg;base64,${formattedImage}`;
        }
        payload.image_url = formattedImage;
    } else {
        payload.aspect_ratio = aspectRatio;
    }

    onProgress?.('Đang gửi lệnh tạo video tới Fal.ai Cloud...', 0);

    // 1. Submit to Fal.ai Queue
    let submitResp: Response;
    try {
        submitResp = await fetch(queueUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
    } catch (netErr: any) {
        throw new Error(`Lỗi kết nối mạng tới Fal.ai: ${netErr.message || netErr}`);
    }

    if (!submitResp.ok) {
        const errJson = await submitResp.json().catch(() => ({}));
        const errMsg = errJson.detail || `Lỗi Submit (${submitResp.status})`;
        if (submitResp.status === 401 || submitResp.status === 403) {
            throw new Error('API Key Fal.ai không hợp lệ. Vui lòng kiểm tra lại tại fal.ai/dashboard/keys');
        }
        throw new Error(`Fal.ai từ chối lệnh: ${errMsg}`);
    }

    const queueData = await submitResp.json();
    const statusUrl = queueData.status_url;
    const responseUrl = queueData.response_url;

    if (!statusUrl || !responseUrl) {
        // Direct response fallback
        if (queueData.video?.url) {
            return {
                url: queueData.video.url,
                urls: [queueData.video.url],
            };
        }
        throw new Error('Fal.ai không trả về URL tác vụ hợp lệ.');
    }

    // 2. Poll Status
    const startTime = Date.now();
    const POLL_INTERVAL = 2500;
    const MAX_WAIT_MS = 360000; // 6 phút

    while (Date.now() - startTime < MAX_WAIT_MS) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
        const elapsed = Math.round((Date.now() - startTime) / 1000);

        let statusResp: Response;
        try {
            statusResp = await fetch(statusUrl, {
                headers: {
                    'Authorization': `Key ${apiKey}`,
                },
            });
        } catch {
            continue;
        }

        if (!statusResp.ok) continue;

        const sData = await statusResp.json().catch(() => ({}));
        const status = (sData.status || '').toUpperCase();

        if (status === 'COMPLETED') {
            // Fetch final result
            const resResp = await fetch(responseUrl, {
                headers: {
                    'Authorization': `Key ${apiKey}`,
                },
            });
            const resData = await resResp.json().catch(() => ({}));
            const videoUrl = resData.video?.url || resData.video_url || resData.url;

            if (!videoUrl) {
                throw new Error('Video đã render xong nhưng không tìm thấy URL tải về.');
            }

            onProgress?.('Hoàn tất! Đang hiển thị video...', elapsed);
            return {
                url: videoUrl,
                urls: [videoUrl],
                duration: elapsed,
            };
        }

        if (status === 'FAILED') {
            const reason = sData.error || 'Fal.ai báo lỗi render video.';
            throw new Error(reason);
        }

        const modelShortName = chosenModelDef.name.split(' ')[0] || 'LTX';
        onProgress?.(`Fal.ai Cloud (${modelShortName}) đang xử lý (${elapsed}s)...`, elapsed);
    }

    throw new Error('Thời gian tạo video trên Fal.ai vượt quá giới hạn (Timeout). Vui lòng thử lại sau.');
};
