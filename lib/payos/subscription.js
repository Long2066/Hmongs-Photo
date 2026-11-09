export const TERM_MS = 30 * 24 * 60 * 60 * 1000;
export const ALLOWANCE = Object.freeze({ plus: 100, pro: 200 });
export const FREE_VIDEO_SECONDS = 8;
export const VIDEO_ALLOWANCE = Object.freeze({ free: FREE_VIDEO_SECONDS, plus: 60, pro: 180 });

const paid = (plan) => plan === 'plus' || plan === 'pro';
const validCount = (val) => Number.isSafeInteger(val) && val >= 0;

/** Migrate legacy paid accounts & initialize one-time 8s Free video allowance for new accounts. */
export function normalizeSubscription(data, now) {
  const current = { ...data };
  let changed = false;

  if (!current.freeVideoGranted) {
    current.freeVideoGranted = true;
    if (!paid(current.plan) && !validCount(current.remainingVideoSeconds)) {
      current.remainingVideoSeconds = FREE_VIDEO_SECONDS;
      current.planAllowanceVideoSeconds = FREE_VIDEO_SECONDS;
    }
    current.lastUpdated = now;
    changed = true;
  }

  if (!validCount(current.remainingVideoSeconds)) {
    current.remainingVideoSeconds = paid(current.plan) ? VIDEO_ALLOWANCE[current.plan] : 0;
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
    current.remainingImages = 50;
    current.remainingVideoSeconds = VIDEO_ALLOWANCE[current.plan];
    current.planStartedAt = now;
    current.planExpiresAt = now + TERM_MS;
    current.planAllowanceImages = 50;
    current.planAllowanceVideoSeconds = VIDEO_ALLOWANCE[current.plan];
    current.planMigratedAt = now;
    current.videoQuotaMigratedAt = now;
    current.lastUpdated = now;
    return { data: current, changed: true };
  }

  if (!current.videoQuotaMigratedAt) {
    current.remainingVideoSeconds = VIDEO_ALLOWANCE[current.plan];
    current.planAllowanceVideoSeconds = VIDEO_ALLOWANCE[current.plan];
    current.videoQuotaMigratedAt = now;
    current.lastUpdated = now;
    changed = true;
  }

  if (!validCount(current.remainingImages) || !Number.isSafeInteger(current.planExpiresAt)) {
    throw new Error('Invalid stored subscription entitlement');
  }

  // Hết hạn 30 ngày -> đưa cả ảnh và giây video về 0, hạ gói về Free
  if (current.planExpiresAt <= now) {
    current.plan = 'free';
    current.remainingImages = 0;
    current.remainingVideoSeconds = 0;
    current.lastUpdated = now;
    return { data: current, changed: true };
  }

  // Hết cả lượt ảnh và giây video trước 30 ngày -> hạ gói về Free
  if (current.remainingImages === 0 && current.remainingVideoSeconds === 0) {
    current.plan = 'free';
    current.lastUpdated = now;
    return { data: current, changed: true };
  }

  return { data: current, changed };
}

/** Only an active Plus -> Pro purchase or Pro top-up carries leftover images & video seconds. */
export function purchaseSubscription(data, purchasedPlan, now) {
  if (!paid(purchasedPlan)) throw new Error('Invalid plan');
  const { data: existing } = normalizeSubscription(data, now);
  const carryPlusImages = existing.plan === 'plus' && purchasedPlan === 'pro' ? existing.remainingImages : 0;
  const carryPlusVideo = existing.plan === 'plus' && purchasedPlan === 'pro' ? existing.remainingVideoSeconds : 0;
  // Preserve Pro status on a smaller top-up; never silently downgrade an active Pro purchase.
  const proTopUp = existing.plan === 'pro' && purchasedPlan === 'plus';
  const finalPlan = proTopUp ? 'pro' : purchasedPlan;
  const images = ALLOWANCE[purchasedPlan] + (proTopUp ? existing.remainingImages : carryPlusImages);
  const videoSeconds = VIDEO_ALLOWANCE[purchasedPlan] + (proTopUp ? existing.remainingVideoSeconds : carryPlusVideo);
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
    planExpiresAt: now + TERM_MS,
    planMigratedAt: existing.planMigratedAt || now,
    videoQuotaMigratedAt: now,
    lastUpdated: now,
  };
}

export function consumeImages(data, count, now) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 200) throw new Error('Invalid image count');
  const { data: current } = normalizeSubscription(data, now);
  if (!paid(current.plan) || current.remainingImages < count) return null;
  const remainingImages = current.remainingImages - count;
  const remainingVideoSeconds = current.remainingVideoSeconds || 0;
  return {
    ...current,
    remainingImages,
    plan: remainingImages === 0 && remainingVideoSeconds === 0 ? 'free' : current.plan,
    lastUpdated: now,
  };
}

export function consumeVideoSeconds(data, seconds, now) {
  if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 180) throw new Error('Invalid video seconds');
  const { data: current } = normalizeSubscription(data, now);
  if (current.remainingVideoSeconds < seconds) return null;
  const remainingVideoSeconds = current.remainingVideoSeconds - seconds;
  const nextPlan = paid(current.plan)
    ? ((current.remainingImages || 0) === 0 && remainingVideoSeconds === 0 ? 'free' : current.plan)
    : 'free';
  return {
    ...current,
    remainingVideoSeconds,
    plan: nextPlan,
    lastUpdated: now,
  };
}
