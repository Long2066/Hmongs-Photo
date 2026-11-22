export const PLAN_IDS = Object.freeze(['free', 'plus', 'pro', 'vip']);
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
  vip: Object.freeze([
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
  version: 2,
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
    quotaSummary: 'Tặng 30 ảnh / ngày + 8s video cho tài khoản mới',
    durationDays: 0,
    dailyFreeLimit: 30,
    dailyImageLimit: 30,
    dailyVideoLimit: 2,
    maxConcurrency: 1,
    allowStrongRestore: false,
    unlimitedImages: false,
    totalImages: 0,
    videoSeconds: 8,
    maxResolution: 'FHD',
    allModelsUnlocked: false,
    allowedImageModels: [...DEFAULT_ALLOWED_IMAGE_MODELS.free],
    featureItems: [
      { id: 'free-1', icon: 'check', text: 'Tạo tối đa 30 ảnh / ngày miễn phí', highlight: '30 ảnh / ngày' },
      { id: 'free-2', icon: 'check', text: 'Tặng 8 giây tạo Video AI', highlight: '8 giây tạo Video AI' },
      { id: 'free-3', icon: 'check', text: 'Tối đa 1 luồng xử lý', highlight: '1 luồng' },
      { id: 'free-4', icon: 'lock', text: 'Giới hạn độ phân giải 2K, 4K & phục hồi chuyên sâu', highlight: '' },
    ],
    ctaText: 'Gói cơ bản miễn phí',
    ctaTopUpText: '',
  },
  plus: {
    id: 'plus',
    enabled: true,
    name: 'Gói Cơ bản',
    subtitle: '2 luồng song song • 100 ảnh + 20 video / ngày',
    badge: 'TIẾT KIỆM',
    topRibbon: '',
    highlightBanner: '⚡ Tự động reset 100 ảnh & 20 video mỗi ngày',
    price: 100000,
    originalPrice: 200000,
    periodLabel: '/ 12 tháng',
    quotaSummary: '100 ảnh + 20 video / ngày (Reset mỗi ngày) • Hạn 12 tháng',
    durationDays: 365,
    dailyFreeLimit: 100,
    dailyImageLimit: 100,
    dailyVideoLimit: 20,
    maxConcurrency: 2,
    allowStrongRestore: false,
    unlimitedImages: false,
    totalImages: 100,
    videoSeconds: 20,
    maxResolution: 'FHD',
    allModelsUnlocked: false,
    allowedImageModels: [...DEFAULT_ALLOWED_IMAGE_MODELS.plus],
    featureItems: [
      { id: 'plus-1', icon: 'check', text: 'Tạo tối đa 2 luồng song song (Ảnh & Video)', highlight: '2 luồng song song' },
      { id: 'plus-2', icon: 'check', text: 'Tạo tối đa 100 ảnh + 20 video / ngày (Reset mỗi ngày)', highlight: '100 ảnh + 20 video / ngày' },
      { id: 'plus-3', icon: 'check', text: 'Độ phân giải tối đa mức FHD sắc nét', highlight: 'FHD' },
      { id: 'plus-4', icon: 'check', text: 'Thời hạn sử dụng 12 tháng (365 ngày)', highlight: '12 tháng' },
      { id: 'plus-5', icon: 'lock', text: 'Khóa tùy chọn "Mạnh" trong tính năng phục hồi ảnh cũ', highlight: 'Mạnh' },
    ],
    ctaText: 'Mua Gói Cơ bản — 100.000đ',
    ctaTopUpText: 'Gia hạn Gói Cơ bản — 100.000đ',
  },
  pro: {
    id: 'pro',
    enabled: true,
    name: 'Gói Nâng cao',
    subtitle: '4 luồng song song • 300 ảnh + 80 video / ngày',
    badge: 'PHỔ BIẾN NHẤT',
    topRibbon: '🔥 LỰA CHỌN PHỔ BIẾN NHẤT 🔥',
    highlightBanner: '🚀 Tự động reset 300 ảnh & 80 video mỗi ngày',
    price: 250000,
    originalPrice: 400000,
    periodLabel: '/ 12 tháng',
    quotaSummary: '300 ảnh + 80 video / ngày (Reset mỗi ngày) • Hạn 12 tháng',
    durationDays: 365,
    dailyFreeLimit: 300,
    dailyImageLimit: 300,
    dailyVideoLimit: 80,
    maxConcurrency: 4,
    allowStrongRestore: false,
    unlimitedImages: false,
    totalImages: 300,
    videoSeconds: 80,
    maxResolution: '2K',
    allModelsUnlocked: true,
    allowedImageModels: [...DEFAULT_ALLOWED_IMAGE_MODELS.pro],
    featureItems: [
      { id: 'pro-1', icon: 'check', text: 'Tạo tối đa 4 luồng song song (Ảnh & Video)', highlight: '4 luồng song song' },
      { id: 'pro-2', icon: 'check', text: 'Tạo tối đa 300 ảnh + 80 video / ngày (Reset mỗi ngày)', highlight: '300 ảnh + 80 video / ngày' },
      { id: 'pro-3', icon: 'check', text: 'Độ phân giải tối đa lên mức 2K sắc nét cao cấp', highlight: '2K' },
      { id: 'pro-4', icon: 'check', text: 'Thời hạn sử dụng 12 tháng (365 ngày)', highlight: '12 tháng' },
      { id: 'pro-5', icon: 'lock', text: 'Khóa tùy chọn "Mạnh" trong tính năng phục hồi ảnh cũ', highlight: 'Mạnh' },
    ],
    ctaText: 'Mua Gói Nâng cao — 250.000đ',
    ctaTopUpText: 'Gia hạn Gói Nâng cao — 250.000đ',
  },
  vip: {
    id: 'vip',
    enabled: true,
    name: 'Gói Cao cấp',
    subtitle: '10 luồng song song • Không giới hạn ảnh & video • Mở full tính năng',
    badge: 'VĨNH VIỄN',
    topRibbon: '👑 ĐẲNG CẤP CAO CẤP NHẤT - TRỌN ĐỜI 👑',
    highlightBanner: '✨ Mở toàn quyền không giới hạn ảnh và video AI vĩnh viễn',
    price: 300000,
    originalPrice: 600000,
    periodLabel: '/ Vĩnh viễn',
    quotaSummary: 'Không giới hạn số lượt tạo ảnh và video AI • Sở hữu Vĩnh viễn',
    durationDays: 36500,
    dailyFreeLimit: 0,
    dailyImageLimit: 999999,
    dailyVideoLimit: 999999,
    maxConcurrency: 10,
    allowStrongRestore: true,
    unlimitedImages: true,
    totalImages: 999999,
    videoSeconds: 999999,
    maxResolution: '4K',
    allModelsUnlocked: true,
    allowedImageModels: [...DEFAULT_ALLOWED_IMAGE_MODELS.vip],
    featureItems: [
      { id: 'vip-1', icon: 'check', text: 'Mở toàn quyền truy cập tất cả tính năng trên Tool', highlight: 'toàn quyền truy cập' },
      { id: 'vip-2', icon: 'check', text: 'Xử lý song song tối đa (Lên tới 8-10 luồng tốc độ cao)', highlight: '8-10 luồng' },
      { id: 'vip-3', icon: 'check', text: 'Không giới hạn số lượt tạo ảnh và video AI', highlight: 'Không giới hạn' },
      { id: 'vip-4', icon: 'check', text: 'Mở khóa toàn bộ độ phân giải tối đa 4K Ultra Sharp', highlight: '4K Ultra Sharp' },
      { id: 'vip-5', icon: 'check', text: 'Mở khóa toàn quyền tùy chọn "Mạnh" phục hồi ảnh cũ', highlight: 'Mạnh' },
      { id: 'vip-6', icon: 'check', text: 'Sở hữu vĩnh viễn không giới hạn thời gian', highlight: 'vĩnh viễn' },
    ],
    ctaText: 'Mua Gói Cao cấp — 300.000đ',
    ctaTopUpText: 'Đã kích hoạt Gói Cao cấp',
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
  const isPaidPlan = planId === 'plus' || planId === 'pro' || planId === 'vip';
  const unlimitedImages = Boolean(src.unlimitedImages ?? fallback.unlimitedImages);
  const price = planId === 'free' ? 0 : toInt(src.price, fallback.price, 2000, 100_000_000);
  const originalPrice = toInt(src.originalPrice, fallback.originalPrice, 0, 100_000_000);
  const totalImages = planId === 'free'
    ? 0
    : unlimitedImages
      ? toInt(src.totalImages, 999999, 1, 9_999_999)
      : toInt(src.totalImages, fallback.totalImages, 0, 9_999_999);
  const dailyFreeLimit = planId === 'free' ? toInt(src.dailyFreeLimit, fallback.dailyFreeLimit, 0, 10000) : 0;
  const durationDays = isPaidPlan ? toInt(src.durationDays, fallback.durationDays, 1, 36500) : 0;
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
  const rawVersion = typeof src.version === 'number' ? src.version : 0;
  if (rawVersion < 2) {
    return {
      ...DEFAULT_PLANS_CONFIG,
      updatedAt: Number.isFinite(Number(src.updatedAt)) ? Number(src.updatedAt) : 0,
      updatedBy: typeof src.updatedBy === 'string' ? src.updatedBy : 'Auto-Upgraded v2',
    };
  }
  return {
    version: Math.max(2, rawVersion),
    updatedAt: Number.isFinite(Number(src.updatedAt)) ? Number(src.updatedAt) : 0,
    updatedBy: typeof src.updatedBy === 'string' ? src.updatedBy : '',
    free: sanitizePlanEntry('free', src.free, DEFAULT_PLANS_CONFIG.free),
    plus: sanitizePlanEntry('plus', src.plus, DEFAULT_PLANS_CONFIG.plus),
    pro: sanitizePlanEntry('pro', src.pro, DEFAULT_PLANS_CONFIG.pro),
    vip: sanitizePlanEntry('vip', src.vip, DEFAULT_PLANS_CONFIG.vip),
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
