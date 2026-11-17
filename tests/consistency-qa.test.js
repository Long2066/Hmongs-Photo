import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSmartVideoFrameLayout,
  buildFaceLockPrompt,
  canFallbackToTextOnlyImageGeneration
} from '../services/videoFidelityUtils.ts';
import { computeFaceCloseUpCropRect } from '../services/imageOptimizer.ts';
import {
  DEFAULT_STRICT_QA_THRESHOLD,
  evaluateConsistencyScores,
  parseVisionQaJsonResponse,
  buildCorrectiveRetryPrompt,
  selectBestQaCandidate
} from '../services/consistencyQaService.ts';

test('canFallbackToTextOnlyImageGeneration never allows dropping reference images', () => {
  assert.equal(canFallbackToTextOnlyImageGeneration(0), true);
  assert.equal(canFallbackToTextOnlyImageGeneration(1), false);
  assert.equal(canFallbackToTextOnlyImageGeneration(4), false);
});

test('computeFaceCloseUpCropRect builds bounded square crop centered around face & hair', () => {
  const rect = computeFaceCloseUpCropRect(1000, 1500, { x: 400, y: 200, width: 200, height: 220 });
  assert.equal(rect.size > 220, true);
  assert.equal(rect.sx >= 0 && rect.sx + rect.size <= 1000, true);
  assert.equal(rect.sy >= 0 && rect.sy + rect.size <= 1500, true);

  // Near top-left corner edge should clamp cleanly to (0, 0)
  const edgeRect = computeFaceCloseUpCropRect(800, 800, { x: 10, y: 5, width: 180, height: 180 });
  assert.equal(edgeRect.sx, 0);
  assert.equal(edgeRect.sy, 0);
  assert.equal(edgeRect.sx + edgeRect.size <= 800, true);
  assert.equal(edgeRect.sy + edgeRect.size <= 800, true);
});

test('computeSmartVideoFrameLayout preserves direct ratio, safe_contain whole subject, and smart_face_crop', () => {
  // Exact matching aspect ratio (within 1.02 tolerance) -> direct mode
  const direct = computeSmartVideoFrameLayout(1280, 720, 1280, 720, [], 'safe_contain');
  assert.equal(direct.mode, 'direct');

  // Vertical 9:16 portrait placed into 16:9 horizontal frame with safe_contain -> contain_blur (no head/outfit cut!)
  const contain = computeSmartVideoFrameLayout(720, 1280, 1280, 720, [], 'safe_contain');
  assert.equal(contain.mode, 'contain_blur');
  assert.equal(contain.dh, 720);
  assert.equal(contain.dw, 405);
  assert.equal(contain.dx > 0, true);

  // smart_face_crop keeps detected top face inside visible source crop window
  const faceCrop = computeSmartVideoFrameLayout(
    720,
    1280,
    1280,
    720,
    [{ x: 260, y: 120, width: 200, height: 220 }],
    'smart_face_crop'
  );
  assert.equal(faceCrop.mode, 'crop');
  assert.equal(faceCrop.sw, 720);
  assert.equal(faceCrop.sh, 405);
  assert.equal(faceCrop.sy <= 120, true);
  assert.equal(faceCrop.sy + faceCrop.sh >= 340, true);
});

test('buildFaceLockPrompt locks identity, DNA, motion stability, negative outfit swap, without forcing 4K photo style', () => {
  const res = buildFaceLockPrompt('nhân vật mỉm cười vẫy tay, no voice', true, {
    strictIdentityLock: true,
    strictMotionLock: true,
    characterDna: 'Young Hmong woman in cobalt indigo embroidered jacket with silver xauv necklace'
  });

  assert.equal(res.isNoVoice, true);
  assert.match(res.prompt, /CRITICAL IDENTITY & OUTFIT LOCK/);
  assert.match(res.prompt, /MOTION STABILITY LOCK/);
  assert.match(res.prompt, /IMMUTABLE CHARACTER DNA SPEC: Young Hmong woman/);
  assert.doesNotMatch(res.prompt, /4k cinematic photography/i);
  assert.match(res.negativePrompt, /wardrobe change, outfit swap/);
  assert.match(res.negativePrompt, /moving lips/);
});

