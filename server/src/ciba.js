// MA6's Real CIBA configuration check. The CIBA app's two settings live in the lab's .env beside
// docker-compose.yml (compose passes them in as MA_CIBA_CLIENT_ID and its paired name);
// the HTTP legs that use them live in real.js, which the entry gate pins as the only module that
// may mention them. This file answers ONE question: is MA6's Real CIBA path configured?
import { liveSettingsFor } from './settings.js';

// The pair of setting names the CIBA app needs (the id and its paired name) — names only, never values.
export const CIBA_PAIR = ['MA_CIBA_CLIENT_ID', 'MA_CIBA_APP_CREDENTIAL'];
export const CIBA_LOGIN_HINT = 'MA_CIBA_LOGIN_HINT';

export const cibaConfigured = (live = null) => {
  const s = live ?? liveSettingsFor();
  const id = s[CIBA_PAIR[0]];
  const paired = Object.keys(s).find((k) => k.startsWith('MA_CIBA_') && k !== CIBA_PAIR[0] && k !== CIBA_LOGIN_HINT && s[k]);
  return Boolean(id && paired);
};
