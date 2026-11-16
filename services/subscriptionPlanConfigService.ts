import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../src/firebaseConfig';

export type PlanId = 'free' | 'plus' | 'pro';
export type MaxResolution = 'HD' | 'FHD' | '2K' | '4K';

export interface PlanFeatureItem {
    id: string;
    icon: 'check' | 'lock';
    text: string;
    highlight?: string;
}

export interface PlanConfig {
    id: PlanId;
    enabled: boolean;
    name: string;
    subtitle: string;
    badge: string;
    topRibbon: string;
    highlightBanner: string;
    price: number;
    originalPrice: number;
    periodLabel: string;
    quotaSummary: string;
    durationDays: number;
    dailyFreeLimit: number;
    unlimitedImages: boolean;
    totalImages: number;
    videoSeconds: number;
    maxResolution: MaxResolution;
    allModelsUnlocked: boolean;
    allowedImageModels: string[];
    featureItems: PlanFeatureItem[];
    ctaText: string;
    ctaTopUpText: string;
}

export interface SubscriptionPlansConfig {
    version: number;
    updatedAt: number;
    updatedBy: string;
    free: PlanConfig;
    plus: PlanConfig;
    pro: PlanConfig;
}

export const SUBSCRIPTION_PLANS_COLLECTION = 'appConfig';
export const SUBSCRIPTION_PLANS_DOC_ID = 'subscriptionPlans';
export const SUBSCRIPTION_PLANS_CACHE_KEY = 'app_subscription_plans_config_v1';
export const SUBSCRIPTION_PLANS_EVENT = 'subscription-plans-config-changed';

export const RESOLUTION_ORDER: Record<MaxResolution, number> = {
    HD: 1,
    FHD: 2,
    '2K': 3,
    '4K': 4,
};

export const DEFAULT_ALLOWED_IMAGE_MODELS: Record<PlanId, string[]> = {
    free: ['gemini-3.1-flash-image', 'gpt-image-1.5', 'muse-image'],
    plus: [
        'gemini-3.1-flash-image',
        'gpt-image-1.5',
        'muse-image',
        'gpt-image-2.5',
        'gpt-image-2.5-flare',
        'gpt-image-2.5-sunburst',
        'gpt-image-2',
    ],
    pro: [
        'gemini-3.1-flash-image',
        'gpt-image-1.5',
        'muse-image',
        'gpt-image-2.5',
        'gpt-image-2.5-flare',
        'gpt-image-2.5-sunburst',
        'gpt-image-2',
    ],
};

