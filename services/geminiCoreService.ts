/**
 * geminiCoreService.ts
 * Centralized service for AI models, pricing, and configuration.
 * This manages all VIP/Pro features and cost calculations.
 */

// System API key for VIP features (encoded for basic protection)
const _sysKey = 'QUl6YVN5RGVvRXpXYXU4OVM0RVFYSDJnUUlZMjRXblZDbEpPeHV3';

/**
 * Decodes the system API key.
 */
const decodeSystemKey = (): string => {
    try {
        return atob(_sysKey);
    } catch (e) {
        console.error("Error decoding system key:", e);
        return '';
    }
};

export const getSystemApiKey = (): string => decodeSystemKey();

// ===== MODEL CONFIGURATION =====

export const GEMINI_TEXT_MODEL = 'gemini-3-flash-preview';

// Resolution definitions with dimensions
export type ResolutionType = 'HD' | 'FHD' | '2K' | '4K';

export const RESOLUTION_CONFIG: Record<ResolutionType, { width: number; height: number; label: string }> = {
    'HD': { width: 1280, height: 720, label: 'HD (1280x720)' },
    'FHD': { width: 1920, height: 1080, label: 'Full HD (1920x1080)' },
    '2K': { width: 2048, height: 2048, label: '2K (2048x2048)' },
    '4K': { width: 4096, height: 4096, label: '4K (4096x4096)' }
};

// Model definitions with pricing (VND) and supported resolutions
export interface ModelConfig {
    id: string;
    name: string;
    nameShort: string;
    pricePerImage: number; // VND per image
    supportedResolutions: ResolutionType[];
    maxResolution: ResolutionType;
    vipOnly: boolean;
    description: string;
    speed: 'fast' | 'medium' | 'slow';
    provider?: 'gemini'; // API provider (default: gemini)
}

export const AVAILABLE_IMAGE_MODELS: ModelConfig[] = [
    {
        id: 'gemini-2.5-flash-image', // Correct model name from Google docs
        name: 'Gemini 2.0 Flash Image',
        nameShort: 'G2.0 Flash',
        pricePerImage: 120, // 120đ per image
        supportedResolutions: ['HD', 'FHD', '2K'],
        maxResolution: '2K',
        vipOnly: false,
        description: 'Model cơ bản, tốc độ nhanh, giá rẻ',
        speed: 'fast',
        provider: 'gemini'
    },
    {
        id: 'gemini-3-pro-image-preview', // PRO model with 4K support
        name: 'Gemini 3 Pro (Premium)',
        nameShort: 'G3 Pro',
        pricePerImage: 800, // 800đ per image
        supportedResolutions: ['HD', 'FHD', '2K', '4K'],
        maxResolution: '4K',
        vipOnly: true,
        description: 'Chất lượng cao nhất, hỗ trợ 4K, vẽ text chính xác',
        speed: 'slow',
        provider: 'gemini'
    }
];

// Default models - using correct Google API model name
export const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image-preview'; // Latest flash image model for FREE users
export const GEMINI_PRO_IMAGE_MODEL = 'gemini-3-pro-image-preview';
export const GEMINI_VIP_MODEL = GEMINI_IMAGE_MODEL;

// ===== MODEL SELECTION MANAGEMENT =====

const SELECTED_MODEL_KEY = 'selected_image_model';
const SELECTED_RESOLUTION_KEY = 'selected_resolution';

export const getSelectedImageModel = (): string => {
    const saved = localStorage.getItem(SELECTED_MODEL_KEY);
    if (saved && AVAILABLE_IMAGE_MODELS.some(m => m.id === saved)) {
        return saved;
    }
    return GEMINI_IMAGE_MODEL;
};

export const setSelectedImageModel = (modelId: string): void => {
    if (AVAILABLE_IMAGE_MODELS.some(m => m.id === modelId)) {
        localStorage.setItem(SELECTED_MODEL_KEY, modelId);
        // Reset resolution if not supported by new model
        const model = getModelConfig(modelId);
        const currentRes = getSelectedResolution();
        if (model && !model.supportedResolutions.includes(currentRes)) {
            setSelectedResolution(model.supportedResolutions[0]);
        }
    }
};

export const getSelectedResolution = (): ResolutionType => {
    const saved = localStorage.getItem(SELECTED_RESOLUTION_KEY) as ResolutionType;
    const validResolutions: ResolutionType[] = ['HD', 'FHD', '2K', '4K'];
    if (saved && validResolutions.includes(saved)) {
        return saved;
    }
    return 'FHD'; // Default
};

export const setSelectedResolution = (resolution: ResolutionType): void => {
    localStorage.setItem(SELECTED_RESOLUTION_KEY, resolution);
};

export const getModelConfig = (modelId: string): ModelConfig | undefined => {
    return AVAILABLE_IMAGE_MODELS.find(m => m.id === modelId);
};

export const isSelectedModelVipOnly = (): boolean => {
    const selected = getSelectedImageModel();
    const model = AVAILABLE_IMAGE_MODELS.find(m => m.id === selected);
    return model?.vipOnly || false;
};

// ===== COST CALCULATION =====

export interface CostEstimate {
    modelId: string;
    modelName: string;
    resolution: ResolutionType;
    imageCount: number;
    pricePerImage: number;
    totalCost: number; // VND
    formattedTotal: string; // "1,200đ"
}

/**
 * Calculate cost for generating images
 */
export const calculateCost = (
    modelId: string,
    imageCount: number,
    resolution?: ResolutionType
): CostEstimate | null => {
    const model = getModelConfig(modelId);
    if (!model) return null;

    const res = resolution || getSelectedResolution();
    const pricePerImage = model.pricePerImage;
    const totalCost = pricePerImage * imageCount;

    return {
        modelId: model.id,
        modelName: model.name,
        resolution: res,
        imageCount,
        pricePerImage,
        totalCost,
        formattedTotal: formatVND(totalCost)
    };
};

/**
 * Format number as VND currency
 */
export const formatVND = (amount: number): string => {
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
};

/**
 * Get supported resolutions for a model
 */
export const getSupportedResolutions = (modelId: string): ResolutionType[] => {
    const model = getModelConfig(modelId);
    return model?.supportedResolutions || ['HD', 'FHD'];
};

/**
 * Check if resolution is supported by model
 */
export const isResolutionSupported = (modelId: string, resolution: ResolutionType): boolean => {
    const model = getModelConfig(modelId);
    return model?.supportedResolutions.includes(resolution) || false;
};

export default {
    getSystemApiKey,
    GEMINI_TEXT_MODEL,
    GEMINI_IMAGE_MODEL,
    GEMINI_PRO_IMAGE_MODEL,
    GEMINI_VIP_MODEL,
    AVAILABLE_IMAGE_MODELS,
    RESOLUTION_CONFIG,
    getSelectedImageModel,
    setSelectedImageModel,
    getSelectedResolution,
    setSelectedResolution,
    getModelConfig,
    isSelectedModelVipOnly,
    calculateCost,
    formatVND,
    getSupportedResolutions,
    isResolutionSupported
};


