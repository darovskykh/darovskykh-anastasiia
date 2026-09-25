// Auto-pick-up a new deploy in a tab left open. index.html is served no-cache
// (docker/nginx.conf) and Vite content-hashes the assets, so a *full* page load
// always gets the latest build — but an SPA that only navigates client-side
// never re-fetches index.html, so the tab keeps running yesterday's JS until a
// manual refresh. We poll the deployed index.html, compare its hashed entry
// script to the one this tab booted with, and reload when they differ.
//
// Reload only happens at a safe moment (tab refocus) and never while a live
// simulation is on screen, where a reload would drop the WebSocket session.

const RELOAD_AT_KEY = 'app-version-reload-at';
const RELOAD_SUPPRESS_MS = 30_000;
const POLL_MS = 3 * 60_000;
const ENTRY_RE = /\/assets\/index-[A-Za-z0-9_-]+\.js/;

function entryFromDom(): string | null {
  const scripts = Array.from(
    document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')
  );
  for (const s of scripts) {
    const match = (s.getAttribute('src') || '').match(ENTRY_RE);
    if (match) return match[0];
  }
  return null;
}

async function entryFromServer(): Promise<string | null> {
  // Best-effort: a failed version poll (offline, 502 mid-deploy) must never
  // surface to the user — it just means "don't reload this round".
  let res: Response;
  try {
    res = await fetch('/index.html', { cache: 'no-store' });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const match = (await res.text()).match(ENTRY_RE);
  return match ? match[0] : null;
}

// The active simulation runs over a WebSocket; reloading there drops the live
// session. That route is /simulation/:chatId — the /results sub-path is safe.
function onActiveSimulation(): boolean {
  return /^\/simulation\/[^/]+$/.test(window.location.pathname);
}

function reloadOnce(): void {
  const last = Number(sessionStorage.getItem(RELOAD_AT_KEY) || 0);
  if (Date.now() - last < RELOAD_SUPPRESS_MS) return;
  sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()));
  window.location.reload();
}

export function installAutoUpdateReload(): void {
  const booted = entryFromDom();
  if (!booted) return; // dev server / no hashed entry — nothing to compare

  let updateReady = false;

  const detect = async (): Promise<void> => {
    const latest = await entryFromServer();
    if (latest && latest !== booted) updateReady = true;
  };

  const reloadIfSafe = (): void => {
    if (updateReady && !onActiveSimulation()) reloadOnce();
  };

  window.setInterval(() => void detect(), POLL_MS);

  // Tab refocus is the safe swap moment: the user just came back and isn't
  // mid-interaction. Re-check first so a deploy that landed while the tab was
  // hidden is caught right away.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void detect().then(reloadIfSafe);
  });
}