export const DEFAULT_SUBSCRIPTION_PLANS_CONFIG: SubscriptionPlansConfig = {
    version: 1,
    updatedAt: 0,
    updatedBy: '',
    free: {
        id: 'free',
        enabled: true,
        name: 'Gói Free',
        subtitle: 'Dành cho người mới trải nghiệm',
        badge: 'MẶC ĐỊNH',
        topRibbon: '',
        highlightBanner: '',
        price: 0,
        originalPrice: 0,
        periodLabel: '/ ngày',
        quotaSummary: 'Tặng 50 ảnh / ngày + 8s video cho tài khoản mới',
        durationDays: 0,
        dailyFreeLimit: 50,
        unlimitedImages: false,
        totalImages: 0,
        videoSeconds: 8,
        maxResolution: 'FHD',
        allModelsUnlocked: false,
        allowedImageModels: [...DEFAULT_ALLOWED_IMAGE_MODELS.free],
        featureItems: [
            { id: 'free-1', icon: 'check', text: 'Tạo tối đa 50 ảnh / ngày miễn phí', highlight: '50 ảnh / ngày' },
            { id: 'free-2', icon: 'check', text: 'Tặng 8 giây tạo Video AI', highlight: '8 giây tạo Video AI' },
            { id: 'free-3', icon: 'check', text: 'Tạo ảnh sử dụng model GPT 1.5', highlight: 'GPT 1.5' },
            { id: 'free-4', icon: 'lock', text: 'Giới hạn các model AI cao cấp & độ phân giải 2K/4K', highlight: '' },
        ],
        ctaText: 'Gói cơ bản miễn phí',
        ctaTopUpText: '',
    },
    plus: {
        id: 'plus',
        enabled: true,
        name: 'Gói Plus',
        subtitle: '300 ảnh + 60s Video AI • Tối đa FHD',
        badge: 'GIẢM 58%',
        topRibbon: '',
        highlightBanner: '',
        price: 50000,
        originalPrice: 120000,
        periodLabel: '/ 30 ngày',
        quotaSummary: '300 ảnh + 60 giây Video AI (hạn 30 ngày)',
        durationDays: 30,
        dailyFreeLimit: 0,
        unlimitedImages: false,
        totalImages: 300,
        videoSeconds: 60,
        maxResolution: 'FHD',
        allModelsUnlocked: false,
        allowedImageModels: [...DEFAULT_ALLOWED_IMAGE_MODELS.plus],
        featureItems: [
            { id: 'plus-1', icon: 'check', text: 'Nhận 300 ảnh và 60 giây tạo Video AI', highlight: '300 ảnh|60 giây tạo Video AI' },
            { id: 'plus-2', icon: 'check', text: 'Sử dụng full tất cả các tính năng trên công cụ', highlight: 'full tất cả các tính năng trên công cụ' },
            {
                id: 'plus-3',
                icon: 'check',
                text: 'Mở khóa các Model AI: GPT Image 2.5, GPT Image 2.5 Flare, GPT Image 2.5 Sunburst, GPT Image 2',
                highlight: 'GPT Image 2.5, GPT Image 2.5 Flare, GPT Image 2.5 Sunburst, GPT Image 2',
            },
            { id: 'plus-4', icon: 'check', text: 'Tạo ảnh độ phân giải tối đa mức FHD • Hết hạn sau 30 ngày', highlight: 'FHD|30 ngày' },
        ],
        ctaText: 'Mua Gói Plus — 50.000đ',
        ctaTopUpText: 'Mua thêm Gói Plus — 50.000đ',
    },
    pro: {
        id: 'pro',
        enabled: true,
        name: 'Gói Pro',
        subtitle: 'Tạo ảnh không giới hạn + 180s Video AI & Độ phân giải 4K',
        badge: 'CAO CẤP NHẤT',
        topRibbon: '⭐ CAO CẤP NHẤT & KHUYÊN DÙNG ⭐',
        highlightBanner: '🔥 Tạo ảnh hoàn toàn không bị giới hạn',
        price: 100000,
        originalPrice: 200000,
        periodLabel: '/ 30 ngày',
        quotaSummary: 'Tạo ảnh không giới hạn + 180 giây Video AI',
        durationDays: 30,
        dailyFreeLimit: 0,
        unlimitedImages: true,
        totalImages: 999999,
        videoSeconds: 180,
        maxResolution: '4K',
        allModelsUnlocked: true,
        allowedImageModels: [...DEFAULT_ALLOWED_IMAGE_MODELS.pro],
        featureItems: [
            { id: 'pro-1', icon: 'check', text: 'Tạo ảnh hoàn toàn không bị giới hạn và 180 giây tạo Video AI', highlight: '180 giây tạo Video AI' },
            { id: 'pro-2', icon: 'check', text: 'Sử dụng full các tính năng có trên Tool trong hạn mức của gói', highlight: 'full các tính năng có trên Tool' },
            { id: 'pro-3', icon: 'check', text: 'Mở khóa toàn bộ độ phân giải HD, FHD, 2K, 4K Ultra Sharp', highlight: 'HD, FHD, 2K, 4K Ultra Sharp' },
            { id: 'pro-4', icon: 'check', text: 'Mở khóa Full toàn bộ Model AI • Hết hạn sau 30 ngày', highlight: 'Full toàn bộ Model AI|30 ngày' },
        ],
        ctaText: 'Mua Gói Pro — 100.000đ',
        ctaTopUpText: 'Mua thêm Gói Pro — 100.000đ',
    },
};

