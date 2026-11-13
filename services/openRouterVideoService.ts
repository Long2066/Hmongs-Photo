import {
    getVideoConfig,
    getVideoModelMeta,
    isVideoModelProviderEnabled,
    OPENROUTER_VIDEO_MODELS,
    OpenRouterVideoConfig
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
const IDEA_AI_STUDIO_BASE = 'https://studio-media-matrix.creativefabrica.com/creativefabrica.studiomediamatrix.v1.StudioMediaMatrixService';
const VIVIX_API_BASE = 'https://api.vivix.ai/v1';

/**
 * Tránh lỗi CORS khi gọi idea.ai hoặc api.vivix.ai trên trình duyệt web:
 * Tự động route qua cors-proxy an toàn của hệ thống
 */
const resolveProxyUrl = (targetUrl: string): string => {
    const isElectron = typeof window !== 'undefined' && Boolean((window as any).electron || (window as any).process?.versions?.electron);
    if (!isElectron) {
        return `https://vip-imagetools.vercel.app/api/cors-proxy?url=${encodeURIComponent(targetUrl)}`;
    }
    return targetUrl;
};
const resolveIdeaAiUrl = resolveProxyUrl;

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
 * Chuyển chuỗi Base64 / Data URL của ảnh nguồn thành đối tượng Blob nhị phân chuẩn magic-bytes
 */
const base64ToImageBlob = async (base64Input: string): Promise<{ blob: Blob; fileName: string }> => {
    const trimmed = base64Input.trim();
    if (trimmed.startsWith('data:') || trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const resp = await fetch(trimmed);
        const rawBlob = await resp.blob();
        const buf = new Uint8Array(await rawBlob.arrayBuffer());
        const isJpg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
        const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
        const isWebp = buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46;
        const realMime = isJpg ? 'image/jpeg' : isPng ? 'image/png' : isWebp ? 'image/webp' : (rawBlob.type || 'image/jpeg');
        const ext = realMime.includes('png') ? 'png' : realMime.includes('webp') ? 'webp' : 'jpg';
        const blob = realMime === rawBlob.type ? rawBlob : new Blob([buf], { type: realMime });
        return { blob, fileName: `input-frame.${ext}` };
    }

    const byteCharacters = atob(trimmed);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i);
    }
    const isJpg = byteArray[0] === 0xFF && byteArray[1] === 0xD8 && byteArray[2] === 0xFF;
    const isPng = byteArray[0] === 0x89 && byteArray[1] === 0x50 && byteArray[2] === 0x4E && byteArray[3] === 0x47;
    const isWebp = byteArray[0] === 0x52 && byteArray[1] === 0x49 && byteArray[2] === 0x46 && byteArray[3] === 0x46;
    const mimeType = isJpg ? 'image/jpeg' : isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/png';
    const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
    return {
        blob: new Blob([byteArray], { type: mimeType }),
        fileName: `input-frame.${ext}`
    };
};

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
 * Gửi một lượt yêu cầu tạo video tới idea.ai (Vivix W1) qua ConnectRPC StudioMediaMatrixService
 */
