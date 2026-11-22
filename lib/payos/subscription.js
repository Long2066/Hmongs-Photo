export const DAY_MS = 24 * 60 * 60 * 1000;
export const TERM_MS = 365 * DAY_MS;
export const ALLOWANCE = Object.freeze({ plus: 100, pro: 300, vip: 999999 });
export const FREE_VIDEO_SECONDS = 8;
export const VIDEO_ALLOWANCE = Object.freeze({ free: FREE_VIDEO_SECONDS, plus: 20, pro: 80, vip: 999999 });

const paid = (plan) => plan === 'plus' || plan === 'pro' || plan === 'vip';
const validCount = (val) => Number.isSafeInteger(val) && val >= 0;

function resolvePlanCfg(plan, options = {}) {
  if (options?.planConfig && (!options.planConfig.id || options.planConfig.id === plan)) {
    return options.planConfig;
  }
  return options?.plansConfig?.[plan] || null;
}

function isPlanUnlimited(plan, options = {}) {
  const cfg = resolvePlanCfg(plan, options);
  if (cfg && typeof cfg.unlimitedImages === 'boolean') return cfg.unlimitedImages;
  return plan === 'pro' || plan === 'vip';
}

function resolveFreeVideoSeconds(options = {}) {
  const val = options?.freeVideoSeconds ?? options?.plansConfig?.free?.videoSeconds;
  return validCount(val) ? val : FREE_VIDEO_SECONDS;
}

function resolvePaidVideoSeconds(plan, options = {}) {
  const cfg = resolvePlanCfg(plan, options);
  if (cfg && validCount(cfg.videoSeconds)) return cfg.videoSeconds;
  return VIDEO_ALLOWANCE[plan] ?? 0;
}

function resolvePaidImages(plan, options = {}) {
  const cfg = resolvePlanCfg(plan, options);
  if (cfg && validCount(cfg.totalImages)) return cfg.totalImages;
  return ALLOWANCE[plan] ?? 0;
}

function resolvePlanDurationMs(plan, options = {}) {
  const cfg = resolvePlanCfg(plan, options);
  if (cfg && Number.isSafeInteger(cfg.durationDays) && cfg.durationDays >= 1) {
    return cfg.durationDays * DAY_MS;
  }
  return TERM_MS;
}

/** Migrate legacy paid accounts & initialize Free video allowance for new accounts. */
export function normalizeSubscription(data, now, options = {}) {
  const current = { ...data };
  let changed = false;
  const freeVideoSec = resolveFreeVideoSeconds(options);

  if (!current.freeVideoGranted) {
    current.freeVideoGranted = true;
    if (!paid(current.plan) && !validCount(current.remainingVideoSeconds)) {
      current.remainingVideoSeconds = freeVideoSec;
      current.planAllowanceVideoSeconds = freeVideoSec;
    }
    current.lastUpdated = now;
    changed = true;
  }

  if (!validCount(current.remainingVideoSeconds)) {
    current.remainingVideoSeconds = paid(current.plan) ? resolvePaidVideoSeconds(current.plan, options) : 0;
    changed = true;
  }

  if (!paid(current.plan)) {
    if (current.remainingImages !== 0) {
      current.remainingImages = 0;
      changed = true;
    }
    return { data: current, changed };
  }

  if (!current.planMigratedAt) {
    const planVideoSec = resolvePaidVideoSeconds(current.plan, options);
    current.remainingImages = 50;
    current.remainingVideoSeconds = planVideoSec;
    current.planStartedAt = now;
    current.planExpiresAt = now + resolvePlanDurationMs(current.plan, options);
    current.planAllowanceImages = 50;
    current.planAllowanceVideoSeconds = planVideoSec;
    current.planMigratedAt = now;
    current.videoQuotaMigratedAt = now;
    current.lastUpdated = now;
    return { data: current, changed: true };
  }

  if (!current.videoQuotaMigratedAt) {
    const planVideoSec = resolvePaidVideoSeconds(current.plan, options);
    current.remainingVideoSeconds = planVideoSec;
    current.planAllowanceVideoSeconds = planVideoSec;
    current.videoQuotaMigratedAt = now;
    current.lastUpdated = now;
    changed = true;
  }

  if (!validCount(current.remainingImages) || !Number.isSafeInteger(current.planExpiresAt)) {
    throw new Error('Invalid stored subscription entitlement');
  }

  // Gói VIP vĩnh viễn không bao giờ hết hạn
  if (current.plan === 'vip') {
    if (current.planExpiresAt <= now) {
      current.planExpiresAt = now + 36500 * DAY_MS;
      current.lastUpdated = now;
      changed = true;
    }
    return { data: current, changed };
  }

  // Hết hạn gói -> đưa cả ảnh và giây video về 0, hạ gói về Free
  if (current.planExpiresAt <= now) {
    current.plan = 'free';
    current.remainingImages = 0;
    current.remainingVideoSeconds = 0;
    current.lastUpdated = now;
    return { data: current, changed: true };
  }

  // Hết cả lượt ảnh và giây video trước khi hết hạn -> hạ gói về Free (trừ gói không giới hạn ảnh)
  const unlimited = isPlanUnlimited(current.plan, options);
  if (!unlimited && current.remainingImages === 0 && current.remainingVideoSeconds === 0) {
    current.plan = 'free';
    current.lastUpdated = now;
    return { data: current, changed: true };
  }

  return { data: current, changed };
}

