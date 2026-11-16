// Formatting helpers. Every string from the API passes through escapeHtml
// before it is interpolated into markup, so API text can never break the
// page or inject markup of its own.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

const usdFull = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
});

/** $1,000 — a live pot is the prize plus the entry fees already paid in. */
export function usd(value) {
  return usdFull.format(Number(value ?? 0));
}

/** $1.2k — the compact form for dense tables. */
export function usdCompact(value) {
  const n = Number(value ?? 0);
  if (n < 1000) return usdFull.format(n);
  const k = n / 1000;
  return `$${k.toFixed(k % 1 === 0 ? 0 : 1)}k`;
}

const DAY = 86_400_000;
const HOUR = 3_600_000;
const MINUTE = 60_000;

/** "2d 4h left" or "3h ago" — a bounty is open while its deadline is ahead. */
export function countdown(deadline) {
  const end = new Date(deadline).getTime();
  if (Number.isNaN(end)) return '';
  const delta = end - Date.now();
  const span = Math.abs(delta);
  const parts = [
    [Math.floor(span / DAY), 'd'],
    [Math.floor((span % DAY) / HOUR), 'h'],
    [Math.floor((span % HOUR) / MINUTE), 'm'],
  ].filter(([n], i) => n > 0 || i === 2).slice(0, 2);
  const text = parts.map(([n, unit]) => `${n}${unit}`).join(' ');
  return delta >= 0 ? `${text} left` : `${text} ago`;
}

/** True while a bounty still takes entries: a deadline ahead of now, and the API still accepting. */
export function isLive(bounty) {
  if (!bounty || !bounty.deadline) return false;
  if (bounty.acceptingSubmissions === false) return false;
  return new Date(bounty.deadline).getTime() > Date.now();
}

/** True while the deadline falls inside the next 24 hours. */
export function endsSoon(bounty) {
  if (!bounty || !bounty.deadline) return false;
  const delta = new Date(bounty.deadline).getTime() - Date.now();
  return delta > 0 && delta < DAY;
}

export function fmtDate(iso) {
  const when = new Date(iso);
  if (Number.isNaN(when)) return '';
  return when.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** "3h ago" — for timestamps the API already recorded. */
export function timeAgo(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < DAY / 1000) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function pluralize(count, one, many) {
  return count === 1 ? one : many;
}

/** Shorten a Solana address: Apti…xStu. */
export function shortWallet(address) {
  if (!address || address.length <= 12) return address ?? '';
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}
