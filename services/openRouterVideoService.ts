import { getVideoConfig, OpenRouterVideoConfig } from './videoConfigService';

export interface GenerateOpenRouterVideoOptions {
    prompt: string;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    duration?: number; // 5, 10, 15
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

    // 1. Chuẩn OpenRouter /api/v1/videos (signed urls ưu tiên số 1 vì phát trực tiếp không cần header)
    if (Array.isArray(data.urls) && data.urls.length > 0 && typeof data.urls[0] === 'string') {
        return data.urls[0];
    }

    // 2. Fallback: cấu trúc data array
    if (Array.isArray(data.data) && data.data.length > 0) {
        const item = data.data[0];
        if (typeof item.url === 'string') return item.url;
        if (typeof item.b64_json === 'string') {
            return `data:video/mp4;base64,${item.b64_json}`;
        }
    }

    // 3. Fallback: unsigned_urls
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
    aspectRatio: string,
    duration: number
): Promise<string> => {
    const cleanPrompt = options.prompt.trim();

    // Theo OpenAPI spec của OpenRouter (/api/v1/videos/models):
    // google/gemini-omni-1.2-flash và google/gemini-omni-1.1-flash chỉ nhận aspect_ratio: "16:9" | "9:16"
    // Nếu người dùng chọn 1:1, truyền 16:9 cho schema và bổ sung chỉ dẫn khung hình vào prompt
    const supportedAspectRatio: '16:9' | '9:16' = aspectRatio === '9:16' ? '9:16' : '16:9';
    const finalPrompt = aspectRatio === '1:1'
        ? `${cleanPrompt}. Centered square composition, smooth cinematic motion, high quality render.`
        : cleanPrompt;

    // Thời lượng hỗ trợ: Omni 1.2 Flash hỗ trợ 3..15s; Omni 1.1 Flash hỗ trợ 3..10s
    const maxDurationForModel = modelId.includes('1.1') ? 10 : 15;
    const clampedDuration = Math.max(3, Math.min(maxDurationForModel, Math.round(duration || 5)));

    const payload: Record<string, any> = {
        model: modelId,
        prompt: finalPrompt,
        aspect_ratio: supportedAspectRatio,
        duration: clampedDuration,
        resolution: '720p',
        generate_audio: true
    };

    if (options.inputImageBase64) {
        let imageUrl = options.inputImageBase64.trim();
        if (!imageUrl.startsWith('data:') && !imageUrl.startsWith('http')) {
            imageUrl = `data:image/png;base64,${imageUrl}`;
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
            throw new Error(`[OpenRouter ${modelId}] ${errorDetail}`);
        }

        submitData = await submitResp.json();
    } catch (err: any) {
        clearTimeout(submitTimeout);
        if (err.name === 'AbortError') {
            throw new Error(`Quá thời gian chờ khi gửi yêu cầu tới ${modelId}.`);
        }
        throw err;
    }

    // Nếu trả về kết quả ngay lập tức
    const immediateUrl = extractVideoFromResponse(submitData);
    if (submitData?.status === 'completed' && immediateUrl) {
        return immediateUrl;
    }

    const jobId = submitData?.id;
    if (!jobId) {
        throw new Error(`OpenRouter (${modelId}) không trả về mã tiến trình tạo video (Job ID).`);
    }

    const pollUrl = submitData?.polling_url
        ? (submitData.polling_url.startsWith('http')
            ? submitData.polling_url
            : `https://openrouter.ai${submitData.polling_url.startsWith('/') ? '' : '/'}${submitData.polling_url}`)
        : `${OPENROUTER_VIDEOS_ENDPOINT}/${encodeURIComponent(jobId)}`;

    // Bước 2: Poll trạng thái tiến trình (GET /api/v1/videos/{id})
    const maxAttempts = 75; // 75 * 4s = 300s (5 phút tối đa)
    const modelShortName = modelId.split('/').pop() || modelId;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await sleep(4000);
        const elapsedSec = attempt * 4;
        options.onProgress?.(`Đang kết xuất video trên ${modelShortName} (${elapsedSec}s)...`);

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
            throw new Error(`[OpenRouter ${modelId}] Lỗi kiểm tra tiến trình: ${pollErrDetail}`);
        }

        const pollData = await pollResp.json();
        const status = pollData?.status;

        if (status === 'completed') {
            // Ưu tiên signed URL trong pollData.urls[0]
            if (Array.isArray(pollData.urls) && pollData.urls.length > 0 && typeof pollData.urls[0] === 'string') {
                return pollData.urls[0];
            }

            // Nếu chỉ có unsigned_urls hoặc cần tải qua /content
            const contentEndpoint = (Array.isArray(pollData.unsigned_urls) && pollData.unsigned_urls[0])
                ? pollData.unsigned_urls[0]
                : `${OPENROUTER_VIDEOS_ENDPOINT}/${encodeURIComponent(jobId)}/content`;

            options.onProgress?.('Đang tải luồng video MP4 hoàn chỉnh về trình phát...');
            return await fetchAuthorizedVideoAsBlobUrl(contentEndpoint, apiKey);
        }

        if (status === 'failed' || status === 'cancelled' || status === 'expired') {
            const failReason = pollData?.error?.message || pollData?.error || `Tiến trình tạo video kết thúc với trạng thái: ${status}`;
            throw new Error(`[OpenRouter ${modelId}] ${failReason}`);
        }
    }

    throw new Error(`Quá thời gian chờ kết xuất video (300s) từ ${modelId}.`);
};