/** Only an active Plus -> Pro purchase or Pro top-up carries leftover images & video seconds. */
export function purchaseSubscription(data, purchasedPlan, now, options = {}) {
  if (!paid(purchasedPlan)) throw new Error('Invalid plan');
  const { data: existing } = normalizeSubscription(data, now, options);
  const isVip = purchasedPlan === 'vip' || existing.plan === 'vip';
  const finalPlan = isVip ? 'vip' : purchasedPlan;
  const baseImages = resolvePaidImages(purchasedPlan, options);
  const baseVideoSeconds = resolvePaidVideoSeconds(purchasedPlan, options);
  const durationMs = isVip ? 36500 * DAY_MS : resolvePlanDurationMs(purchasedPlan, options);
  const images = isVip ? 999999 : baseImages;
  const videoSeconds = isVip ? 999999 : baseVideoSeconds;
  if (!validCount(images) || !validCount(videoSeconds)) throw new Error('Invalid subscription allowance');
  return {
    ...existing,
    plan: finalPlan,
    remainingImages: images,
    planAllowanceImages: images,
    remainingVideoSeconds: videoSeconds,
    planAllowanceVideoSeconds: videoSeconds,
    freeVideoGranted: true,
    planStartedAt: now,
    planExpiresAt: now + durationMs,
    planMigratedAt: existing.planMigratedAt || now,
    videoQuotaMigratedAt: now,
    lastUpdated: now,
  };
}

export function consumeImages(data, count, now, options = {}) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 1000) throw new Error('Invalid image count');
  const { data: current } = normalizeSubscription(data, now, options);
  if (!paid(current.plan)) return null;
  if (isPlanUnlimited(current.plan, options)) {
    return { ...current, lastUpdated: now };
  }
  if (current.remainingImages < count) return null;
  const remainingImages = current.remainingImages - count;
  const remainingVideoSeconds = current.remainingVideoSeconds || 0;
  return {
    ...current,
    remainingImages,
    plan: remainingImages === 0 && remainingVideoSeconds === 0 ? 'free' : current.plan,
    lastUpdated: now,
  };
}

export function consumeVideoSeconds(data, seconds, now, options = {}) {
  if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 3600) throw new Error('Invalid video seconds');
  const { data: current } = normalizeSubscription(data, now, options);
  if (current.remainingVideoSeconds < seconds) return null;
  const remainingVideoSeconds = current.remainingVideoSeconds - seconds;
  const unlimited = isPlanUnlimited(current.plan, options);
  const nextPlan = paid(current.plan)
    ? (unlimited || ((current.remainingImages || 0) > 0 || remainingVideoSeconds > 0) ? current.plan : 'free')
    : 'free';
  return {
    ...current,
    remainingVideoSeconds,
    plan: nextPlan,
    lastUpdated: now,
  };
}
