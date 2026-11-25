// The Story script: one entry per caption key, in the order the recorded video walks the lab (video/take.py's SCENES). Pure data, no DOM: the page wiring
// turns each entry into an engine step (a selector, a live line). The wording is in video/captions.md; the story tests check the two agree, and that the
// order, the numbered-bubble counts and the prompts equal take.py's.
//
//   target   a CSS selector | { last, fallback } the last match of a selector (the run's latest reply or evidence) | { selector, unless, check }
//            A bubble whose target is not there is skipped.
//   prompt   { text, press } fill the composer with text and press that existing button (the lab's Send) — the viewer presses Send (Play presses it for them)
//   lines    the name of a live value the page reads for the bubble's fact lines (the page wiring)
//   sampleKey the Mock wording key (the "sample_*" variants: a mock run never reads as a live one)
// Hold times for Play for me are not here: they come from the wording and the shared hold.js (the video's own formulas).

// The video's tour order (take.py SCENES): the scenes it runs, each followed by its evidence bubble.
const SCENES = ['MA1', 'MA2', 'MA3', 'MA4', 'MA5', 'MA6', 'MA7', 'MA8', 'MA9', 'MA10', 'MA11'];

export const STEPS = [
  { key: 'opening', type: 'slide', trigger: 'load' },
  // The video's signin bubble points at the mode select (the traveler signs in as the lab's persona; in Real it is the viewer's own PingOne sign-in).
  { key: 'signin', type: 'bubble', trigger: 'load', target: '[data-testid="mode"]', prefer: 'below', sampleKey: 'sample_signin' },
  // The scenes run from the prompt dropdown exactly as the video does (take.py selects wtt-opt-<uc>): the viewer picks the prompt, or Play picks it,
  // and the run's bubble lands when the run ends.
  ...SCENES.map((uc) => ({
    key: uc.toLowerCase(), type: 'bubble', trigger: 'run-done', target: '[data-testid="turn-reply"]', prefer: 'right',
    sampleKey: `sample_${uc.toLowerCase()}`, prompt: { press: `[data-testid="wtt-opt-${uc}"]` },
  })),
  { key: 'hops', type: 'bubble', trigger: 'load', target: '[data-testid="evidence-count"]', prefer: 'below', lines: 'hops' },
  { key: 'closing', type: 'slide', trigger: 'load' },
];

// Bubbles only Story has (the video has no such scene): the per-scene evidence bubbles, numbered with the rest.
export const STORY_ONLY = SCENES.map((uc) => `${uc.toLowerCase()}_evidence`);
// Wording only the video uses: the per-scene intro slides (title, products used, value), shown by take.py before each scene. The demo's story does not show them.
export const VIDEO_ONLY = SCENES.map((uc) => uc.toLowerCase());

// What the parity test hands to captions.js parity(): the caption keys this script needs.
export function scriptKeys() {
  return {
    steps: STEPS.filter((s) => s.type === 'bubble').map((s) => s.key),
    slides: STEPS.filter((s) => s.type === 'slide').map((s) => s.key),
    sampleKeys: STEPS.map((s) => s.sampleKey).filter(Boolean),
  };
}

