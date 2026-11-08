import {
    getVideoConfig,
    getVideoModelMeta,
    OPENROUTER_VIDEO_MODELS
} from './videoConfigService';

export interface GenerateOpenRouterVideoOptions {
    prompt: string;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    duration?: number; // 3, 5, 10, 15
    modelOverride?: string;
    inputImageBase64?: string;
    outputCount?: number;
    onProgress?: (status: string) => void;
}

export interface GenerateOpenRouterVideoResult {
    url: string;
    urls: string[];
    modelUsed: string;
    duration: number;
    aspectRatio: string;
    prompt: string;
}

const OPENROUTER_VIDEOS_ENDPOINT = 'https://openrouter.ai/api/v1/videos';

/**
 * Trích xuất URL video từ phản hồi trạng thái của OpenRouter Video Generation API (/api/v1/videos)
 */
export const extractVideoFromResponse = (data: any): string | null => {
    if (!data) return null;

    if (Array.isArray(data.urls) && data.urls.length > 0 && typeof data.urls[0] === 'string') {
        return data.urls[0];
    }

    if (Array.isArray(data.data) && data.data.length > 0) {
        const item = data.data[0];
        if (typeof item.url === 'string') return item.url;
        if (typeof item.b64_json === 'string') {
            return `data:video/mp4;base64,${item.b64_json}`;
        }
    }

    if (Array.isArray(data.unsigned_urls) && data.unsigned_urls.length > 0 && typeof data.unsigned_urls[0] === 'string') {
        return data.unsigned_urls[0];
    }

    return null;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Tải nội dung MP4 nhị phân từ endpoint yêu cầu xác thực Bearer và chuyển sang Blob URL
 */
const fetchAuthorizedVideoAsBlobUrl = async (videoContentUrl: string, apiKey: string): Promise<string> => {
    const resp = await fetch(videoContentUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey.trim()}`,
            'HTTP-Referer': 'https://vip-imagetools.vercel.app',
            'X-Title': 'ImageTool Video AI Studio'
        }
    });
    if (!resp.ok) {
        throw new Error(`Không thể tải luồng video từ OpenRouter (HTTP ${resp.status}).`);
    }
    const blob = await resp.blob();
    const mp4Blob = blob.type.startsWith('video/') ? blob : new Blob([blob], { type: 'video/mp4' });
    return URL.createObjectURL(mp4Blob);
};

/**
 * Gửi một lượt yêu cầu tạo video bất đồng bộ tới OpenRouter (/api/v1/videos) và poll kết quả
 */
const executeOpenRouterVideoCall = async (
    modelId: string,
    apiKey: string,
    options: GenerateOpenRouterVideoOptions,
    aspectRatio: '16:9' | '9:16' | '1:1',
    duration: number
): Promise<string> => {
    const meta = getVideoModelMeta(modelId);
    const cleanPrompt = options.prompt.trim() || 'Smooth cinematic camera motion, natural movement, high quality';

    // Đảm bảo tỷ lệ khung hình nằm trong danh sách hỗ trợ của model
    const validAspectRatio = meta.supportedAspectRatios.includes(aspectRatio)
        ? aspectRatio
        : meta.supportedAspectRatios[0];

    // Đảm bảo thời lượng nằm trong danh sách hỗ trợ của model
    const validDuration = meta.supportedDurations.includes(duration)
        ? duration
        : meta.supportedDurations.reduce((prev, curr) =>
            Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev
        );

    const payload: Record<string, any> = {
        model: meta.id,
        prompt: cleanPrompt,
        aspect_ratio: validAspectRatio,
        duration: validDuration,
        resolution: meta.defaultResolution
    };

    if (meta.supportsAudio) {
        payload.generate_audio = true;
    }

    if (options.inputImageBase64) {
        let imageUrl = options.inputImageBase64.trim();
        if (!imageUrl.startsWith('data:') && !imageUrl.startsWith('http')) {
            const detectedMime = imageUrl.startsWith('/9j/') ? 'image/jpeg' : 'image/png';
            imageUrl = `data:${detectedMime};base64,${imageUrl}`;
        }
        payload.frame_images = [
            {
                type: 'image_url',
                frame_type: 'first_frame',
                image_url: {
                    url: imageUrl
                }
            }
        ];
    }

    const headers = {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'HTTP-Referer': 'https://vip-imagetools.vercel.app',
        'X-Title': 'ImageTool Video AI Studio',
        'Content-Type': 'application/json'
    };

    // Bước 1: Khởi tạo tiến trình tạo video (POST /api/v1/videos)
    const submitController = new AbortController();
    const submitTimeout = setTimeout(() => submitController.abort(), 60000);

    let submitData: any;
    try {
        const submitResp = await fetch(OPENROUTER_VIDEOS_ENDPOINT, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: submitController.signal
        });
        clearTimeout(submitTimeout);

        if (!submitResp.ok) {
            let errorDetail = `HTTP ${submitResp.status}`;
            try {
                const errJson = await submitResp.json();
                errorDetail = errJson?.error?.message || JSON.stringify(errJson?.error || errJson) || errorDetail;
            } catch {
                // Ignore json parse error
            }
            throw new Error(`[${meta.shortName}] ${errorDetail}`);
        }

        const rawText = await submitResp.text();
        submitData = JSON.parse(rawText.trim());
    } catch (err: any) {
        clearTimeout(submitTimeout);
        if (err.name === 'AbortError') {
            throw new Error(`Quá thời gian chờ khi gửi yêu cầu tới ${meta.shortName}.`);
        }
        throw err;
    }

    if (submitData?.status === 'completed' && Array.isArray(submitData.urls) && submitData.urls[0]) {
        return submitData.urls[0];
    }

    const jobId = submitData?.id;
    if (!jobId) {
        throw new Error(`OpenRouter (${meta.shortName}) không trả về mã tiến trình tạo video (Job ID).`);
    }

    const pollUrl = submitData?.polling_url
        ? (submitData.polling_url.startsWith('http')
            ? submitData.polling_url
            : `https://openrouter.ai${submitData.polling_url.startsWith('/') ? '' : '/'}${submitData.polling_url}`)
        : `${OPENROUTER_VIDEOS_ENDPOINT}/${encodeURIComponent(jobId)}`;

    // Bước 2: Poll trạng thái tiến trình (GET /api/v1/videos/{id})
    const maxAttempts = 75; // 75 * 4s = 300s (5 phút tối đa)

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await sleep(4000);
        const elapsedSec = attempt * 4;
        options.onProgress?.(`Đang kết xuất video trên ${meta.shortName} (${elapsedSec}s)...`);

        const pollResp = await fetch(pollUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey.trim()}`,
                'HTTP-Referer': 'https://vip-imagetools.vercel.app',
                'X-Title': 'ImageTool Video AI Studio'
            }
        });

        if (!pollResp.ok) {
            if (pollResp.status >= 500 && attempt < maxAttempts) {
                continue;
            }
            let pollErrDetail = `HTTP ${pollResp.status}`;
            try {
                const errJson = await pollResp.json();
                pollErrDetail = errJson?.error?.message || pollErrDetail;
            } catch {
                // Ignore
            }
            throw new Error(`[${meta.shortName}] Lỗi kiểm tra tiến trình: ${pollErrDetail}`);
        }

        const pollData = await pollResp.json();
        const status = pollData?.status;

        if (status === 'completed') {
            if (Array.isArray(pollData.urls) && pollData.urls.length > 0 && typeof pollData.urls[0] === 'string') {
                return pollData.urls[0];
            }

            // Đợi ngắn 1-2 nhịp để OpenRouter kịp điền signed URL Google Cloud Storage vào urls[0]
            for (let retrySigned = 0; retrySigned < 3; retrySigned++) {
                await sleep(2000);
                try {
                    const confirmResp = await fetch(pollUrl, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${apiKey.trim()}`,
                            'HTTP-Referer': 'https://vip-imagetools.vercel.app',
                            'X-Title': 'ImageTool Video AI Studio'
                        }
                    });
                    if (confirmResp.ok) {
                        const confirmData = await confirmResp.json();
                        if (Array.isArray(confirmData?.urls) && typeof confirmData.urls[0] === 'string') {
                            return confirmData.urls[0];
                        }
                    }
                } catch {
                    // Ignore and fallback below
                }
            }

            const contentEndpoint = (Array.isArray(pollData.unsigned_urls) && pollData.unsigned_urls[0])
                ? pollData.unsigned_urls[0]
                : `${OPENROUTER_VIDEOS_ENDPOINT}/${encodeURIComponent(jobId)}/content`;

            options.onProgress?.('Đang tải luồng video MP4 hoàn chỉnh về trình phát...');
            return await fetchAuthorizedVideoAsBlobUrl(contentEndpoint, apiKey);
        }

        if (status === 'failed' || status === 'cancelled' || status === 'expired') {
            const failReason = pollData?.error?.message || pollData?.error || `Tiến trình tạo video kết thúc với trạng thái: ${status}`;
            throw new Error(`[${meta.shortName}] ${failReason}`);
        }
    }

    throw new Error(`Quá thời gian chờ kết xuất video (300s) từ ${meta.shortName}.`);
};

