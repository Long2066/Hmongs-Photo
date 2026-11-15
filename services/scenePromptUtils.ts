/**
 * Scene Ordering, Per-Scene Prompt Mapping, and Voice Directive Utilities
 * Used across Creative Image (up to 40 scenes), Batch Image Ordering, and Video Generation.
 */

export const MAX_STORY_SCENES = 40;

const SCENE_LINE_PREFIX_REGEX = /^(?:(?:cảnh|canh|dòng|dong|scene|shot)\s*\d+\s*[:.\-–—]*\s*|#?\d+\s*[:.)\-–—]\s*|[-*•]\s+)/i;

const NO_VOICE_PATTERN_SOURCE =
  String.raw`(?<=^|[\s,;(\[{|/-])(?:no[\s_-]*voice|without\s+voice|mute\s+character|silent\s+character|không\s+(?:có\s+)?(?:giọng\s+nói|tiếng\s+nói|nói\s+chuyện|thoại|lời\s+thoại)|không\s+nói)(?=$|[\s,;)\]}|.!/-])`;

const NO_VOICE_DETECT_REGEX = new RegExp(NO_VOICE_PATTERN_SOURCE, 'i');
const NO_VOICE_STRIP_REGEX = new RegExp(NO_VOICE_PATTERN_SOURCE, 'gi');

const DIALOGUE_CUE_REGEX =
  /(?:["“”«»]|(?:^|[\s,;(])(?:nói|bảo|hỏi|kể|thì thầm|hét|gọi|trả lời|thưa|speak|speaking|say|saying|talk|talking|dialogue|conversation|voice|whisper)(?=$|[\s,:;!?.]))/i;

export interface VoiceDirectiveAnalysis {
  isNoVoice: boolean;
  hasExplicitDialogue: boolean;
  cleanPrompt: string;
}

export interface VideoScenePromptSummary {
  lineCount: number;
  mappedPrompts: string[];
  noVoiceCount: number;
  effectiveMode: 'empty' | 'shared' | 'matched' | 'partial' | 'overflow';
}

/**
 * Natural numeric filename comparison (e.g. scene_1, scene_2, ..., scene_10, scene_40).
 */
export function naturalCompareFileNames(a: string = '', b: string = ''): number {
  const nameA = a.trim();
  const nameB = b.trim();
  const cmp = nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
  if (cmp !== 0) return cmp;
  return nameA.localeCompare(nameB);
}

/**
 * Strip optional scene numbering prefixes like "Cảnh 1:", "1.", "Scene 2 -", "- "
 * without stripping meaningful numbers inside sentences (e.g. "2 con gà").
 */
export function stripScenePrefix(line: string): string {
  return line.replace(SCENE_LINE_PREFIX_REGEX, '').trim();
}

/**
 * Extract ordered non-empty scene lines from a multi-line script/prompt input.
 */
export function extractSceneLines(rawText: string): string[] {
  if (!rawText || !rawText.trim()) return [];
  return rawText
    .split(/\r?\n/)
    .map((line) => stripScenePrefix(line.trim()))
    .filter((line) => line.length > 0);
}

/**
 * Map a single multi-line Motion Prompt string to an exact array of `sceneCount` prompts:
 * - 0 lines -> array of empty strings (uses natural motion fallback)
 * - 1 line  -> applied uniformly to every scene
 * - 2+ lines -> 1-to-1 positional mapping (line i -> scene i); extra scenes beyond line count get ''
 */
export function parseVideoScenePrompts(rawPrompt: string, sceneCount: number): string[] {
  const safeCount = Math.max(1, Math.min(MAX_STORY_SCENES, Math.floor(sceneCount) || 1));
  const lines = extractSceneLines(rawPrompt);

  if (lines.length === 0) {
    return Array(safeCount).fill('');
  }

  if (lines.length === 1) {
    return Array(safeCount).fill(lines[0]);
  }

  return Array.from({ length: safeCount }, (_, idx) => lines[idx] ?? '');
}

/**
 * Detect "no voice" (character silent, ambient foley audio preserved) or explicit dialogue cues.
 */
export function analyzeVoiceDirective(scenePrompt: string): VoiceDirectiveAnalysis {
  const raw = (scenePrompt || '').trim();
  if (!raw) {
    return { isNoVoice: false, hasExplicitDialogue: false, cleanPrompt: '' };
  }

  const isNoVoice = NO_VOICE_DETECT_REGEX.test(raw);
  if (!isNoVoice) {
    return {
      isNoVoice: false,
      hasExplicitDialogue: DIALOGUE_CUE_REGEX.test(raw),
      cleanPrompt: raw
    };
  }

  const cleanPrompt = raw
    .replace(NO_VOICE_STRIP_REGEX, ' ')
    .replace(/\(\s*[,;:\-\s/]*\)/g, ' ')
    .replace(/\[\s*[,;:\-\s/]*\]/g, ' ')
    .replace(/\{\s*[,;:\-\s/]*\}/g, ' ')
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/([,;:])\s*\1+/g, '$1')
    .replace(/,\s*\./g, '.')
    .replace(/^[\s,;:\-|/–—.]+|[\s,;:\-|/–—.]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    isNoVoice: true,
    hasExplicitDialogue: false,
    cleanPrompt
  };
}

/**
 * Inspect multi-line video prompt alignment against the uploaded image count for live UI feedback.
 */
export function summarizeVideoPromptLines(rawPrompt: string, sceneCount: number): VideoScenePromptSummary {
  const safeCount = Math.max(1, Math.min(MAX_STORY_SCENES, Math.floor(sceneCount) || 1));
  const lines = extractSceneLines(rawPrompt);
  const mappedPrompts = parseVideoScenePrompts(rawPrompt, safeCount);
  const noVoiceCount = mappedPrompts.filter((p) => analyzeVoiceDirective(p).isNoVoice).length;

  let effectiveMode: VideoScenePromptSummary['effectiveMode'] = 'empty';
  if (lines.length === 0) {
    effectiveMode = 'empty';
  } else if (lines.length === 1) {
    effectiveMode = 'shared';
  } else if (lines.length === safeCount) {
    effectiveMode = 'matched';
  } else if (lines.length < safeCount) {
    effectiveMode = 'partial';
  } else {
    effectiveMode = 'overflow';
  }

  return {
    lineCount: lines.length,
    mappedPrompts,
    noVoiceCount,
    effectiveMode
  };
}
