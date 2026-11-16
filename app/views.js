// The four surfaces, each a pure function from API data to HTML.
// No event handlers live here: main.js wires every interaction through
// delegated listeners, so the page carries no inline code at all.

import {
  countdown, endsSoon, escapeHtml as html, fmtDate, isLive, pluralize,
  shortWallet, timeAgo, usd, usdCompact,
} from './format.js';

const BOARD_PAGE = 12;
const BOARD_ROWS = 25;

/** Open / closing-soon / closed, judged by the deadline, never the status. */
export function statusTag(bounty) {
  if (!isLive(bounty)) return '<span class="chip closed">Closed</span>';
  if (endsSoon(bounty)) return '<span class="chip soon">Closing soon</span>';
  return '<span class="chip open">Open</span>';
}

function feeLabel(bounty) {
  return bounty.entryFeeUsd ? `${usd(bounty.entryFeeUsd)} fee` : 'Free to enter';
}

function bountyTile(bounty) {
  const entries = Number(bounty.submissionCount ?? 0);
  return `
  <li class="card">
    <h3><a href="#/bounty/${encodeURIComponent(bounty.slug)}">${html(bounty.title)}</a></h3>
    <p class="summary">${html(bounty.summary ?? '')}</p>
    <div class="meta">
      ${statusTag(bounty)}
      <span class="chip cat">${html(bounty.category ?? 'Bounty')}</span>
    </div>
    <div class="pot">${usd(bounty.potUsd ?? bounty.rewardAmount)} <small>live pot</small></div>
    <div class="foot">
      <span><b data-deadline="${html(bounty.deadline)}">${html(countdown(bounty.deadline))}</b></span>
      <span>${feeLabel(bounty)}</span>
      <span><b>${entries.toLocaleString('en-US')}</b> ${pluralize(entries, 'entry', 'entries')}</span>
    </div>
  </li>`;
}

function applyBoardFilter(all, ui) {
  const needle = ui.q.trim().toLowerCase();
  return all.filter((bounty) => {
    if (ui.tab === 'open' && !isLive(bounty)) return false;
    if (ui.tab === 'closing' && !endsSoon(bounty)) return false;
    if (ui.tab === 'closed' && isLive(bounty)) return false;
    if (!needle) return true;
    const haystack = `${bounty.title} ${bounty.slug} ${bounty.category ?? ''}`.toLowerCase();
    return haystack.includes(needle);
  });
}

function applyBoardSort(items, sortKey) {
  const byDeadline = (a, b) => {
    // Open bounties first by deadline, closed ones last: a plain ascending
    // sort would lead with closed bounties, whose deadlines are the earliest
    // because they are already in the past.
    const ka = isLive(a) ? new Date(a.deadline || 0).getTime() : Infinity;
    const kb = isLive(b) ? new Date(b.deadline || 0).getTime() : Infinity;
    return ka - kb;
  };
  const sorters = {
    closing: byDeadline,
    pot: (a, b) => Number(b.potUsd ?? b.rewardAmount) - Number(a.potUsd ?? a.rewardAmount),
    entries: (a, b) => Number(b.submissionCount ?? 0) - Number(a.submissionCount ?? 0),
    newest: (a, b) => new Date(b.publishedAt ?? 0) - new Date(a.publishedAt ?? 0),
  };
  return [...items].sort(sorters[sortKey] || byDeadline);
}