export const cleanModelId = (modelId: string): string =>
    (modelId || '').replace(/^ag\//i, '').replace(/^openrouter\//i, '').trim().toLowerCase();

const sanitizeResolution = (val: unknown, fallback: MaxResolution): MaxResolution => {
    const up = String(val || '').trim().toUpperCase();
    if (up === 'HD' || up === 'FHD' || up === '2K' || up === '4K') return up;
    return fallback;
};

const toInt = (val: unknown, fallback: number, min = 0, max = 10_000_000): number => {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
};

const toStr = (val: unknown, fallback: string): string => (typeof val === 'string' ? val : fallback);

const sanitizeFeatureItems = (rawItems: unknown, fallback: PlanFeatureItem[]): PlanFeatureItem[] => {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return fallback.map((it) => ({ ...it }));
    }
    const items = rawItems
        .filter((it: any) => it && typeof it.text === 'string' && it.text.trim().length > 0)
        .map((it: any, idx: number): PlanFeatureItem => ({
            id: typeof it.id === 'string' && it.id.trim() ? it.id.trim() : `feat-${idx + 1}`,
            icon: it.icon === 'lock' ? 'lock' : 'check',
            text: it.text.trim(),
            highlight: typeof it.highlight === 'string' ? it.highlight : '',
        }));
    return items.length > 0 ? items : fallback.map((it) => ({ ...it }));
};

const sanitizePlanEntry = (planId: PlanId, raw: any, fallback: PlanConfig): PlanConfig => {
    const src = raw && typeof raw === 'object' ? raw : {};
    const isPaid = planId === 'plus' || planId === 'pro';
    const unlimitedImages = Boolean(src.unlimitedImages ?? fallback.unlimitedImages);
    const allowedImageModels: string[] = Array.isArray(src.allowedImageModels)
        ? Array.from(new Set<string>(src.allowedImageModels.map((m: unknown) => cleanModelId(String(m || ''))).filter(Boolean)))
        : [...fallback.allowedImageModels];

    return {
        id: planId,
        enabled: planId === 'free' ? true : src.enabled !== false,
        name: toStr(src.name, fallback.name).trim() || fallback.name,
        subtitle: toStr(src.subtitle, fallback.subtitle),
        badge: toStr(src.badge, fallback.badge),
        topRibbon: toStr(src.topRibbon, fallback.topRibbon),
        highlightBanner: toStr(src.highlightBanner, fallback.highlightBanner),
        price: planId === 'free' ? 0 : toInt(src.price, fallback.price, 2000, 100_000_000),
        originalPrice: toInt(src.originalPrice, fallback.originalPrice, 0, 100_000_000),
        periodLabel: toStr(src.periodLabel, fallback.periodLabel),
        quotaSummary: toStr(src.quotaSummary, fallback.quotaSummary),
        durationDays: isPaid ? toInt(src.durationDays, fallback.durationDays, 1, 3650) : 0,
        dailyFreeLimit: planId === 'free' ? toInt(src.dailyFreeLimit, fallback.dailyFreeLimit, 0, 10000) : 0,
        unlimitedImages,
        totalImages: planId === 'free'
            ? 0
            : unlimitedImages
                ? toInt(src.totalImages, 999999, 1, 9_999_999)
                : toInt(src.totalImages, fallback.totalImages, 0, 9_999_999),
        videoSeconds: toInt(src.videoSeconds, fallback.videoSeconds, 0, 100_000),
        maxResolution: sanitizeResolution(src.maxResolution, fallback.maxResolution),
        allModelsUnlocked: Boolean(src.allModelsUnlocked ?? fallback.allModelsUnlocked),
        allowedImageModels,
        featureItems: sanitizeFeatureItems(src.featureItems, fallback.featureItems),
        ctaText: toStr(src.ctaText, fallback.ctaText),
        ctaTopUpText: toStr(src.ctaTopUpText, fallback.ctaTopUpText),
    };
};

export const sanitizeSubscriptionPlansConfig = (raw: any): SubscriptionPlansConfig => {
    const src = raw && typeof raw === 'object' ? raw : {};
    return {
        version: 1,
        updatedAt: Number.isFinite(Number(src.updatedAt)) ? Number(src.updatedAt) : 0,
        updatedBy: typeof src.updatedBy === 'string' ? src.updatedBy : '',
        free: sanitizePlanEntry('free', src.free, DEFAULT_SUBSCRIPTION_PLANS_CONFIG.free),
        plus: sanitizePlanEntry('plus', src.plus, DEFAULT_SUBSCRIPTION_PLANS_CONFIG.plus),
        pro: sanitizePlanEntry('pro', src.pro, DEFAULT_SUBSCRIPTION_PLANS_CONFIG.pro),
    };
};

let memoryCache: SubscriptionPlansConfig | null = null;
let sharedUnsubscribe: (() => void) | null = null;

