import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSubscription,
  purchaseSubscription,
  consumeImages,
  consumeVideoSeconds,
  DAY_MS,
  TERM_MS,
} from '../lib/payos/subscription.js';

const NOW = 1700000000000;

test('migration grants 50 images for 30 days once despite legacy VND balance', () => {
  for (const plan of ['plus', 'pro']) {
    for (const credits of [0, 120000]) {
      const first = normalizeSubscription({ plan, credits }, NOW);
      assert.equal(first.changed, true);
      assert.equal(first.data.remainingImages, 50);
      assert.equal(first.data.planExpiresAt, NOW + TERM_MS);
      assert.equal(first.data.credits, credits);
      const second = normalizeSubscription(first.data, NOW + 1000);
      assert.equal(second.changed, false);
      assert.equal(second.data.remainingImages, 50);
    }
  }
});

test('new default purchase reflects Plus (300 imgs / 60s) & Pro (unlimited / 180s) with Plus carry-over', () => {
  const plus = purchaseSubscription({ credits: 0, plan: 'free' }, 'plus', NOW);
  assert.equal(plus.plan, 'plus');
  assert.equal(plus.remainingImages, 300);
  assert.equal(plus.remainingVideoSeconds, 60);
  assert.equal(plus.planExpiresAt, NOW + TERM_MS);

  const pro = purchaseSubscription({}, 'pro', NOW);
  assert.equal(pro.plan, 'pro');
  assert.equal(pro.remainingImages, 999999);
  assert.equal(pro.remainingVideoSeconds, 180);

  const upgrade = purchaseSubscription({ ...plus, remainingImages: 37, remainingVideoSeconds: 20 }, 'pro', NOW + 1000);
  assert.equal(upgrade.plan, 'pro');
  assert.equal(upgrade.remainingImages, 999999 + 37);
  assert.equal(upgrade.remainingVideoSeconds, 180 + 20);
  assert.equal(upgrade.planExpiresAt, NOW + 1000 + TERM_MS);
  assert.equal(upgrade.credits, 0);
});

test('exhaustion, unlimited Pro preservation, expiry, and raised batch caps work properly', () => {
  const plus = { ...purchaseSubscription({}, 'plus', NOW), remainingVideoSeconds: 0 };
  assert.equal(consumeImages(plus, 300, NOW + 1).plan, 'free');
  assert.equal(consumeImages(plus, 301, NOW + 1), null);
  assert.equal(consumeImages(plus, 1000, NOW + 1), null);
  assert.throws(() => consumeImages(plus, 1001, NOW + 1));

  // Pro unlimited preserves plan & image counter even on 1000-image batch
  const pro = purchaseSubscription({}, 'pro', NOW);
  const proAfter = consumeImages(pro, 1000, NOW + 1);
  assert.equal(proAfter.plan, 'pro');
  assert.equal(proAfter.remainingImages, 999999);

  // Expiry returns Free without migrating again
  const expired = normalizeSubscription(plus, NOW + TERM_MS);
  assert.equal(expired.data.plan, 'free');
  assert.equal(expired.data.remainingImages, 0);
  assert.equal(normalizeSubscription(expired.data, NOW + TERM_MS + 1).changed, false);
  assert.equal(consumeImages(plus, 1, NOW + TERM_MS), null);

  // Raised consumeVideoSeconds cap up to 3600s
  const highVideoUser = purchaseSubscription({}, 'pro', NOW, {
    planConfig: { id: 'pro', unlimitedImages: true, totalImages: 999999, videoSeconds: 3600, durationDays: 30 },
  });
  const afterBigRender = consumeVideoSeconds(highVideoUser, 3600, NOW + 1);
  assert.equal(afterBigRender.remainingVideoSeconds, 0);
  assert.equal(afterBigRender.plan, 'pro'); // Still unlimited images until planExpiresAt
  assert.throws(() => consumeVideoSeconds(highVideoUser, 3601, NOW + 1));
});

test('dynamic Admin planConfig options override durationDays, videoSeconds, unlimitedImages, and totalImages', () => {
  const customPlusCfg = {
    id: 'plus',
    price: 79000,
    durationDays: 45,
    unlimitedImages: false,
    totalImages: 500,
    videoSeconds: 120,
  };
  const customPlus = purchaseSubscription({ plan: 'free' }, 'plus', NOW, {
    planConfig: customPlusCfg,
    freeVideoSeconds: 15,
  });
  assert.equal(customPlus.plan, 'plus');
  assert.equal(customPlus.remainingImages, 500);
  assert.equal(customPlus.remainingVideoSeconds, 120);
  assert.equal(customPlus.planExpiresAt, NOW + 45 * DAY_MS);

  // Custom finite Pro (unlimitedImages: false) downgrades once both images and video reach 0
  const finiteProCfg = {
    id: 'pro',
    unlimitedImages: false,
    totalImages: 400,
    videoSeconds: 100,
    durationDays: 60,
  };
  const finitePro = {
    ...purchaseSubscription({}, 'pro', NOW, { planConfig: finiteProCfg }),
    remainingVideoSeconds: 0,
  };
  assert.equal(consumeImages(finitePro, 400, NOW + 1, { planConfig: finiteProCfg }).plan, 'free');

  // Custom free starter video allowance
  const newFree = normalizeSubscription({}, NOW, { freeVideoSeconds: 15 });
  assert.equal(newFree.data.remainingVideoSeconds, 15);
  assert.equal(newFree.data.planAllowanceVideoSeconds, 15);
});
