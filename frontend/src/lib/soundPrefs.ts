// Alert sound mute preference — persisted so it survives refresh/reopen.
// Same localStorage pattern as token storage in api.ts.

const MUTE_KEY = 'section8_alert_muted';

export const getMuted = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(MUTE_KEY) === 'true';
};

export const setMuted = (muted: boolean): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MUTE_KEY, String(muted));
};