const persistAndNotify = (cfg: SubscriptionPlansConfig) => {
    memoryCache = cfg;
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(SUBSCRIPTION_PLANS_CACHE_KEY, JSON.stringify(cfg));
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(SUBSCRIPTION_PLANS_EVENT, { detail: cfg }));
        }
    } catch {
        // Ignore storage quota / SSR errors
    }
};

export const getCachedSubscriptionPlansConfig = (): SubscriptionPlansConfig => {
    if (memoryCache) return memoryCache;
    try {
        if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem(SUBSCRIPTION_PLANS_CACHE_KEY);
            if (raw) {
                const parsed = sanitizeSubscriptionPlansConfig(JSON.parse(raw));
                memoryCache = parsed;
                return parsed;
            }
        }
    } catch {
        // Ignore parse error and fall back to default
    }
    const def = sanitizeSubscriptionPlansConfig(DEFAULT_SUBSCRIPTION_PLANS_CONFIG);
    memoryCache = def;
    return def;
};

export const fetchSubscriptionPlansConfig = async (forceRefresh = false): Promise<SubscriptionPlansConfig> => {
    if (!forceRefresh && memoryCache && memoryCache.updatedAt > 0) {
        return memoryCache;
    }
    try {
        const ref = doc(db, SUBSCRIPTION_PLANS_COLLECTION, SUBSCRIPTION_PLANS_DOC_ID);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const cfg = sanitizeSubscriptionPlansConfig(snap.data());
            persistAndNotify(cfg);
            return cfg;
        }
    } catch (error) {
        console.warn('[SubscriptionPlans] Could not fetch config from Firestore:', error);
    }
    return getCachedSubscriptionPlansConfig();
};

export const initSubscriptionPlansConfigSync = (): (() => void) => {
    if (sharedUnsubscribe) return sharedUnsubscribe;
    try {
        const ref = doc(db, SUBSCRIPTION_PLANS_COLLECTION, SUBSCRIPTION_PLANS_DOC_ID);
        sharedUnsubscribe = onSnapshot(
            ref,
            (snap) => {
                if (snap.exists()) {
                    const cfg = sanitizeSubscriptionPlansConfig(snap.data());
                    persistAndNotify(cfg);
                } else {
                    persistAndNotify(sanitizeSubscriptionPlansConfig(DEFAULT_SUBSCRIPTION_PLANS_CONFIG));
                }
            },
            (err) => {
                console.warn('[SubscriptionPlans] Realtime listener error:', err?.message || err);
            }
        );
    } catch (error) {
        console.warn('[SubscriptionPlans] Failed to initialize snapshot listener:', error);
    }
    return () => {
        if (sharedUnsubscribe) {
            sharedUnsubscribe();
            sharedUnsubscribe = null;
        }
    };
};

export const subscribeToSubscriptionPlansConfig = (
    callback: (config: SubscriptionPlansConfig) => void
): (() => void) => {
    initSubscriptionPlansConfigSync();
    callback(getCachedSubscriptionPlansConfig());

    const handleEvent = (ev: Event) => {
        const custom = ev as CustomEvent<SubscriptionPlansConfig>;
        callback(custom.detail || getCachedSubscriptionPlansConfig());
    };

    if (typeof window !== 'undefined') {
        window.addEventListener(SUBSCRIPTION_PLANS_EVENT, handleEvent);
    }

    return () => {
        if (typeof window !== 'undefined') {
            window.removeEventListener(SUBSCRIPTION_PLANS_EVENT, handleEvent);
        }
    };
};

export const isImageModelAllowedByConfig = (
    modelId: string,
    planId: PlanId,
    config: SubscriptionPlansConfig = getCachedSubscriptionPlansConfig()
): boolean => {
    const planCfg = config[planId] || config.free;
    if (planCfg.allModelsUnlocked) return true;
    const clean = cleanModelId(modelId);
    return (planCfg.allowedImageModels || []).some((id) => cleanModelId(id) === clean);
};

export const isResolutionAllowedByConfig = (
    resolution: string,
    planId: PlanId,
    config: SubscriptionPlansConfig = getCachedSubscriptionPlansConfig()
): boolean => {
    const planCfg = config[planId] || config.free;
    const norm = sanitizeResolution(resolution, 'HD');
    return RESOLUTION_ORDER[norm] <= RESOLUTION_ORDER[planCfg.maxResolution];
};

