export const PLAN_IDS = Object.freeze(['free', 'plus', 'pro']);
export const RESOLUTION_VALUES = Object.freeze(['HD', 'FHD', '2K', '4K']);
export const RESOLUTION_RANK = Object.freeze({ HD: 1, FHD: 2, '2K': 3, '4K': 4 });

export const DEFAULT_ALLOWED_IMAGE_MODELS = Object.freeze({
  free: Object.freeze(['gemini-3.1-flash-image', 'gpt-image-1.5', 'muse-image']),
  plus: Object.freeze([
    'gemini-3.1-flash-image',
    'gpt-image-1.5',
    'muse-image',
    'gpt-image-2.5',
    'gpt-image-2.5-flare',
    'gpt-image-2.5-sunburst',
    'gpt-image-2',
  ]),
  pro: Object.freeze([
    'gemini-3.1-flash-image',
    'gpt-image-1.5',
    'muse-image',
    'gpt-image-2.5',
    'gpt-image-2.5-flare',
    'gpt-image-2.5-sunburst',
    'gpt-image-2',
  ]),
});

export const DEFAULT_PLANS_CONFIG = Object.freeze({
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
});

export function cleanModelId(modelId) {
  return String(modelId || '')
    .replace(/^ag\//i, '')
    .replace(/^openrouter\//i, '')
    .trim()
    .toLowerCase();
}

export function sanitizeResolution(value, fallback = 'FHD') {
  const normalized = String(value || '').trim().toUpperCase();
  return RESOLUTION_VALUES.includes(normalized) ? normalized : fallback;
}

export function isResolutionAllowed(res, maxResolution) {
  const requestedRank = RESOLUTION_RANK[sanitizeResolution(res, 'HD')] || 1;
  const maxRank = RESOLUTION_RANK[sanitizeResolution(maxResolution, 'FHD')] || 2;
  return requestedRank <= maxRank;
}

export function isImageModelAllowedForPlanConfig(modelId, planCfg) {
  if (!planCfg) return false;
  if (planCfg.allModelsUnlocked) return true;
  const clean = cleanModelId(modelId);
  const allowed = Array.isArray(planCfg.allowedImageModels) ? planCfg.allowedImageModels : [];
  return allowed.some((id) => cleanModelId(id) === clean);
}

const toInt = (val, fallback, min = 0, max = 10_000_000) => {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  const rounded = Math.round(num);
  return Math.min(max, Math.max(min, rounded));
};

const toStr = (val, fallback) => (typeof val === 'string' ? val : fallback);

export function sanitizeFeatureItems(rawItems, fallbackItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return fallbackItems.map((item) => ({ ...item }));
  }
  const cleaned = rawItems
    .filter((item) => item && typeof item.text === 'string' && item.text.trim().length > 0)
    .map((item, idx) => ({
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `feat-${idx + 1}`,
      icon: item.icon === 'lock' ? 'lock' : 'check',
      text: item.text.trim(),
      highlight: typeof item.highlight === 'string' ? item.highlight : '',
    }));
  return cleaned.length > 0 ? cleaned : fallbackItems.map((item) => ({ ...item }));
}

export function sanitizePlanEntry(planId, raw, fallback = DEFAULT_PLANS_CONFIG[planId]) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const isPaidPlan = planId === 'plus' || planId === 'pro';
  const unlimitedImages = Boolean(src.unlimitedImages ?? fallback.unlimitedImages);
  const price = planId === 'free' ? 0 : toInt(src.price, fallback.price, 2000, 100_000_000);
  const originalPrice = toInt(src.originalPrice, fallback.originalPrice, 0, 100_000_000);
  const totalImages = planId === 'free'
    ? 0
    : unlimitedImages
      ? toInt(src.totalImages, 999999, 1, 9_999_999)
      : toInt(src.totalImages, fallback.totalImages, 0, 9_999_999);
  const dailyFreeLimit = planId === 'free' ? toInt(src.dailyFreeLimit, fallback.dailyFreeLimit, 0, 10000) : 0;
  const durationDays = isPaidPlan ? toInt(src.durationDays, fallback.durationDays, 1, 3650) : 0;
  const videoSeconds = toInt(src.videoSeconds, fallback.videoSeconds, 0, 100_000);
  const allowedImageModels = Array.isArray(src.allowedImageModels)
    ? Array.from(new Set(src.allowedImageModels.map(cleanModelId).filter(Boolean)))
    : [...fallback.allowedImageModels];

  return {
    id: planId,
    enabled: planId === 'free' ? true : src.enabled !== false,
    name: toStr(src.name, fallback.name).trim() || fallback.name,
    subtitle: toStr(src.subtitle, fallback.subtitle),
    badge: toStr(src.badge, fallback.badge),
    topRibbon: toStr(src.topRibbon, fallback.topRibbon),
    highlightBanner: toStr(src.highlightBanner, fallback.highlightBanner),
    price,
    originalPrice,
    periodLabel: toStr(src.periodLabel, fallback.periodLabel),
    quotaSummary: toStr(src.quotaSummary, fallback.quotaSummary),
    durationDays,
    dailyFreeLimit,
    unlimitedImages,
    totalImages,
    videoSeconds,
    maxResolution: sanitizeResolution(src.maxResolution, fallback.maxResolution),
    allModelsUnlocked: Boolean(src.allModelsUnlocked ?? fallback.allModelsUnlocked),
    allowedImageModels,
    featureItems: sanitizeFeatureItems(src.featureItems, fallback.featureItems),
    ctaText: toStr(src.ctaText, fallback.ctaText),
    ctaTopUpText: toStr(src.ctaTopUpText, fallback.ctaTopUpText),
  };
}

export function sanitizePlansConfig(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    version: 1,
    updatedAt: Number.isFinite(Number(src.updatedAt)) ? Number(src.updatedAt) : 0,
    updatedBy: typeof src.updatedBy === 'string' ? src.updatedBy : '',
    free: sanitizePlanEntry('free', src.free, DEFAULT_PLANS_CONFIG.free),
    plus: sanitizePlanEntry('plus', src.plus, DEFAULT_PLANS_CONFIG.plus),
    pro: sanitizePlanEntry('pro', src.pro, DEFAULT_PLANS_CONFIG.pro),
  };
}

const PLAN_CONFIG_CACHE_TTL_MS = 30_000;
let cachedPlansConfig = null;
let cachedAt = 0;

export function clearDynamicPlansCache() {
  cachedPlansConfig = null;
  cachedAt = 0;
}

export async function getDynamicPlansConfig(db, { forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && cachedPlansConfig && now - cachedAt < PLAN_CONFIG_CACHE_TTL_MS) {
    return cachedPlansConfig;
  }
  try {
    if (db && typeof db.collection === 'function') {
      const snap = await db.collection('appConfig').doc('subscriptionPlans').get();
      if (snap?.exists) {
        const sanitized = sanitizePlansConfig(snap.data());
        cachedPlansConfig = sanitized;
        cachedAt = now;
        return sanitized;
      }
    }
  } catch (err) {
    console.warn('[planConfig] Failed to load appConfig/subscriptionPlans, using defaults:', err?.message || err);
  }
  const fallback = sanitizePlansConfig(DEFAULT_PLANS_CONFIG);
  cachedPlansConfig = fallback;
  cachedAt = now;
  return fallback;
}