const executeIdeaAiVideoCall = async (
    modelId: string,
    ideaAiApiKey: string,
    options: GenerateOpenRouterVideoOptions,
    aspectRatio: '16:9' | '9:16' | '1:1',
    duration: number
): Promise<string> => {
    const meta = getVideoModelMeta(modelId);
    const cleanPrompt = options.prompt.trim() || 'Smooth cinematic camera motion, natural movement, high quality';

    const validAspectRatio = meta.supportedAspectRatios.includes(aspectRatio)
        ? aspectRatio
        : meta.supportedAspectRatios[0];

    const validDuration = meta.supportedDurations.includes(duration)
        ? duration
        : meta.supportedDurations.reduce((prev, curr) =>
            Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev
        );

    const aspectEnumMap: Record<'16:9' | '9:16' | '1:1', string> = {
        '16:9': 'PROMPT_TO_VIDEO_GENERATOR_CONTENT_ASPECT_RATIO_16_9',
        '9:16': 'PROMPT_TO_VIDEO_GENERATOR_CONTENT_ASPECT_RATIO_9_16',
        '1:1': 'PROMPT_TO_VIDEO_GENERATOR_CONTENT_ASPECT_RATIO_1_1'
    };

    const resolutionEnum = meta.defaultResolution === '480p'
        ? 'PROMPT_TO_VIDEO_GENERATOR_CONTENT_RESOLUTION_480P'
        : 'PROMPT_TO_VIDEO_GENERATOR_CONTENT_RESOLUTION_720P';

    const modelEnum = modelId.includes('mischief')
        ? 'VIDEO_GENERATOR_MODEL_MISCHIEF_1'
        : 'VIDEO_GENERATOR_MODEL_VIVIX_W1';

    let preparedFrame: { blob: Blob; fileName: string } | null = null;
    if (options.inputImageBase64) {
        preparedFrame = await base64ToImageBlob(options.inputImageBase64);
    }

    const promptToVideoContent: Record<string, any> = {
        serviceType: 'SERVICE_TYPE_VIDEO_GENERATOR',
        model: modelEnum,
        promptContent: {
            prompt: cleanPrompt
        },
        videoDuration: {
            inSeconds: validDuration
        },
        resolution: resolutionEnum,
        aspectRatio: aspectEnumMap[validAspectRatio]
    };

    if (preparedFrame) {
        promptToVideoContent.frames = [
            {
                type: 'VIDEO_FRAME_TYPE_FIRST',
                fileSize: String(preparedFrame.blob.size),
                fileName: preparedFrame.fileName
            }
        ];
    }

    const headers = {
        'Authorization': `Bearer ${ideaAiApiKey.trim()}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    // Bước 1: InitiateSession trên idea.ai
    options.onProgress?.(`Đang khởi tạo phiên tạo video trên ${meta.shortName}...`);
    const initController = new AbortController();
    const initTimeout = setTimeout(() => initController.abort(), 45000);

    const initUrl = resolveIdeaAiUrl(`${IDEA_AI_STUDIO_BASE}/InitiateSession`);

    let initData: any;
    try {
        const initResp = await fetch(initUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                visibility: 'SESSION_VISIBILITY_PRIVATE',
                sessionRequestPromptToVideoGeneratorContent: promptToVideoContent
            }),
            signal: initController.signal
        });
        clearTimeout(initTimeout);

        const rawJson = await initResp.json().catch(() => ({}));
        if (!initResp.ok) {
            const errMsg = rawJson?.message || rawJson?.error?.message || `HTTP ${initResp.status}`;
            throw new Error(`[${meta.shortName}] ${errMsg}`);
        }
        initData = rawJson;
    } catch (err: any) {
        clearTimeout(initTimeout);
        if (err.name === 'AbortError') {
            throw new Error(`Quá thời gian chờ khi khởi tạo phiên tạo video trên ${meta.shortName}.`);
        }
        throw err;
    }

    const session = initData?.session || initData;
    const sessionId = session?.id;
    if (!sessionId) {
        throw new Error(`[${meta.shortName}] Không nhận được mã phiên (Session ID) từ idea.ai.`);
    }

    // Bước 2: Nếu có ảnh đầu vào (Image-to-Video), upload ảnh lên Presigned URL của phiên
    if (preparedFrame) {
        const returnedFrames: any[] =
            session?.promptToVideoGeneratorContent?.frames ||
            session?.content?.value?.frames ||
            [];
        const uploadTarget = returnedFrames.find(f => f && typeof f.url === 'string' && f.url.length > 0);

        if (!uploadTarget?.url) {
            throw new Error(`[${meta.shortName}] Máy chủ idea.ai không trả về đường dẫn tải ảnh nguồn (Presigned URL).`);
        }

        options.onProgress?.(`Đang tải ảnh nguồn lên máy chủ ${meta.shortName}...`);
        const putUrl = resolveIdeaAiUrl(uploadTarget.url);
        let putResp: Response;
        try {
            putResp = await fetch(putUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': preparedFrame.blob.type || 'image/jpeg'
                },
                body: preparedFrame.blob
            });
        } catch (putErr) {
            // Fallback gửi trực tiếp nếu chạy trên môi trường Electron/desktop
            putResp = await fetch(uploadTarget.url, {
                method: 'PUT',
                headers: {
                    'Content-Type': preparedFrame.blob.type || 'image/jpeg'
                },
                body: preparedFrame.blob
            });
        }

        if (!putResp.ok) {
            throw new Error(`[${meta.shortName}] Tải ảnh nguồn lên máy chủ thất bại (HTTP ${putResp.status}).`);
        }
    }

    // Bước 3: Poll GetSessionMedia mỗi 4 giây cho tới khi video hoàn tất
    const getMediaUrl = resolveIdeaAiUrl(`${IDEA_AI_STUDIO_BASE}/GetSessionMedia`);
    const getSessionUrl = resolveIdeaAiUrl(`${IDEA_AI_STUDIO_BASE}/GetSession`);

    const maxAttempts = 75; // 75 * 4s = 300s (5 phút tối đa)
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await sleep(4000);
        const elapsedSec = attempt * 4;
        options.onProgress?.(`Đang kết xuất video trên ${meta.shortName} (${elapsedSec}s)...`);

        const mediaResp = await fetch(getMediaUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                sessionId,
                serviceType: 'SERVICE_TYPE_VIDEO_GENERATOR'
            })
        });

        if (!mediaResp.ok) {
            if (mediaResp.status >= 500 && attempt < maxAttempts) {
                continue;
            }
            const errJson = await mediaResp.json().catch(() => ({}));
            throw new Error(`[${meta.shortName}] Lỗi kiểm tra tiến trình: ${errJson?.message || `HTTP ${mediaResp.status}`}`);
        }

        const mediaData = await mediaResp.json().catch(() => ({}));
        const items: any[] = Array.isArray(mediaData?.items) ? mediaData.items : [];

        for (const item of items) {
            const itemStatus = item?.status;
            const videoContent = item?.videoContent || item?.mediaContent?.videoContent;
            const generatedUrl = videoContent?.generatedVideoUrl || videoContent?.generatedPreviewUrl;

            if (
                (itemStatus === 'MEDIA_STATUS_COMPLETED' || itemStatus === 3) &&
                typeof generatedUrl === 'string' &&
                generatedUrl.length > 0
            ) {
                return generatedUrl;
            }

            if (itemStatus === 'MEDIA_STATUS_ERROR' || itemStatus === 4) {
                throw new Error(`[${meta.shortName}] Tiến trình tạo video báo lỗi từ máy chủ idea.ai.`);
            }
        }

        // Kiểm tra thêm trạng thái phiên mỗi 3 nhịp nếu items chưa xuất hiện
        if (attempt % 3 === 0) {
            try {
                const sessResp = await fetch(getSessionUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        id: sessionId,
                        serviceType: 'SERVICE_TYPE_VIDEO_GENERATOR'
                    })
                });
                if (sessResp.ok) {
                    const sessData = await sessResp.json();
                    const sStatus = sessData?.session?.status;
                    if (sStatus === 'SESSION_STATUS_FAILED' || sStatus === 'SESSION_STATUS_ERROR' || sStatus === 3) {
                        throw new Error(`[${meta.shortName}] Phiên tạo video thất bại trên idea.ai.`);
                    }
                }
            } catch (sessErr: any) {
                if (sessErr?.message?.includes('thất bại')) {
                    throw sessErr;
                }
            }
        }
    }

    throw new Error(`Quá thời gian chờ kết xuất video (300s) từ ${meta.shortName}.`);
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
 * Gửi một lượt yêu cầu tạo video tới máy chủ chính chủ Vivix (Vivix W1 real)
 * API: POST https://api.vivix.ai/v1/videos/jobs & GET /v1/videos/jobs/{job_id}
 */
const executeVivixVideoCall = async (
    modelId: string,
    vivixApiKey: string,
    config: OpenRouterVideoConfig,
    options: GenerateOpenRouterVideoOptions,
    aspectRatio: '16:9' | '9:16' | '1:1',
    duration: number
): Promise<string> => {
    const meta = getVideoModelMeta(modelId);
    const cleanPrompt = options.prompt.trim() || 'Smooth cinematic camera motion, natural movement, high quality';
    const key = vivixApiKey.trim();

    // Model name on Vivix API: "vivix-w1" | "vivix-w1-fast" | "vivix-w1-ultrafast"
    let vivixModel: string = config.vivixModelVariant || 'vivix-w1';

    const validAspectRatio = meta.supportedAspectRatios.includes(aspectRatio)
        ? aspectRatio
        : meta.supportedAspectRatios[0];

    // Vivix W1 requires duration between 5 and 15
    const validDuration = Math.max(5, Math.min(15, duration || 5));

    // Bước 0: Kiểm tra danh sách model được phép của API Key (GET /v1/models)
    try {
        const modelsUrl = resolveProxyUrl(`${VIVIX_API_BASE}/models`);
        let modelsResp: Response;
        try {
            modelsResp = await fetch(modelsUrl, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${key}`, 'Accept': 'application/json' }
            });
        } catch {
            modelsResp = await fetch(`${VIVIX_API_BASE}/models`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${key}`, 'Accept': 'application/json' }
            });
        }

        if (modelsResp.ok) {
            const modelsJson = await modelsResp.json().catch(() => ({}));
            const allowedList: Array<{ name: string; tag?: string }> = Array.isArray(modelsJson?.data?.models)
                ? modelsJson.data.models
                : [];

            if (allowedList.length > 0) {
                const fullNames = allowedList.map(m => (m.tag ? `${m.name}:${m.tag}` : m.name));
                const w1Matches = allowedList.filter(m => String(m.name || '').toLowerCase().includes('w1'));
                if (w1Matches.length === 0) {
                    throw new Error(
                        `[${meta.shortName}] Tài khoản Vivix của bạn hiện chỉ mở quyền gọi [${fullNames.join(', ')}], chưa mở quyền API dòng Vivix W1 (Preview giới hạn). Vui lòng mua gói W-Pack tại platform.vivix.ai/pricing#W để kích hoạt API W1, hoặc chọn model [Vivix W1 T].`
                    );
                }

                // Tìm khớp chính xác variant được chọn hoặc tag đi kèm (vd: vivix-w1:latest)
                const exactBare = w1Matches.find(m => m.name === vivixModel && !m.tag);
                if (!exactBare) {
                    const matchedVariant = w1Matches.find(m => m.name === vivixModel) || w1Matches[0];
                    vivixModel = matchedVariant.tag ? `${matchedVariant.name}:${matchedVariant.tag}` : matchedVariant.name;
                }
            }
        }
    } catch (checkErr: any) {
        if (checkErr?.message?.includes('chưa mở quyền API')) {
            throw checkErr;
        }
    }

    let firstFrameUrl: string | undefined = undefined;

    // Bước 1: Nếu có ảnh đầu vào (Image-to-Video), tải ảnh lên POST /v1/files/images
    if (options.inputImageBase64) {
        options.onProgress?.(`Đang tải ảnh nguồn lên máy chủ ${meta.shortName}...`);
        const prepared = await base64ToImageBlob(options.inputImageBase64);

        const formData = new FormData();
        formData.append('file', prepared.blob, prepared.fileName);

        const uploadUrl = resolveProxyUrl(`${VIVIX_API_BASE}/files/images`);
        let uploadResp: Response;
        try {
            uploadResp = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${key}`
                },
                body: formData
            });
        } catch (uploadErr) {
            // Fallback direct upload
            uploadResp = await fetch(`${VIVIX_API_BASE}/files/images`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${key}`
                },
                body: formData
            });
        }

        const uploadJson = await uploadResp.json().catch(() => ({}));
        if (!uploadResp.ok || uploadJson?.code !== 0 || !uploadJson?.data?.url) {
            const errDetail = uploadJson?.message || `HTTP ${uploadResp.status}`;
            throw new Error(`[${meta.shortName}] Tải ảnh nguồn thất bại: ${errDetail}`);
        }

        firstFrameUrl = uploadJson.data.url;
    }

    // Bước 2: Gửi yêu cầu tạo video POST /v1/videos/jobs
    options.onProgress?.(`Đang khởi tạo tác vụ kết xuất trên ${meta.shortName}...`);

    const jobPayload: Record<string, any> = {
        prompt: cleanPrompt,
        aspect_ratio: validAspectRatio,
        duration: validDuration
    };

    if (firstFrameUrl) {
        jobPayload.first_frame_image = firstFrameUrl;
    }

    const requestBody = {
        model: vivixModel,
        jobs: [jobPayload]
    };

    const submitUrl = resolveProxyUrl(`${VIVIX_API_BASE}/videos/jobs`);
    let submitResp: Response;
    try {
        submitResp = await fetch(submitUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
    } catch {
        submitResp = await fetch(`${VIVIX_API_BASE}/videos/jobs`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
    }

    const submitJson = await submitResp.json().catch(() => ({}));
    if (!submitResp.ok || submitJson?.code !== 0) {
        const rawErr = submitJson?.message || `HTTP ${submitResp.status}`;
        if (String(rawErr).toLowerCase().includes('model tag not available')) {
            throw new Error(
                `[${meta.shortName}] Tài khoản Vivix chưa được cấp quyền API cho dòng Vivix W1 (Preview giới hạn). Vui lòng mua gói W-Pack trên platform.vivix.ai/pricing#W để mở khóa, hoặc chuyển sang chọn [Vivix W1 T].`
            );
        }
        throw new Error(`[${meta.shortName}] Gửi tác vụ tạo video thất bại: ${rawErr}`);
    }

    const jobId = submitJson?.data?.results?.[0]?.job_id || submitJson?.data?.job_id;
    if (!jobId) {
        throw new Error(`[${meta.shortName}] Không nhận được mã tác vụ (Job ID) từ Vivix API.`);
    }

    // Bước 3: Poll GET /v1/videos/jobs/{jobId} mỗi 4 giây cho tới khi hoàn tất
    const maxAttempts = 75; // 75 * 4s = 300s (5 phút)
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await sleep(4000);
        const elapsedSec = attempt * 4;
        options.onProgress?.(`Đang kết xuất video qua máy chủ ${meta.shortName} (${elapsedSec}s)...`);

        const pollUrl = resolveProxyUrl(`${VIVIX_API_BASE}/videos/jobs/${encodeURIComponent(jobId)}`);
        let pollResp: Response;
        try {
            pollResp = await fetch(pollUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Accept': 'application/json'
                }
            });
        } catch {
            pollResp = await fetch(`${VIVIX_API_BASE}/videos/jobs/${encodeURIComponent(jobId)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Accept': 'application/json'
                }
            });
        }

        if (!pollResp.ok) {
            if (pollResp.status >= 500 && attempt < maxAttempts) {
                continue;
            }
            const errJson = await pollResp.json().catch(() => ({}));
            throw new Error(`[${meta.shortName}] Lỗi kiểm tra tiến trình: ${errJson?.message || `HTTP ${pollResp.status}`}`);
        }

        const pollJson = await pollResp.json().catch(() => ({}));
        const jobData = pollJson?.data;
        const status = jobData?.status;

        if (status === 'succeeded' && typeof jobData?.video_url === 'string' && jobData.video_url.length > 0) {
            return jobData.video_url;
        }

        if (status === 'failed') {
            const failReason = jobData?.error?.message || pollJson?.message || 'Video generation failed';
            throw new Error(`[${meta.shortName}] ${failReason}`);
        }
    }

    throw new Error(`Quá thời gian chờ kết xuất video (300s) từ ${meta.shortName}.`);
};

/**
 * Gọi API tạo video qua Muse AI Gateway (muse2api):
 * POST {museAiBaseUrl}/videos -> polling GET {museAiBaseUrl}/videos/{task_id}
 */
const executeMuseAiVideoCall = async (
    config: OpenRouterVideoConfig,
    options: GenerateOpenRouterVideoOptions,
    aspectRatio: '16:9' | '9:16' | '1:1',
    duration: number
): Promise<string> => {
    const rawBaseUrl = (config.museAiBaseUrl || 'http://127.0.0.1:18610/v1').trim();
    const baseUrl = rawBaseUrl.replace(/\/+$/, '');
    const apiKey = (config.museAiApiKey || '').trim();

    options.onProgress?.('Đang gửi yêu cầu tạo video tới Muse AI Gateway...');

    let imagePayload: string | undefined = undefined;
    if (options.inputImageBase64 && options.inputImageBase64.trim()) {
        const trimmed = options.inputImageBase64.trim();
        imagePayload = trimmed.startsWith('data:') || trimmed.startsWith('http')
            ? trimmed
            : `data:image/png;base64,${trimmed}`;
    }

    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const bodyPayload: Record<string, any> = {
        model: 'muse-video',
        prompt: options.prompt,
        size: aspectRatio,
        duration
    };
    if (imagePayload) {
        bodyPayload.image = imagePayload;
    }

    const submitResp = await fetch(`${baseUrl}/videos`, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload)
    });

    if (!submitResp.ok) {
        const errText = await submitResp.text().catch(() => '');
        throw new Error(`Muse AI Gateway lỗi (HTTP ${submitResp.status}): ${errText || submitResp.statusText}`);
    }

    const submitData = await submitResp.json();
    const taskId = submitData?.id;
    if (!taskId) {
        throw new Error('Muse AI Gateway không trả về mã tác vụ (Task ID).');
    }

    const maxAttempts = 200; // ~10 phút tối đa (3s/lần)
    for (let i = 1; i <= maxAttempts; i++) {
        await sleep(3000);
        const pollResp = await fetch(`${baseUrl}/videos/${encodeURIComponent(taskId)}`, {
            method: 'GET',
            headers
        });

        if (!pollResp.ok) {
            if (pollResp.status === 404) {
                throw new Error(`Không tìm thấy tác vụ video ${taskId} trên Muse AI Gateway.`);
            }
            continue;
        }

        const pollData = await pollResp.json();
        const progressText = typeof pollData.progress === 'number' && pollData.progress > 0
            ? ` (${pollData.progress}%)`
            : '';
        options.onProgress?.(`Vui lòng chờ${progressText} [${i * 3}s]...`);

        if (pollData.status === 'succeeded' && pollData.result?.url) {
            let videoUrl: string = pollData.result.url;
            // Chuẩn hóa link video: Nếu Muse AI Gateway trả về link IP VPS hoặc localhost thay vì public tunnel
            if (videoUrl.includes('/v1/media/')) {
                const mediaPath = videoUrl.substring(videoUrl.indexOf('/v1/media/'));
                const cleanBase = baseUrl.replace(/\/v1\/?$/, '');
                videoUrl = `${cleanBase}${mediaPath}`;
            }

            return videoUrl;
        }

        if (pollData.status === 'failed' || pollData.status === 'cancelled') {
            throw new Error(`Muse AI tạo video thất bại: ${pollData.error?.message || pollData.status}`);
        }
    }

    throw new Error('Quá thời gian chờ kết xuất video từ Muse AI Gateway.');
};

/**
 * Điều phối gọi API theo đúng nhà cung cấp của model (Vivix Chính chủ, idea.ai, Muse AI hoặc OpenRouter)
 */
const executeModelVideoCall = async (
    modelId: string,
    config: OpenRouterVideoConfig,
    options: GenerateOpenRouterVideoOptions,
    aspectRatio: '16:9' | '9:16' | '1:1',
    duration: number
): Promise<string> => {
    const meta = getVideoModelMeta(modelId);

    if (!isVideoModelProviderEnabled(meta.id, config)) {
        throw new Error(`Nguồn ${meta.providerLabel} (${meta.shortName}) hiện đang được tắt trên trang Quản trị (Admin Panel).`);
    }

    if (meta.provider === 'vivix_ai') {
        const vivixKey = (config.vivixAiApiKey || '').trim();
        if (!vivixKey) {
            throw new Error('Chưa cấu hình API Key Vivix Chính chủ (platform.vivix.ai) trên trang Quản trị. Vui lòng nhập API Key để sử dụng Vivix W1 real.');
        }
        return executeVivixVideoCall(meta.id, vivixKey, config, options, aspectRatio, duration);
    }

    if (meta.provider === 'idea_ai') {
        const ideaKey = (config.ideaAiApiKey || '').trim();
        if (!ideaKey) {
            throw new Error('Chưa cấu hình API Key idea.ai (cfak_...) trên trang Quản trị (Admin Panel). Vui lòng nhập API Key idea.ai để sử dụng Vivix W1 T.');
        }
        return executeIdeaAiVideoCall(meta.id, ideaKey, options, aspectRatio, duration);
    }

    if (meta.provider === 'muse_ai') {
        return executeMuseAiVideoCall(config, options, aspectRatio, duration);
    }

    const orKey = (config.openRouterApiKey || '').trim();
    if (!orKey) {
        throw new Error('Chưa cấu hình API Key OpenRouter (sk-or-v1-...) trên trang Quản trị (Admin Panel). Vui lòng nhập API Key OpenRouter.');
    }
    return executeOpenRouterVideoCall(meta.id, orKey, options, aspectRatio, duration);
};

/**
 * Tạo video chất lượng cao qua Vivix Chính chủ (Vivix W1 real), idea.ai (Vivix W1 T) hoặc OpenRouter (Grok video / Wan 3.0)
 * Hỗ trợ bật/tắt độc lập từng nguồn từ Admin Panel
 */
export const generateOpenRouterVideo = async (
    options: GenerateOpenRouterVideoOptions
): Promise<GenerateOpenRouterVideoResult> => {
    const config = await getVideoConfig();

    if (config.enabled === false) {
        throw new Error('Tính năng Tạo Video AI hiện đang tạm tắt trên trang Quản trị (Admin Panel).');
    }

    const enabledModels = OPENROUTER_VIDEO_MODELS.filter(m => isVideoModelProviderEnabled(m.id, config));
    if (enabledModels.length === 0) {
        throw new Error('Tất cả nguồn tạo video (Vivix Chính chủ, idea.ai & OpenRouter) hiện đang tạm tắt trên trang Quản trị.');
    }

    let requestedModel = (!options.modelOverride || options.modelOverride === 'auto' || options.modelOverride.includes('gemini-omni'))
        ? (config.primaryModel || enabledModels[0].id)
        : options.modelOverride;

    // Nếu model được yêu cầu thuộc nguồn đang bị tắt thì tự động chuyển sang model đang bật
    if (!isVideoModelProviderEnabled(requestedModel, config)) {
        requestedModel = enabledModels[0].id;
    }

    const primaryMeta = getVideoModelMeta(requestedModel);
    const aspectRatio: '16:9' | '9:16' | '1:1' = options.aspectRatio || config.defaultAspectRatio || '16:9';
    const duration = options.duration || config.defaultDuration || 5;

    // Chọn mô hình dự phòng đang được bật và có API Key hợp lệ
    const fallbackCandidate = enabledModels.find(
        m => m.id !== primaryMeta.id &&
             m.supportedAspectRatios.includes(aspectRatio) &&
             m.supportedDurations.includes(duration) &&
             (m.provider === 'vivix_ai'
                 ? Boolean(config.vivixAiApiKey?.trim())
                 : m.provider === 'idea_ai'
                 ? Boolean(config.ideaAiApiKey?.trim())
                 : m.provider === 'muse_ai'
                 ? Boolean(config.museAiApiKey?.trim() || config.museAiBaseUrl?.trim())
                 : Boolean(config.openRouterApiKey?.trim()))
    );

    const count = Math.max(1, Math.min(3, options.outputCount || 1));
    const urls: string[] = [];
    let finalModelUsed = primaryMeta.id;

    for (let i = 0; i < count; i++) {
        if (count > 1) {
            options.onProgress?.(`Đang tạo video ${i + 1}/${count} qua mô hình ${primaryMeta.shortName}...`);
        } else {
            options.onProgress?.(`Đang kết nối ${primaryMeta.providerLabel} (${primaryMeta.shortName})...`);
        }

        let videoUrl: string | null = null;

        try {
            videoUrl = await executeModelVideoCall(primaryMeta.id, config, options, aspectRatio, duration);
            finalModelUsed = primaryMeta.id;
        } catch (primaryErr: any) {
            console.warn(`[VideoAI] Mô hình chính ${primaryMeta.id} gặp lỗi:`, primaryErr);

            if (fallbackCandidate && (!options.modelOverride || options.modelOverride === 'auto')) {
                options.onProgress?.(`Mô hình ${primaryMeta.shortName} bận. Đang tự động chuyển sang ${fallbackCandidate.shortName}...`);
                try {
                    videoUrl = await executeModelVideoCall(fallbackCandidate.id, config, options, aspectRatio, duration);
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
        throw new Error('Không tạo được video nào. Vui lòng kiểm tra lại prompt hoặc số dư API.');
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
