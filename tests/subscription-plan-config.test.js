import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PLANS_CONFIG,
  cleanModelId,
  isImageModelAllowedForPlanConfig,
  isResolutionAllowed,
  sanitizePlansConfig,
} from '../lib/payos/planConfig.js';

test('DEFAULT_PLANS_CONFIG exposes synced defaults for Free, Plus, and Pro', () => {
  assert.equal(DEFAULT_PLANS_CONFIG.free.price, 0);
  assert.equal(DEFAULT_PLANS_CONFIG.free.dailyFreeLimit, 50);
  assert.equal(DEFAULT_PLANS_CONFIG.free.videoSeconds, 8);
  assert.equal(DEFAULT_PLANS_CONFIG.free.maxResolution, 'FHD');

  assert.equal(DEFAULT_PLANS_CONFIG.plus.price, 50000);
  assert.equal(DEFAULT_PLANS_CONFIG.plus.totalImages, 300);
  assert.equal(DEFAULT_PLANS_CONFIG.plus.videoSeconds, 60);
  assert.equal(DEFAULT_PLANS_CONFIG.plus.maxResolution, 'FHD');

  assert.equal(DEFAULT_PLANS_CONFIG.pro.price, 100000);
  assert.equal(DEFAULT_PLANS_CONFIG.pro.unlimitedImages, true);
  assert.equal(DEFAULT_PLANS_CONFIG.pro.videoSeconds, 180);
  assert.equal(DEFAULT_PLANS_CONFIG.pro.maxResolution, '4K');
  assert.equal(DEFAULT_PLANS_CONFIG.pro.allModelsUnlocked, true);
});

test('sanitizePlansConfig enforces pricing bounds, duration bounds, resolution fallback, and feature cleanup', () => {
  const sanitized = sanitizePlansConfig({
    updatedAt: 123456,
    updatedBy: 'admin@toolphoto.com',
    free: {
      enabled: false, // Free cannot be disabled
      price: 5000, // Free must stay 0
      dailyFreeLimit: 75,
      videoSeconds: 12,
      maxResolution: '8K', // Invalid -> fallback FHD
      featureItems: [
        { id: 'a', icon: 'check', text: '  75 anh free  ', highlight: '75 anh' },
        { id: 'b', icon: 'lock', text: '   ' }, // empty dropped
      ],
    },
    plus: {
      enabled: false,
      price: 500, // Below PayOS min 2000 -> clamped to 2000
      durationDays: 0, // Clamped >= 1
      totalImages: 450,
      videoSeconds: 90,
      maxResolution: '2k',
      allowedImageModels: ['ag/GPT-Image-2.5', 'openrouter/gpt-image-1.5', 'gpt-image-2.5'],
    },
    pro: {
      price: 150000,
      unlimitedImages: false,
      totalImages: 1200,
      allModelsUnlocked: false,
    },
  });

  assert.equal(sanitized.free.enabled, true);
  assert.equal(sanitized.free.price, 0);
  assert.equal(sanitized.free.dailyFreeLimit, 75);
  assert.equal(sanitized.free.videoSeconds, 12);
  assert.equal(sanitized.free.maxResolution, 'FHD');
  assert.equal(sanitized.free.featureItems.length, 1);
  assert.equal(sanitized.free.featureItems[0].text, '75 anh free');

  assert.equal(sanitized.plus.enabled, false);
  assert.equal(sanitized.plus.price, 2000);
  assert.equal(sanitized.plus.durationDays, 1);
  assert.equal(sanitized.plus.totalImages, 450);
  assert.equal(sanitized.plus.videoSeconds, 90);
  assert.equal(sanitized.plus.maxResolution, '2K');
  assert.deepEqual(sanitized.plus.allowedImageModels, ['gpt-image-2.5', 'gpt-image-1.5']);

  assert.equal(sanitized.pro.price, 150000);
  assert.equal(sanitized.pro.unlimitedImages, false);
  assert.equal(sanitized.pro.totalImages, 1200);
  assert.equal(sanitized.pro.allModelsUnlocked, false);
});

test('isResolutionAllowed enforces hierarchy HD < FHD < 2K < 4K', () => {
  assert.equal(isResolutionAllowed('HD', 'HD'), true);
  assert.equal(isResolutionAllowed('FHD', 'HD'), false);
  assert.equal(isResolutionAllowed('FHD', 'FHD'), true);
  assert.equal(isResolutionAllowed('2K', 'FHD'), false);
  assert.equal(isResolutionAllowed('2K', '2K'), true);
  assert.equal(isResolutionAllowed('4K', '2K'), false);
  assert.equal(isResolutionAllowed('4K', '4K'), true);
});

test('isImageModelAllowedForPlanConfig handles provider prefixes and full unlock flag', () => {
  assert.equal(cleanModelId('AG/GPT-Image-2.5 '), 'gpt-image-2.5');
  assert.equal(cleanModelId('openrouter/gemini-3.1-flash-image'), 'gemini-3.1-flash-image');

  const lockedCfg = {
    allModelsUnlocked: false,
    allowedImageModels: ['gpt-image-1.5', 'muse-image'],
  };
  assert.equal(isImageModelAllowedForPlanConfig('ag/gpt-image-1.5', lockedCfg), true);
  assert.equal(isImageModelAllowedForPlanConfig('gpt-image-2.5', lockedCfg), false);

  const unlockedCfg = {
    allModelsUnlocked: true,
    allowedImageModels: [],
  };
  assert.equal(isImageModelAllowedForPlanConfig('custom-future-model', unlockedCfg), true);
});
