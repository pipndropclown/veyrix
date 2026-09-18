const KEY = "veyrix.paper-controller.v1";
export interface PaperController { id: string; owns(): boolean; release(): void; }
/** Lightweight per-profile lease prevents tabs in the same browser profile from trading the same account. */
export function claimPaperController(storage: Storage, now = Date.now(), id = `${now}-${Math.random().toString(36).slice(2)}`): PaperController {
  const owns = () => { try { const raw = storage.getItem(KEY); return Boolean(raw && JSON.parse(raw).id === id); } catch { return false; } };
  const lease = () => { try { const raw = storage.getItem(KEY), current = raw ? JSON.parse(raw) as { id?: string; expires?: number } : null; if (current && typeof current.expires === "number" && current.expires > Date.now() && current.id !== id) return; storage.setItem(KEY, JSON.stringify({ id, expires: Date.now() + 8000 })); } catch { return; } };
  lease();
  const timer = setInterval(lease, 2000);
  return { id, owns, release() { clearInterval(timer); if (owns()) storage.removeItem(KEY); } };
}