export function boardPage(all, ui) {
  const items = applyBoardSort(applyBoardFilter(all, ui), ui.sort);
  const open = all.filter(isLive);
  const potTotal = open.reduce((sum, b) => sum + Number(b.potUsd ?? b.rewardAmount ?? 0), 0);
  const entryTotal = all.reduce((sum, b) => sum + Number(b.submissionCount ?? 0), 0);
  const closingCount = all.filter(endsSoon).length;
  const pageCount = Math.max(1, Math.ceil(items.length / BOARD_PAGE));
  const page = Math.min(ui.page, pageCount);
  const slice = items.slice((page - 1) * BOARD_PAGE, page * BOARD_PAGE);
  const tabButton = (key, label) =>
    `<button type="button" data-tab="${key}" aria-pressed="${ui.tab === key}">${label}</button>`;
  const sortOption = (value, label) =>
    `<option value="${value}"${ui.sort === value ? ' selected' : ''}>${label}</option>`;

  return `
  <h1>Live bounties</h1>
  <p class="lede">Every open competition on make.fun — its live pot, entry fee, time left and entries. Data is read-only from the public API.</p>
  <ul class="stats" aria-label="Board totals">
    <li><b>${open.length}</b><span>open now</span></li>
    <li><b>${usd(potTotal)}</b><span>live pots, open bounties</span></li>
    <li><b>${entryTotal.toLocaleString('en-US')}</b><span>entries in all</span></li>
    <li><b>${closingCount}</b><span>closing within 24h</span></li>
  </ul>
  <div class="toolbar">
    <div class="tabs" role="group" aria-label="Filter bounties">
      ${tabButton('all', 'All')} ${tabButton('open', 'Open')} ${tabButton('closing', 'Closing soon')} ${tabButton('closed', 'Closed')}
    </div>
    <input type="search" id="board-q" placeholder="Search bounties…" value="${html(ui.q)}" aria-label="Search bounties">
    <span class="spacer"></span>
    <label class="muted small" for="board-sort">Sort</label>
    <select id="board-sort" aria-label="Sort bounties">
      ${sortOption('closing', 'Closing soonest')}${sortOption('pot', 'Biggest pot')}${sortOption('entries', 'Most entries')}${sortOption('newest', 'Newest')}
    </select>
  </div>
  <p class="muted small" role="status">${items.length} ${pluralize(items.length, 'bounty', 'bounties')}${ui.q.trim() ? ` matching “${html(ui.q)}”` : ''}</p>
  ${slice.length ? `<ul class="cards">${slice.map(bountyTile).join('')}</ul>` : '<div class="empty">No bounties match. Try another search or filter.</div>'}
  ${pageCount > 1 ? pageNav(page, pageCount, 'board') : ''}`;
}

function medalFor(place) {
  return place === 1 ? '🥇 ' : place === 2 ? '🥈 ' : place === 3 ? '🥉 ' : '';
}

export function bountyPage(bounty) {
  const rewards = Array.isArray(bounty.rewardsNow) ? bounty.rewardsNow : [];
  const rewardRows = rewards.map((reward) => {
    const feeShare = Number(reward.feeShareUsd ?? 0);
    const feeNote = feeShare > 0 ? ` <span class="muted">incl. ${usd(feeShare)} fees</span>` : '';
    return `<tr><td>${medalFor(reward.place)}${reward.place}</td><td class="num">${usd(reward.amountUsd)}</td><td class="muted small">${feeNote}</td></tr>`;
  }).join('');
  const sponsor = bounty.sponsor?.name ? html(bounty.sponsor.name) : 'make.fun';
  const skills = (bounty.skills ?? []).slice(0, 5)
    .map((skill) => `<span class="chip cat">${html(skill)}</span>`).join(' ');

  return `
  <p class="crumb"><a href="#/">← All bounties</a></p>
  <h1>${html(bounty.title)}</h1>
  <p class="lede">${html(bounty.summary ?? '')}</p>
  <div class="meta">${statusTag(bounty)} <span class="chip cat">${html(bounty.category ?? 'Bounty')}</span>
    ${skills}
  </div>
  <ul class="facts" aria-label="Bounty facts">
    <li><b>${usd(bounty.potUsd ?? bounty.rewardAmount)}</b><span>live pot</span></li>
    <li><b>${bounty.entryFeeUsd ? usd(bounty.entryFeeUsd) : 'Free'}</b><span>entry fee</span></li>
    <li><b data-deadline="${html(bounty.deadline)}">${html(countdown(bounty.deadline))}</b><span>deadline · ${html(fmtDate(bounty.deadline))}</span></li>
    <li><b>${Number(bounty.submissionCount ?? 0).toLocaleString('en-US')}</b><span>entries</span></li>
    <li><b>${html(fmtDate(bounty.opensAt))}</b><span>opened</span></li>
    <li><b>${sponsor}</b><span>sponsor</span></li>
  </ul>
  <div class="actions">
    <a class="btn" href="#/bounty/${encodeURIComponent(bounty.slug)}/leaderboard">Leaderboard →</a>
    <a class="btn ghost" href="https://make.fun/bounty/${encodeURIComponent(bounty.slug)}" target="_blank" rel="noopener">View on make.fun ↗</a>
  </div>
  ${rewardRows ? `
  <h2>Rewards</h2>
  <table>
    <thead><tr><th>Place</th><th class="num">Prize</th><th></th></tr></thead>
    <tbody>${rewardRows}</tbody>
  </table>` : ''}
  <h2>Description</h2>
  <div class="description">${html(bounty.description ?? '')}</div>
  ${bounty.rules ? `<details><summary><strong>Rules</strong> — the full text</summary><div class="description">${html(bounty.rules)}</div></details>` : ''}`;
}

