// Story mode's wording route: reads video/captions.md (the ONE file the recorded video and the live Story both read), parses it with the vendored
// parseCaptions (server/src/story/, pinned by web/src/story/story.sha256), re-reads it whenever the file changes, and answers GET /api/captions.
// (The lab's existing GET /api/story serves the vertical cast story to the UI, so the wording route takes a different name.) Nothing here makes a
// network call. A wording problem answers 500 with a message that names it; a missing file answers 500 and never a server path.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseCaptions } from './story/captions.js';

/** video/captions.md, two levels up from server/src/. */
export const CAPTIONS_PATH = fileURLToPath(new URL('../../video/captions.md', import.meta.url));

let cached = null; // { sha, parsed }

/** The wording AND the SHA-256 of the exact bytes it was parsed from: one read, so the two never describe different contents. The parse is cached by
 * hash, so an edit shows on the next request (whatever the file's timestamp says) and an unchanged file is not re-parsed. A broken file throws CaptionsError. */
export function loadCaptionsWithHash(path = CAPTIONS_PATH) {
  const bytes = readFileSync(path);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (path === CAPTIONS_PATH && cached && cached.sha === sha256) return { captions: cached.parsed, sha256 };
  const parsed = parseCaptions(bytes.toString('utf8'));
  if (path === CAPTIONS_PATH) cached = { sha: sha256, parsed };
  return { captions: parsed, sha256 };
}

export const loadCaptions = (path = CAPTIONS_PATH) => loadCaptionsWithHash(path).captions;
export const resetCaptionsCache = () => { cached = null; };

/** GET /api/captions: the wording only, plus the hash of the file it came from so a client can tell it is reading the file it thinks it is. */
export function captionsResponse(path = CAPTIONS_PATH) {
  try {
    const { captions, sha256 } = loadCaptionsWithHash(path);
    return { status: 200, body: { ...captions, sourceSha256: sha256 } };
  } catch (e) {
    if (e instanceof Error && e.name === 'CaptionsError') return { status: 500, body: { error: `Story wording could not be read: ${e.message}` } };
    return { status: 500, body: { error: 'Story wording could not be read: the wording file is missing or unreadable.' } };
  }
}
