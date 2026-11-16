// Read-only client for the make.fun public API (GET, CORS open).
//
// Answers are cached in memory and revalidated with the API's ETags, which
// are bound to the minute: revisiting a view inside a minute costs no
// request, and a later visit costs a 304. A stale answer is served when the
// network fails, so a hiccup never blanks a page that already loaded.

const API_ROOT = 'https://make.fun/api';
const FRESH_MS = 60_000;

function makeClient(root) {
  const store = new Map(); // path -> { tag, body, fetchedAt }
  const pending = new Map(); // path -> Promise

  async function request(path) {
    const seen = store.get(path);
    if (seen && Date.now() - seen.fetchedAt < FRESH_MS) return seen.body;
    const waiting = pending.get(path);
    if (waiting) return waiting;

    const job = (async () => {
      const headers = {};
      if (seen && seen.tag) headers['If-None-Match'] = seen.tag;
      const res = await fetch(root + path, { headers });
      if (res.status === 304 && seen) {
        seen.fetchedAt = Date.now();
        return seen.body;
      }
      if (!res.ok) {
        const failure = new Error(`make.fun API ${res.status} for ${path}`);
        failure.status = res.status;
        if (seen) return seen.body;
        throw failure;
      }
      const body = await res.json();
      store.set(path, { tag: res.headers.get('ETag'), body, fetchedAt: Date.now() });
      return body;
    })();

    pending.set(path, job);
    try {
      return await job;
    } finally {
      pending.delete(path);
    }
  }

  return {
    request,
    /** All competitions, with their timing activity attached. */
    listCompetitions: () => request('/competitions?activity=times'),
    /** One competition, by slug. */
    fetchCompetition: (slug) => request(`/competitions/${encodeURIComponent(slug)}`),
    /** A competition's leaderboard. phase 'dev' | 'final', view 'performance' | 'overall'. */
    fetchLeaderboard: (slug, phase = 'dev', view) => {
      const suffix = view ? `&view=${view}` : '';
      return request(`/competitions/${encodeURIComponent(slug)}/leaderboard?phase=${phase}${suffix}`);
    },
    /** An account's public profile, by handle. */
    fetchProfile: (handle) => request(`/profiles/${encodeURIComponent(handle)}`),
  };
}

export const api = makeClient(API_ROOT);
