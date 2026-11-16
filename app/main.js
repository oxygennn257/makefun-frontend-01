// funboard router: hash routes, one render per navigation, no rebuilds on
// timer ticks — only the time-left text nodes are refreshed in place.
//
//   #/                              the board
//   #/closing                       the board, closing-soon tab
//   #/bounty/<slug>                 one bounty
//   #/bounty/<slug>/leaderboard     its leaderboard
//   #/u/<handle>                    an account's public profile
//
// window.__shotReady is false while a route loads and true once its data has
// rendered, so a screenshot script knows when to capture.

import { api } from './api.js';
import { countdown } from './format.js';
import { boardPage, bountyPage, leaderboardPage, profilePage } from './views.js';

const mount = document.getElementById('view');
const lookupForm = document.getElementById('profile-lookup');
const lookupInput = document.getElementById('profile-handle');

// One state object per surface, so a re-render never loses the filter,
// the search text or the page the visitor was on.
const ui = {
  board: { tab: 'all', q: '', sort: 'closing', page: 1 },
  leaderboard: { phase: 'dev', view: '', q: '', page: 1 },
};

function showLoading(message = 'Loading…') {
  mount.innerHTML = `<p class="loading" role="status">${message}</p>`;
}

function showFailure(error, retry) {
  const missing = error && error.status === 404;
  mount.innerHTML = `<div class="error" role="alert"><p><strong>${missing ? 'Not found.' : 'Could not load this page.'}</strong></p>
    <p class="muted">${missing ? 'The address may be wrong, or the account may not exist.' : 'Check your connection and try again.'}</p>
    <p><button type="button" class="btn" data-action="retry">Try again</button> <a class="btn ghost" href="#/">Back to the board</a></p></div>`;
  mount.querySelector('[data-action="retry"]').addEventListener('click', retry);
}

function markNav(route) {
  document.querySelectorAll('[data-nav]').forEach((link) => {
    link.classList.toggle('active', link.dataset.nav === route);
  });
}

function refreshCountdowns() {
  // Only the time-left text changes, never the page around it.
  document.querySelectorAll('[data-deadline]').forEach((node) => {
    node.textContent = countdown(node.dataset.deadline);
  });
}

async function showBoard() {
  window.__shotReady = false;
  showLoading();
  markNav(ui.board.tab === 'closing' ? 'closing' : 'board');
  try {
    const data = await api.listCompetitions();
    const all = Array.isArray(data.items) ? data.items : [];
    mount.innerHTML = boardPage(all, ui.board);
  } catch (error) {
    showFailure(error, showBoard);
  }
  window.scrollTo(0, 0);
  window.__shotReady = true;
}

async function showBounty(slug) {
  window.__shotReady = false;
  showLoading();
  markNav('board');
  try {
    const bounty = await api.fetchCompetition(slug);
    if (!bounty || !bounty.slug) {
      const missing = new Error('missing');
      missing.status = 404;
      throw missing;
    }
    document.title = `${bounty.title} | funboard`;
    mount.innerHTML = bountyPage(bounty);
  } catch (error) {
    document.title = 'Not found | funboard';
    showFailure(error, () => showBounty(slug));
  }
  window.scrollTo(0, 0);
  window.__shotReady = true;
}

async function showLeaderboard(slug) {
  window.__shotReady = false;
  showLoading();
  markNav('board');
  try {
    const board = await api.fetchLeaderboard(slug, ui.leaderboard.phase, ui.leaderboard.view || undefined);
    document.title = `Leaderboard · ${(board.competition && board.competition.title) || slug} | funboard`;
    mount.innerHTML = leaderboardPage(board, slug, ui.leaderboard);
  } catch (error) {
    document.title = 'Not found | funboard';
    showFailure(error, () => showLeaderboard(slug));
  }
  window.scrollTo(0, 0);
  window.__shotReady = true;
}