test('evaluateConsistencyScores & parseVisionQaJsonResponse enforce strict threshold and per-axis floor', () => {
  // High overall average (90) MUST FAIL if faceScore (72) < axisFloor (80)
  const badFace = evaluateConsistencyScores({ faceScore: 72, outfitScore: 99, anatomyScore: 99 }, DEFAULT_STRICT_QA_THRESHOLD);
  assert.equal(badFace.passed, false);

  // High face (96) MUST FAIL if outfitScore (70) < axisFloor (80)
  const badOutfit = evaluateConsistencyScores({ faceScore: 96, outfitScore: 70, anatomyScore: 95 }, DEFAULT_STRICT_QA_THRESHOLD);
  assert.equal(badOutfit.passed, false);

  // Balanced high fidelity passes
  const good = evaluateConsistencyScores({ faceScore: 92, outfitScore: 88, anatomyScore: 85 }, DEFAULT_STRICT_QA_THRESHOLD);
  assert.equal(good.overallScore, 90);
  assert.equal(good.passed, true);

  const parsed = parseVisionQaJsonResponse(
    '```json\n{"face_score": 91, "outfit_score": 89, "anatomy_score": 86, "defects": [], "fix_instruction": "", "reason_summary": "Khớp mặt và trang phục gốc"}\n```',
    DEFAULT_STRICT_QA_THRESHOLD
  );
  assert.ok(parsed);
  assert.equal(parsed.passed, true);
  assert.equal(parsed.status, 'passed');
  assert.equal(parsed.overallScore, 90);

  assert.equal(parseVisionQaJsonResponse('not-json', DEFAULT_STRICT_QA_THRESHOLD), null);
});

test('buildCorrectiveRetryPrompt injects targeted axis fixes without stacking duplicate repair headers', () => {
  const prevReport = {
    passed: false,
    status: 'warning',
    faceScore: 68,
    outfitScore: 72,
    anatomyScore: 90,
    overallScore: 73,
    defects: ['Changed skirt color from indigo to red'],
    fixInstruction: 'Keep exact dark indigo embroidered skirt',
    reasonSummary: 'Sai mặt và đổi màu váy',
    checkedAt: Date.now()
  };

  const firstRetry = buildCorrectiveRetryPrompt('Woman walking in misty highland market', prevReport, 1, false);
  assert.match(firstRetry, /\[AUTO-REPAIR ATTEMPT #1\]/);
  assert.match(firstRetry, /MANDATORY FACE IDENTITY REPAIR/);
  assert.match(firstRetry, /MANDATORY OUTFIT & COLOR REPAIR/);

  const secondRetry = buildCorrectiveRetryPrompt(firstRetry, prevReport, 2, true);
  assert.doesNotMatch(secondRetry, /\[AUTO-REPAIR ATTEMPT #1\]/);
  assert.match(secondRetry, /\[AUTO-REPAIR ATTEMPT #2\]/);
});

test('selectBestQaCandidate keeps the highest-fidelity candidate across retries so retries never degrade output', () => {
  const failedAttempt1 = {
    result: 'clip_retry1.mp4',
    attempt: 1,
    report: {
      passed: false,
      status: 'warning',
      faceScore: 60,
      outfitScore: 70,
      anatomyScore: 80,
      overallScore: 66,
      defects: ['Face warped'],
      fixInstruction: '',
      reasonSummary: 'Face warped',
      checkedAt: 2
    }
  };
  const betterAttempt0 = {
    result: 'clip_initial.mp4',
    attempt: 0,
    report: {
      passed: false,
      status: 'warning',
      faceScore: 82,
      outfitScore: 78,
      anatomyScore: 88,
      overallScore: 82,
      defects: ['Slight trim color shift'],
      fixInstruction: '',
      reasonSummary: 'Slight trim shift',
      checkedAt: 1
    }
  };
  const passingAttempt2 = {
    result: 'clip_retry2.mp4',
    attempt: 2,
    report: {
      passed: true,
      status: 'passed',
      faceScore: 94,
      outfitScore: 91,
      anatomyScore: 90,
      overallScore: 92,
      defects: [],
      fixInstruction: '',
      reasonSummary: 'Match 100%',
      checkedAt: 3
    }
  };

  assert.equal(selectBestQaCandidate([failedAttempt1, betterAttempt0])?.result, 'clip_initial.mp4');
  assert.equal(selectBestQaCandidate([betterAttempt0, failedAttempt1, passingAttempt2])?.result, 'clip_retry2.mp4');
});