/**
 * Tạo video chất lượng cao qua OpenRouter với cơ chế Auto-Failover (Omni 1.2 -> Omni 1.1)
 */
export const generateOpenRouterVideo = async (
    options: GenerateOpenRouterVideoOptions
): Promise<GenerateOpenRouterVideoResult> => {
    const config = await getVideoConfig();

    if (!config.openRouterApiKey || !config.openRouterApiKey.trim()) {
        throw new Error('Chưa cấu hình API Key OpenRouter trên trang Quản trị (Admin Panel). Vui lòng nhập API Key để kích hoạt tính năng Tạo Video.');
    }

    const apiKey = config.openRouterApiKey.trim();
    const primaryModel = options.modelOverride || config.primaryModel || 'google/gemini-omni-1.2-flash';
    const fallbackModel = config.fallbackModel || 'google/gemini-omni-1.1-flash';
    const aspectRatio = options.aspectRatio || config.defaultAspectRatio || '16:9';
    const duration = options.duration || config.defaultDuration || 5;

    const count = Math.max(1, Math.min(3, options.outputCount || 1));
    const urls: string[] = [];

    for (let i = 0; i < count; i++) {
        if (count > 1) {
            options.onProgress?.(`Đang tạo video ${i + 1}/${count} qua mô hình ${primaryModel.split('/').pop()}...`);
        } else {
            options.onProgress?.(`Đang kết nối OpenRouter (${primaryModel.split('/').pop()})...`);
        }

        let modelUsed = primaryModel;
        let videoUrl: string | null = null;

        try {
            // 1. Thử gọi mô hình chính (google/gemini-omni-1.2-flash)
            videoUrl = await executeOpenRouterVideoCall(primaryModel, apiKey, options, aspectRatio, duration);
        } catch (primaryErr: any) {
            console.warn(`[OpenRouter] Mô hình chính ${primaryModel} gặp lỗi:`, primaryErr);

            // Kiểm tra xem có nên tự động chuyển sang mô hình dự phòng (Omni 1.1 Flash) không
            const isRecoverableError =
                primaryErr.message?.includes('429') ||
                primaryErr.message?.includes('500') ||
                primaryErr.message?.includes('502') ||
                primaryErr.message?.includes('503') ||
                primaryErr.message?.includes('504') ||
                primaryErr.message?.includes('rate limit') ||
                primaryErr.message?.includes('overloaded') ||
                primaryErr.message?.includes('Timeout') ||
                primaryErr.message?.includes('capacity');

            if (fallbackModel && fallbackModel !== primaryModel) {
                options.onProgress?.(`Mô hình chính bận (${primaryErr.message?.slice(0, 50)}...). Đang tự động chuyển sang ${fallbackModel.split('/').pop()}...`);
                try {
                    videoUrl = await executeOpenRouterVideoCall(fallbackModel, apiKey, options, aspectRatio, duration);
                    modelUsed = fallbackModel;
                } catch (fallbackErr: any) {
                    throw new Error(`Tạo video thất bại cả 2 mô hình:\n- ${primaryModel}: ${primaryErr.message}\n- ${fallbackModel}: ${fallbackErr.message}`);
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
        modelUsed: primaryModel,
        duration,
        aspectRatio,
        prompt: options.prompt
    };
};
