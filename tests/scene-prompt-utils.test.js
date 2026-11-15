import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_STORY_SCENES,
  naturalCompareFileNames,
  stripScenePrefix,
  extractSceneLines,
  parseVideoScenePrompts,
  analyzeVoiceDirective,
  summarizeVideoPromptLines
} from '../services/scenePromptUtils.ts';

test('naturalCompareFileNames sorts numeric filenames naturally 1..40', () => {
  const unsorted = ['Scene_10.png', 'Scene_2.png', 'Scene_40.png', 'Scene_1.png', 'Scene_20.png', 'Scene_3.png'];
  const sorted = [...unsorted].sort(naturalCompareFileNames);
  assert.deepEqual(sorted, [
    'Scene_1.png',
    'Scene_2.png',
    'Scene_3.png',
    'Scene_10.png',
    'Scene_20.png',
    'Scene_40.png'
  ]);
});

test('stripScenePrefix removes scene headers cleanly without breaking quantities', () => {
  assert.equal(stripScenePrefix('Cảnh 1: Thức dậy'), 'Thức dậy');
  assert.equal(stripScenePrefix('Dòng 12 - Đi lên nương'), 'Đi lên nương');
  assert.equal(stripScenePrefix('10. Cho gà ăn'), 'Cho gà ăn');
  assert.equal(stripScenePrefix('2 con gà chạy ra sân'), '2 con gà chạy ra sân');
});

test('extractSceneLines supports CRLF and LF multi-line scripts up to 40+ lines', () => {
  const input = '1. Thức dậy\r\n\r\nCảnh 2: Cho gà ăn\n3. Đi lên nương\n';
  assert.deepEqual(extractSceneLines(input), ['Thức dậy', 'Cho gà ăn', 'Đi lên nương']);
});

test('parseVideoScenePrompts maps 1-to-1 per line, shares 1-line prompt, and handles partial lines', () => {
  assert.deepEqual(parseVideoScenePrompts('', 3), ['', '', '']);
  assert.deepEqual(parseVideoScenePrompts('Chuyển động nhẹ nhàng', 3), [
    'Chuyển động nhẹ nhàng',
    'Chuyển động nhẹ nhàng',
    'Chuyển động nhẹ nhàng'
  ]);
  assert.deepEqual(
    parseVideoScenePrompts('Thức dậy nói chào buổi sáng\nCho gà ăn, no voice\nĐi lên nương no voice', 4),
    ['Thức dậy nói chào buổi sáng', 'Cho gà ăn, no voice', 'Đi lên nương no voice', '']
  );

  const fortyLines = Array.from({ length: 45 }, (_, i) => `Cảnh ${i + 1}: Hành động ${i + 1}`).join('\n');
  const mapped40 = parseVideoScenePrompts(fortyLines, 50);
  assert.equal(mapped40.length, MAX_STORY_SCENES);
  assert.equal(mapped40[0], 'Hành động 1');
  assert.equal(mapped40[39], 'Hành động 40');
});

test('analyzeVoiceDirective detects and strips no voice cleanly while detecting dialogue', () => {
  const silentComma = analyzeVoiceDirective('Ra sân cho gà ăn, no voice');
  assert.equal(silentComma.isNoVoice, true);
  assert.equal(silentComma.hasExplicitDialogue, false);
  assert.equal(silentComma.cleanPrompt, 'Ra sân cho gà ăn');

  const silentParens = analyzeVoiceDirective('Đi bộ lên nương (NO VOICE) giữa sương sớm');
  assert.equal(silentParens.isNoVoice, true);
  assert.equal(silentParens.cleanPrompt, 'Đi bộ lên nương giữa sương sớm');

  const silentBrackets = analyzeVoiceDirective('Ngồi bên bếp lửa [no-voice].');
  assert.equal(silentBrackets.isNoVoice, true);
  assert.equal(silentBrackets.cleanPrompt, 'Ngồi bên bếp lửa');

  const silentVi = analyzeVoiceDirective('Vươn vai thức dậy, không nói chuyện');
  assert.equal(silentVi.isNoVoice, true);
  assert.equal(silentVi.cleanPrompt, 'Vươn vai thức dậy');

  const onlyNoVoice = analyzeVoiceDirective('no voice');
  assert.equal(onlyNoVoice.isNoVoice, true);
  assert.equal(onlyNoVoice.cleanPrompt, '');

  const dialogue = analyzeVoiceDirective('Cô gái mỉm cười nói: "Chào buổi sáng!"');
  assert.equal(dialogue.isNoVoice, false);
  assert.equal(dialogue.hasExplicitDialogue, true);

  const nonMatching = analyzeVoiceDirective('Nghe tiếng nhạc nhẹ');
  assert.equal(nonMatching.isNoVoice, false);
  assert.equal(nonMatching.hasExplicitDialogue, false);
});

test('summarizeVideoPromptLines reports accurate alignment and no-voice count', () => {
  const matched = summarizeVideoPromptLines(
    'Nói chào ngày mới\nCho gà ăn, no voice\nĐi lên nương (no voice)',
    3
  );
  assert.equal(matched.effectiveMode, 'matched');
  assert.equal(matched.lineCount, 3);
  assert.equal(matched.noVoiceCount, 2);

  const partial = summarizeVideoPromptLines('Cảnh 1: Nói\nCảnh 2: no voice', 4);
  assert.equal(partial.effectiveMode, 'partial');
  assert.equal(partial.noVoiceCount, 1);

  const shared = summarizeVideoPromptLines('Lia máy chậm no voice', 5);
  assert.equal(shared.effectiveMode, 'shared');
  assert.equal(shared.noVoiceCount, 5);
});