export const formatVndCompact = (amount: number): string =>
    `${Math.max(0, Math.round(amount || 0)).toLocaleString('vi-VN')}đ`;

export const computeDiscountStats = (price: number, originalPrice: number) => {
    const cleanPrice = Math.max(0, Math.round(price || 0));
    const cleanOrig = Math.max(0, Math.round(originalPrice || 0));
    if (cleanOrig <= cleanPrice || cleanOrig === 0) {
        return { discountPercent: 0, savingsAmount: 0, hasDiscount: false };
    }
    const savingsAmount = cleanOrig - cleanPrice;
    const discountPercent = Math.round((savingsAmount / cleanOrig) * 100);
    return { discountPercent, savingsAmount, hasDiscount: discountPercent > 0 && savingsAmount > 0 };
};

export const buildAutoFeatureItems = (
    planId: PlanId,
    planCfg: PlanConfig,
    modelLabels: Record<string, string> = {}
): PlanFeatureItem[] => {
    const formatModelList = (ids: string[]) =>
        ids.map((id) => modelLabels[id] || id).join(', ');

    if (planId === 'free') {
        const items: PlanFeatureItem[] = [
            {
                id: 'free-1',
                icon: 'check',
                text: `Tạo tối đa ${planCfg.dailyFreeLimit} ảnh / ngày miễn phí`,
                highlight: `${planCfg.dailyFreeLimit} ảnh / ngày`,
            },
            {
                id: 'free-2',
                icon: 'check',
                text: `Tặng ${planCfg.videoSeconds} giây tạo Video AI`,
                highlight: `${planCfg.videoSeconds} giây tạo Video AI`,
            },
            {
                id: 'free-3',
                icon: 'check',
                text: planCfg.allModelsUnlocked
                    ? 'Mở khóa toàn bộ Model AI'
                    : `Tạo ảnh với model: ${formatModelList(planCfg.allowedImageModels.length ? planCfg.allowedImageModels : ['gpt-image-1.5'])}`,
                highlight: planCfg.allModelsUnlocked ? 'toàn bộ Model AI' : undefined,
            },
        ];
        if (RESOLUTION_ORDER[planCfg.maxResolution] < RESOLUTION_ORDER['4K']) {
            items.push({
                id: 'free-4',
                icon: 'lock',
                text: `Độ phân giải tối đa ${planCfg.maxResolution} • Giới hạn tính năng nâng cao`,
            });
        }
        return items;
    }

    const resChain = (['HD', 'FHD', '2K', '4K'] as MaxResolution[])
        .filter((r) => RESOLUTION_ORDER[r] <= RESOLUTION_ORDER[planCfg.maxResolution])
        .join(', ');

    const imageLine = planCfg.unlimitedImages
        ? `Tạo ảnh hoàn toàn không bị giới hạn và ${planCfg.videoSeconds} giây tạo Video AI`
        : `Nhận ${planCfg.totalImages} ảnh và ${planCfg.videoSeconds} giây tạo Video AI`;
    const imageHighlight = planCfg.unlimitedImages
        ? `${planCfg.videoSeconds} giây tạo Video AI`
        : `${planCfg.totalImages} ảnh|${planCfg.videoSeconds} giây tạo Video AI`;

    const modelLine = planCfg.allModelsUnlocked
        ? `Mở khóa Full toàn bộ Model AI • Hết hạn sau ${planCfg.durationDays} ngày`
        : `Mở khóa các Model AI: ${formatModelList(planCfg.allowedImageModels)}`;

    return [
        { id: `${planId}-1`, icon: 'check', text: imageLine, highlight: imageHighlight },
        {
            id: `${planId}-2`,
            icon: 'check',
            text: 'Sử dụng full tất cả các tính năng trên công cụ',
            highlight: 'full tất cả các tính năng trên công cụ',
        },
        {
            id: `${planId}-3`,
            icon: 'check',
            text: modelLine,
            highlight: planCfg.allModelsUnlocked ? `Full toàn bộ Model AI|${planCfg.durationDays} ngày` : formatModelList(planCfg.allowedImageModels),
        },
        {
            id: `${planId}-4`,
            icon: 'check',
            text: `Độ phân giải: ${resChain} • Hết hạn sau ${planCfg.durationDays} ngày`,
            highlight: `${resChain}|${planCfg.durationDays} ngày`,
        },
    ];
};