/**
 * Tạo video chất lượng cao qua OpenRouter với 2 mô hình được tuyển chọn & cơ chế Auto-Failover
 */
export const generateOpenRouterVideo = async (
    options: GenerateOpenRouterVideoOptions
): Promise<GenerateOpenRouterVideoResult> => {
    const config = await getVideoConfig();

    if (!config.openRouterApiKey || !config.openRouterApiKey.trim()) {
        throw new Error('Chưa cấu hình API Key OpenRouter trên trang Quản trị (Admin Panel). Vui lòng nhập API Key để kích hoạt tính năng Tạo Video.');
    }

    const apiKey = config.openRouterApiKey.trim();
    const requestedModel = (!options.modelOverride || options.modelOverride === 'auto' || options.modelOverride.includes('gemini-omni'))
        ? (config.primaryModel || OPENROUTER_VIDEO_MODELS[0].id)
        : options.modelOverride;

    const primaryMeta = getVideoModelMeta(requestedModel);
    const aspectRatio: '16:9' | '9:16' | '1:1' = options.aspectRatio || config.defaultAspectRatio || '16:9';
    const duration = options.duration || config.defaultDuration || 5;

    // Chọn mô hình dự phòng tương thích với tỷ lệ và thời lượng người dùng đã chọn
    const fallbackCandidate = OPENROUTER_VIDEO_MODELS.find(
        m => m.id !== primaryMeta.id &&
             m.supportedAspectRatios.includes(aspectRatio) &&
             m.supportedDurations.includes(duration)
    ) || OPENROUTER_VIDEO_MODELS.find(m => m.id !== primaryMeta.id);

    const count = Math.max(1, Math.min(3, options.outputCount || 1));
    const urls: string[] = [];
    let finalModelUsed = primaryMeta.id;

    for (let i = 0; i < count; i++) {
        if (count > 1) {
            options.onProgress?.(`Đang tạo video ${i + 1}/${count} qua mô hình ${primaryMeta.shortName}...`);
        } else {
            options.onProgress?.(`Đang kết nối OpenRouter (${primaryMeta.shortName})...`);
        }

        let videoUrl: string | null = null;

        try {
            videoUrl = await executeOpenRouterVideoCall(primaryMeta.id, apiKey, options, aspectRatio, duration);
            finalModelUsed = primaryMeta.id;
        } catch (primaryErr: any) {
            console.warn(`[OpenRouter] Mô hình chính ${primaryMeta.id} gặp lỗi:`, primaryErr);

            if (fallbackCandidate && (!options.modelOverride || options.modelOverride === 'auto')) {
                options.onProgress?.(`Mô hình ${primaryMeta.shortName} bận. Đang tự động chuyển sang ${fallbackCandidate.shortName}...`);
                try {
                    videoUrl = await executeOpenRouterVideoCall(fallbackCandidate.id, apiKey, options, aspectRatio, duration);
                    finalModelUsed = fallbackCandidate.id;
                } catch (fallbackErr: any) {
                    throw new Error(`Tạo video thất bại:\n- ${primaryMeta.shortName}: ${primaryErr.message}\n- ${fallbackCandidate.shortName}: ${fallbackErr.message}`);
                }
            } else {
                throw primaryErr;
            }
        }

        if (videoUrl) {
            urls.push(videoUrl);
        }
    }

    if (urls.length === 0) {
        throw new Error('Không tạo được video nào. Vui lòng kiểm tra lại prompt hoặc số dư OpenRouter.');
    }

    return {
        url: urls[0],
        urls,
        modelUsed: finalModelUsed,
        duration,
        aspectRatio,
        prompt: options.prompt
    };
};