function scoreFor(columnKey, row) {
  const value = row.values?.[columnKey];
  if (value === null || value === undefined) return '—';
  if (columnKey === 'judge') return `${(Number(value) / 10000).toFixed(2)}%`;
  if (columnKey === 'loss') return Number(value).toLocaleString('en-US', { maximumFractionDigits: 3 });
  return String(value);
}

export function leaderboardPage(board, slug, ui) {
  const comp = board.competition ?? {};
  const rows = Array.isArray(board.entries) ? board.entries : [];
  const columns = Array.isArray(board.columns) ? board.columns : [];
  const activeKey = ui.view && columns.some((col) => col.key === ui.view)
    ? ui.view
    : (board.rank_key ?? columns[0]?.key ?? 'judge');
  const activeColumn = columns.find((col) => col.key === activeKey) ?? { title: 'Score' };
  const needle = ui.q.trim().toLowerCase();
  const matching = needle
    ? rows.filter((row) => `${row.handle ?? ''} ${row.title ?? ''}`.toLowerCase().includes(needle))
    : rows;
  const pageCount = Math.max(1, Math.ceil(matching.length / BOARD_ROWS));
  const page = Math.min(ui.page, pageCount);
  const slice = matching.slice((page - 1) * BOARD_ROWS, page * BOARD_ROWS);
  const body = slice.map((row) => `
    <tr>
      <td><span class="rank-badge">${row.rank ?? '—'}</span></td>
      <td><a href="#/u/${encodeURIComponent(row.handle ?? '')}">${html(row.handle ?? '—')}</a><br><span class="muted small">${html(row.title ?? '')}</span></td>
      <td class="num"><b>${html(scoreFor(activeKey, row))}</b></td>
      <td class="num muted">${row.prize_rank ? `#${row.prize_rank}` : '—'}</td>
    </tr>`).join('');
  const phaseButton = (phase, label) =>
    `<button type="button" data-phase="${phase}" aria-pressed="${ui.phase === phase}">${label}</button>`;
  const columnOptions = columns
    .map((col) => `<option value="${html(col.key)}"${col.key === activeKey ? ' selected' : ''}>${html(col.title)}</option>`)
    .join('');

  return `
  <p class="crumb"><a href="#/bounty/${encodeURIComponent(slug)}">← ${html(comp.title ?? slug)}</a></p>
  <h1>Leaderboard</h1>
  <p class="lede">${html(comp.title ?? slug)} — ${rows.length.toLocaleString('en-US')} ranked entries, ${html(board.phase?.title ?? ui.phase)} phase. Scores update as the heat runs.</p>
  <div class="toolbar">
    <div class="tabs" role="group" aria-label="Phase">
      ${phaseButton('dev', 'Development')} ${phaseButton('final', 'Final')}
    </div>
    <input type="search" id="lb-q" placeholder="Search handle or entry…" value="${html(ui.q)}" aria-label="Search leaderboard">
    <span class="spacer"></span>
    <label class="muted small" for="lb-view">Score</label>
    <select id="lb-view" aria-label="Score column">${columnOptions}</select>
  </div>
  ${slice.length ? `
  <table>
    <thead><tr><th>Rank</th><th>Entrant</th><th class="num">${html(activeColumn.title)}</th><th class="num">Prize rank</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  ${pageCount > 1 ? pageNav(page, pageCount, 'lb') : ''}` : '<div class="empty">No entries here yet for this phase.</div>'}`;
}

export function profilePage(profile) {
  const record = profile.record ?? {};
  const photo = profile.image || profile.avatar || null;
  const avatar = photo
    ? `<img class="avatar" crossorigin="anonymous" src="${html(photo)}" alt="Avatar of ${html(profile.handle)}">`
    : `<span class="avatar avatar-fallback" aria-hidden="true">${html((profile.handle ?? '?')[0].toUpperCase())}</span>`;
  const links = [
    profile.github_login ? `<a href="https://github.com/${encodeURIComponent(profile.github_login)}">GitHub: ${html(profile.github_login)}</a>` : '',
    profile.x ? `<a href="https://x.com/${encodeURIComponent(profile.x)}">X: ${html(profile.x)}</a>` : '',
    profile.discord ? `<span>Discord: ${html(profile.discord)}</span>` : '',
  ].filter(Boolean).join('');
  const entries = Array.isArray(profile.solutions) ? profile.solutions : [];
  const rows = entries.map((entry) => {
    const comp = entry.competition ?? {};
    const place = entry.placement ? `#${entry.placement}` : '—';
    const prize = entry.prize_usd ? ` · ${usd(entry.prize_usd)}` : '';
    return `<tr>
        <td><a href="#/bounty/${encodeURIComponent(comp.slug ?? '')}">${html(comp.title ?? comp.slug ?? '')}</a></td>
        <td>${html(entry.title ?? '')}</td>
        <td class="num"><b>${html(entry.score?.display ?? '—')}</b></td>
        <td class="num">${place}${prize}</td>
        <td class="muted small">${html(timeAgo(entry.entered_at))}</td>
      </tr>`;
  }).join('');
  const walletLine = profile.wallet?.address
    ? `<p class="muted small" style="margin:4px 0 0">Wallet <a href="${html(profile.wallet.explorer_url ?? '')}">${html(shortWallet(profile.wallet.address))}</a> · joined ${html(fmtDate(profile.joined_at))}</p>`
    : `<p class="muted small" style="margin:4px 0 0">Joined ${html(fmtDate(profile.joined_at))}</p>`;

  return `
  <div class="profile-head">
    ${avatar}
    <div>
      <h1>@${html(profile.handle)}</h1>
      ${profile.display_name ? `<p class="muted" style="margin:0">${html(profile.display_name)}</p>` : ''}
      ${profile.bio ? `<p style="margin:6px 0 0; max-width: 60ch">${html(profile.bio)}</p>` : ''}
      <p class="links">${links}</p>
      ${walletLine}
    </div>
  </div>
  <ul class="stats" aria-label="Account record">
    <li><b>${Number(record.competitions_entered ?? 0)}</b><span>competitions entered</span></li>
    <li><b>${Number(record.competitions_placed ?? 0)}</b><span>placed</span></li>
    <li><b>${Number(record.competitions_won ?? 0)}</b><span>won</span></li>
    <li><b>${record.best_placement ? `#${record.best_placement}` : '—'}</b><span>best placement</span></li>
  </ul>
  <p class="lede">Total prizes won: <b>${usd(record.prize_usd ?? 0)}</b> across ${entries.length} ${pluralize(entries.length, 'entry', 'entries')} shown.</p>
  ${rows ? `
  <h2>Entries</h2>
  <table>
    <thead><tr><th>Competition</th><th>Entry</th><th class="num">Score</th><th class="num">Place</th><th>Entered</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>` : '<div class="empty">No entries yet.</div>'}`;
}

/** Shared pager: buttons carry data-page, main.js listens once on #view. */
export function pageNav(page, pages, kind) {
  return `
  <div class="pager">
    <button type="button" data-pager="${kind}" data-page="${page - 1}"${page <= 1 ? ' disabled' : ''}>← Prev</button>
    <span class="muted small">Page ${page} of ${pages}</span>
    <button type="button" data-pager="${kind}" data-page="${page + 1}"${page >= pages ? ' disabled' : ''}>Next →</button>
  </div>`;
}
