export function getSessionId(): string {
  if (typeof window === 'undefined') {
    return 'server-' + Math.random().toString(36);
  }

  let sessionId = sessionStorage.getItem('openmaic_session');

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('openmaic_session', sessionId);
  }

  return sessionId;
}
