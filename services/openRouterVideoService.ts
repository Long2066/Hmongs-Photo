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

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Trích xuất URL video hoặc Base64 MP4 từ phản hồi đa phương thức của OpenRouter
 */
export const extractVideoFromResponse = (data: any): string | null => {
    if (!data) return null;

    // 1. Kiểm tra cấu trúc choice message
    const choice = data.choices?.[0];
    const message = choice?.message;

    if (message) {
        // Trường video trực tiếp
        if (typeof message.video === 'string' && message.video.length > 0) {
            return message.video;
        }
        if (message.video?.url && typeof message.video.url === 'string') {
            return message.video.url;
        }
        if (Array.isArray(message.videos) && message.videos.length > 0) {
            const first = message.videos[0];
            return typeof first === 'string' ? first : first.url || null;
        }

        // Kiểm tra parts (Gemini native parts)
        if (Array.isArray(message.parts)) {
            for (const part of message.parts) {
                if (part.video_url?.url) return part.video_url.url;
                if (part.inline_data && part.inline_data.mime_type?.startsWith('video/')) {
                    return `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
                }
            }
        }

        // Kiểm tra content mảng
        if (Array.isArray(message.content)) {
            for (const item of message.content) {
                if (item.type === 'video_url' && item.video_url?.url) {
                    return item.video_url.url;
                }
                if (item.type === 'image_url' && item.image_url?.url && item.image_url.url.includes('video')) {
                    return item.image_url.url;
                }
                if (typeof item.text === 'string') {
                    const match = extractVideoUrlFromText(item.text);
                    if (match) return match;
                }
            }
        }

        // Kiểm tra content chuỗi
        if (typeof message.content === 'string') {
            const match = extractVideoUrlFromText(message.content);
            if (match) return match;
        }
    }

    // 2. Kiểm tra cấu trúc /api/v1/videos (OpenAI standard)
    if (Array.isArray(data.data) && data.data.length > 0) {
        const item = data.data[0];
        if (typeof item.url === 'string') return item.url;
        if (typeof item.b64_json === 'string') {
            return `data:video/mp4;base64,${item.b64_json}`;
        }
    }

    return null;
};

/**
 * Trích xuất link MP4 / WebM / Base64 từ đoạn văn bản
 */
const extractVideoUrlFromText = (text: string): string | null => {
    if (!text) return null;

    // Base64 video data URL
    const b64Match = text.match(/data:video\/(?:mp4|webm|quicktime);base64,[A-Za-z0-9+/=]+/i);
    if (b64Match) return b64Match[0];

    // Markdown link video: [video](https://...mp4) hoặc ![video](https://...mp4)
    const mdMatch = text.match(/!?\[(?:.*?)\]\((https?:\/\/[^\s)]+\.(?:mp4|webm|mov)(?:\?[^\s)]*)?)\)/i);
    if (mdMatch) return mdMatch[1];

    // URL trực tiếp MP4 / WebM / MOV
    const urlMatch = text.match(/(https?:\/\/[^\s"'<>]+\.(?:mp4|webm|mov)(?:\?[^\s"'<>]*)?)/i);
    if (urlMatch) return urlMatch[1];

    // URL từ storage googleapis hoặc openrouter cdn
    const cdnMatch = text.match(/(https?:\/\/(?:storage\.googleapis\.com|generativelanguage\.googleapis\.com|openrouter\.ai\/api\/v1\/files)[^\s"'<>]+)/i);
    if (cdnMatch) return cdnMatch[0];

    return null;
};

/**
 * Gửi một lượt yêu cầu tới OpenRouter cho một model cụ thể
 */
const executeOpenRouterVideoCall = async (
    modelId: string,
    apiKey: string,
    options: GenerateOpenRouterVideoOptions,
    aspectRatio: string,
    duration: number
): Promise<string> => {
    let cleanPrompt = options.prompt.trim();

    // Bổ sung chỉ dẫn tỷ lệ và thời lượng vào prompt để model render chính xác
    const ratioText = aspectRatio === '9:16'
        ? 'Vertical portrait 9:16 aspect ratio (TikTok/Shorts format)'
        : aspectRatio === '1:1'
        ? 'Square 1:1 aspect ratio'
        : 'Widescreen landscape 16:9 cinematic aspect ratio';
    
    const durationText = `${duration} seconds duration`;
    const enhancedPrompt = `${cleanPrompt}. [Format: ${ratioText}, ${durationText}, smooth cinematic motion, high quality render, with native sound].`;

    // Chuẩn bị message
    let messageContent: any;
    if (options.inputImageBase64) {
        let imageUrl = options.inputImageBase64.trim();
        if (!imageUrl.startsWith('data:') && !imageUrl.startsWith('http')) {
            imageUrl = `data:image/png;base64,${imageUrl}`;
        }
        messageContent = [
            {
                type: 'text',
                text: enhancedPrompt
            },
            {
                type: 'image_url',
                image_url: {
                    url: imageUrl
                }
            }
        ];
    } else {
        messageContent = enhancedPrompt;
    }

    const payload = {
        model: modelId,
        messages: [
            {
                role: 'user',
                content: messageContent
            }
        ],
        modalities: ['text', 'video']
    };

    const controller = new AbortController();
    // Video generation có thể mất 45s - 120s
    const timeout = setTimeout(() => controller.abort(), 180000);

    try {
        const resp = await fetch(OPENROUTER_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey.trim()}`,
                'HTTP-Referer': 'https://vip-imagetools.vercel.app',
                'X-Title': 'ImageTool Video AI Studio',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!resp.ok) {
            let errorDetail = `HTTP ${resp.status}`;
            try {
                const errJson = await resp.json();
                errorDetail = errJson?.error?.message || errorDetail;
            } catch {
                // Ignore json parse error
            }
            throw new Error(`[OpenRouter ${modelId}] ${errorDetail}`);
        }

        const data = await resp.json();
        const videoUrl = extractVideoFromResponse(data);

        if (!videoUrl) {
            // Kiểm tra xem OpenRouter có trả về lý do từ chối không
            const textResponse = data.choices?.[0]?.message?.content;
            if (typeof textResponse === 'string' && textResponse.length > 0) {
                throw new Error(`OpenRouter không trả về video: ${textResponse.slice(0, 300)}`);
            }
            throw new Error(`Không tìm thấy dữ liệu video trong kết quả từ ${modelId}. Vui lòng thử lại.`);
        }

        return videoUrl;
    } catch (err: any) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
            throw new Error(`Quá thời gian chờ (Timeout 180s) khi gọi ${modelId}. Server AI đang bận.`);
        }
        throw err;
    }
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
