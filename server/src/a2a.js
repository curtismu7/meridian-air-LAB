// MA4's Real A2A settings: the partner agent's endpoint (the owner's AWS AgentCore agent through the
// Privilege gateway, served by the privilege-a2a-anthropic-demo-LAB). The HTTP call lives in real.js
// beside the other real legs. Settings (OPTIONAL): MA_A2A_URL (the full endpoint URL).
import { liveSettingsFor } from './settings.js';

export function a2aConfig(live = null) {
  const s = live ?? liveSettingsFor();
  const url = s.MA_A2A_URL || '';
  if (!url) return { ok: false, problem: 'MA_A2A_URL is not set (the partner agent endpoint)' };
  try { const u = new URL(url); if (u.protocol !== 'https:' && !isLocal(u)) return { ok: false, problem: 'MA_A2A_URL must be https' }; } catch { return { ok: false, problem: 'MA_A2A_URL is not a URL' }; }
  return { ok: true, url, problem: null };
}

const isLocal = (u) => /(^|\.)local\.ping-devops\.com$/.test(u.hostname) || ['127.0.0.1', 'localhost', 'host.docker.internal'].includes(u.hostname);

export const a2aConfigured = (live = null) => a2aConfig(live).ok;