async function showProfile(handle) {
  window.__shotReady = false;
  showLoading();
  markNav('');
  try {
    const profile = await api.fetchProfile(handle);
    if (!profile || !profile.handle) {
      const missing = new Error('missing');
      missing.status = 404;
      throw missing;
    }
    document.title = `@${profile.handle} | funboard`;
    mount.innerHTML = profilePage(profile);
  } catch (error) {
    document.title = 'Not found | funboard';
    showFailure(error, () => showProfile(handle));
  }
  window.scrollTo(0, 0);
  window.__shotReady = true;
}

// The route table: each entry matches the hash segments and calls its
// controller. The first matching route wins.
const routes = [
  {
    match: (parts) => parts[0] === 'bounty' && parts[1] && parts[2] === 'leaderboard',
    run: (parts) => showLeaderboard(parts[1]),
  },
  {
    match: (parts) => parts[0] === 'bounty' && parts[1],
    run: (parts) => showBounty(parts[1]),
  },
  {
    match: (parts) => parts[0] === 'u' && parts[1],
    run: (parts) => showProfile(parts[1]),
  },
  {
    match: () => true,
    run: (parts) => {
      ui.board.tab = parts[0] === 'closing' ? 'closing' : 'all';
      document.title = 'funboard — make.fun, leaner';
      showBoard();
    },
  },
];

function navigate() {
  const segments = (location.hash || '#/')
    .replace(/^#\//, '')
    .split('/')
    .map(decodeURIComponent);
  for (const route of routes) {
    if (route.match(segments)) {
      route.run(segments);
      return;
    }
  }
}

// One delegated listener handles every click inside the view: tabs, phases,
// pager buttons and the retry button. The view is re-rendered after each
// action, so the bindings never need re-attaching.
mount.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-tab]');
  if (tab) {
    ui.board.tab = tab.dataset.tab;
    ui.board.page = 1;
    showBoard();
    return;
  }
  const phase = event.target.closest('[data-phase]');
  if (phase) {
    ui.leaderboard.phase = phase.dataset.phase;
    ui.leaderboard.page = 1;
    navigate();
    return;
  }
  const pager = event.target.closest('[data-pager]');
  if (pager && !pager.disabled) {
    const page = Number(pager.dataset.page);
    if (pager.dataset.pager === 'board') {
      ui.board.page = page;
      showBoard();
    } else {
      ui.leaderboard.page = page;
      navigate();
    }
  }
});

// Typing in a search box re-renders its list and keeps the caret where it
// was, so the box never loses focus mid-word.
function keepCaret(input, rerender) {
  const caret = input.selectionStart;
  rerender().then(() => {
    const next = document.getElementById(input.id);
    if (next) {
      next.focus();
      next.setSelectionRange(caret, caret);
    }
  });
}

mount.addEventListener('input', (event) => {
  const field = event.target;
  if (field.id === 'board-q') {
    ui.board.q = field.value;
    ui.board.page = 1;
    keepCaret(field, async () => showBoard());
  } else if (field.id === 'lb-q') {
    ui.leaderboard.q = field.value;
    ui.leaderboard.page = 1;
    keepCaret(field, async () => navigate());
  }
});

mount.addEventListener('change', (event) => {
  const field = event.target;
  if (field.id === 'board-sort') {
    ui.board.sort = field.value;
    ui.board.page = 1;
    showBoard();
  } else if (field.id === 'lb-view') {
    ui.leaderboard.view = field.value;
    ui.leaderboard.page = 1;
    navigate();
  }
});

lookupForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const handle = lookupInput.value.trim().replace(/^@/, '');
  if (handle) location.hash = `#/u/${encodeURIComponent(handle)}`;
});

document.addEventListener('keydown', (event) => {
  if (event.key === '/' && document.activeElement !== lookupInput) {
    const field = mount.querySelector('#board-q, #lb-q');
    if (field) {
      event.preventDefault();
      field.focus();
    }
  }
});

window.addEventListener('hashchange', navigate);
setInterval(refreshCountdowns, 30_000);
navigate();
