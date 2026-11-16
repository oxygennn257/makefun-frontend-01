# funboard — a lean make.fun client

A fully working, read-only frontend for make.fun, built from static files
with no build step and no framework. It reads make.fun's public API alone
(`https://make.fun/api`, GET) and shows the four surfaces a visitor needs:

- **Board** (`#/`): every bounty with its live pot, entry fee, time left and
  entries — filterable (open / closing soon / closed), searchable and sortable.
- **Bounty page** (`#/bounty/<slug>`): summary, live rewards table, dates,
  description and rules.
- **Leaderboard** (`#/bounty/<slug>/leaderboard`): ranked entries with
  development/final phases, score columns and search.
- **Profile** (`#/u/<handle>`): an account's record and entries.

Speed is the point: API answers are cached in memory and revalidated with
ETags (the API's tags are bound to the minute), long lists are paginated, and
the time-left labels refresh in place without rebuilding the page. The first
load is a handful of small files and no framework.

## Run it

```sh
node serve.ts            # http://localhost:8080
```

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `app/` and `screenshots/` to the output directory and writes
`dossier.json` with the kit's vendored library.

## Screenshots

`shots.json` names the three screenshots in `screenshots/`, each a real render
of the running app on live make.fun data (board, bounty page, leaderboard).
