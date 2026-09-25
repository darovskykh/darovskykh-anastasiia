// After a deploy, Vite renames hashed chunks and deletes the old files. A tab
// left open from before the deploy still references the old names, so a lazy
// import() 404s with "Failed to fetch dynamically imported module". Reloading
// once pulls the fresh index.html (served no-store) and the new chunk names.
// A short time-window guard prevents a reload loop while still letting a later
// deploy heal the same tab again.

const RELOAD_AT_KEY = 'stale-chunk-reload-at';
const RELOAD_SUPPRESS_MS = 10_000;

const STALE_PATTERNS = [
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'Importing a module script failed',
];

export function isStaleChunkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return STALE_PATTERNS.some((p) => msg.includes(p));
}

// Reloads the page once. Returns true if a reload was triggered, false if one
// happened moments ago (so callers can fall back to showing an error).
export function reloadForStaleChunk(): boolean {
  const last = Number(sessionStorage.getItem(RELOAD_AT_KEY) || 0);
  if (Date.now() - last < RELOAD_SUPPRESS_MS) return false;
  sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()));
  window.location.reload();
  return true;
}

export function installStaleChunkReload(): void {
  // Vite dispatches this when a modulepreload for a lazy chunk fails.
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reloadForStaleChunk();
  });
}
