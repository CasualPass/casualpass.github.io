# Repository Guidelines

## Project Structure & Module Organization

CasualPass is a static HTML/CSS/JavaScript game collection hosted on GitHub Pages. Root `index.html`, `style.css`, and `script.js` implement the dashboard. Each game lives in its own directory, such as `maze-paint/` or `owl-game/`, with page, style, and gameplay files. Shared `casual-*.js` modules manage profiles, saves, authentication, and updates; `shared-settings.js` handles settings and haptics.

Assets live beside their consumers or at the root; vendored libraries and licenses reside in `fps-game/vendor/`. Tests and service-worker tooling live in `tools/`; database policies in `supabase/`; Android and iOS shells in `native/`. See `native/README.md` for platform builds.

## Build, Test, and Development Commands

Run commands from the repository root:

- `python3 -m http.server 4173 --bind 127.0.0.1`: serve locally at `http://127.0.0.1:4173/`; no web dependency installation or bundler is required.
- `node --test tools/*.cjs`: run the complete Node.js test suite.
- `node --test tools/test-maze-ui.cjs`: run focused animation/controller tests.
- `node --check owl-game/script.js`: check JavaScript syntax.
- `python3 tools/build-sw.py`: regenerate `sw.js` and `version.json` before publishing web changes.
- `git diff --check`: detect whitespace errors.

## Coding Style & Naming Conventions

Follow each file’s existing formatting; use four-space indentation in expanded JavaScript blocks. Prefer `const`/`let`, camelCase functions and variables, and lowercase hyphenated directories. Preserve existing browser globals and script-loading order. No repository-wide formatter or linter is configured; avoid unrelated formatting changes. Keep user-facing text consistent with the Turkish interface.

## Testing Guidelines

Tests use `node:test` and `node:assert/strict`; name files `tools/test-<feature>.cjs`. No numeric coverage threshold is configured. Add behavior-focused regression tests for meaningful changes, including save compatibility and animation timing where relevant. Start with focused tests, then broaden for shared-module changes. Check touch/keyboard interaction and responsive layouts; native haptics require physical-device verification. Report unrun checks explicitly.

## Commit & Pull Request Guidelines

Recent commits use imperative descriptions such as “Add origin-scoped native haptic bridges”; no mandatory prefix convention exists. Keep commits scoped. PRs should explain the problem, resulting behavior, validation, and remaining limitations; include screenshots for visual changes and issue links when applicable. GitHub Pages publishes `main`, not feature branches.

## Security & Agent Guidance

Never commit credentials or Supabase service-role keys. Preserve RLS, cookie-save compatibility, and separation of auth tokens from exported saves. Native API changes require rebuilding shells; web-only changes use web updates. Read `README.md` before editing. Historical notes are preserved in [docs/work-history.md](docs/work-history.md); unfinished entries are context, not an active task queue.


## 2026-10-21 — Dino integration

- [x] Added `dino-game/` from the older CasualPass checkout to this current 12-game project; dashboard now has 13 games. Existing games and local documentation changes are preserved.
- Dino uses the shared theme, `getHighScore('Dino')` and `recordGameResult('Dino', ...)`; `casual-cheats.js` preserves the shared persistence guard. No extra dependencies or reward rules.
- Keyboard (Space/Up, P), touch, collision, increasing speed, restart, and automatic pause on focus loss are supported. Dashboard tags include `hizli beceri`.
- Regenerate service-worker assets with `python3 tools/build-sw.py` after web edits.
- Validation: `node --check dino-game/script.js` and `git diff --check` passed. Chrome/Playwright on port 4190 passed: 13 dashboard cards, Dino navigation/start/jump input, pause/resume, collision, one result per run, persistent best after reload, restart, blur pause, four themes and mobile fit; no page errors. Desktop/mobile screenshots inspected. Physical-device touch and offline installation were not tested. `python3 tools/build-sw.py` regenerated `sw.js` and `version.json` (118 URLs, including Dino assets).


## 2026-10-21 — Dino CasualMoney rewards

- Added `CasualProfile.dinoRewardForScore` / `awardDinoRun`: 100 points = 1 CM, base cap 40 per run, then existing rebirth multiplier. Finite nonnegative scores only; guest/cheat sessions earn nothing.
- Dino loads the profile module and shows balance, a session button and reward rules. Collision pays once; a run that used cheats cannot persist results even after cheats are disabled.
- Existing 12 games and their reward rules are preserved. Validation: `node --test tools/*.cjs` passed 81/81 tests, including 3 new Dino reward regressions. Chrome end-to-end: a 136-point collision paid exactly 1 CM once, wallet persisted after reload and matched dashboard, 13 cards and mobile fit verified; no page errors. `node --check` passed for profile and Dino scripts; `git diff --check` passed. Physical-device tests were not run. Service-worker assets regenerated.


## 2026-10-21 — Player time and leaderboard

- Scope: dashboard table for player name, total points, active site seconds, played and wins; sort by points/time/played. `casual-activity.js` is loaded alongside the existing shared settings on all pages. Idle cutoff 60 seconds; hidden/unfocused/cheat time excluded. `cp_activity_v1` is cookie/save-compatible; historical time is not inferred.
- `casual-leaderboard.js` renders a separate local row, explicit publish and error states. Total points sum saved `totalScore`; game scales differ. No fake users or automatic publishing.
- `casual-cloud.js` adds authenticated publish RPC and public list RPC without exposing auth tokens. `supabase/leaderboard.sql` adds a private RLS-enabled table and restricted security-definer functions; only verified identity can publish its own row. Per-field maxima make retries idempotent and prevent decreases; devices are not summed.
- [x] Applied `supabase/leaderboard.sql` to live project `hyxikdqpiykzkeiuihew` through the signed-in Brave SQL Editor on 2026-10-21.
- Validation: `node --test tools/*.cjs` passed 86/86, including active/idle/hidden/unfocused/cheat timing, totals, API payload validation and guest restrictions. Syntax and `git diff --check` passed. Chrome: real local tracking survived game navigation; 13 games preserved; desktop/mobile screenshots inspected; no page errors. Isolated server fixtures verified global rows, sort and explicit-only publishing without sending test data to the service. Live migration applied in the follow-up: public list RPC returns HTTP 200 with an empty array; anonymous direct table reads and anonymous publish RPC return HTTP 401 / SQLSTATE 42501. Live authenticated publishing has not been exercised with a real player account. Native Brave automation timed out after Run; the successful schema application was independently confirmed through the live HTTP API. Physical devices not tested. Service-worker assets regenerated.


## 2026-10-21 — Game Market and community listings

- Scope: `market.html` keeps all 13 games with search/category/source filters and paginated community cards. Dashboard has six quick links plus a prominent Market link; hero count remains 13. `script.js` reads `data-total-games` independently of quick-link count.
- New `market.js`, `market.css`, `market-rules.js`; external game cards open public HTTPS URLs in a new tab with noopener/noreferrer/no-referrer. Text-only metadata; no embedding, scraping, remote code fetch or CM integration for external games.
- `casual-cloud.js` adds list/publish/unpublish market RPC methods with auth/epoch checks. `supabase/market.sql` provides restricted functions over a private RLS-enabled table. Verified owner only; ten active listings max with serialized submissions, same owner+URL upsert, soft unpublish.
- `market-rules.js` validates URL/title/description/category in browser and Node tests; SQL repeats constraints. Anonymous users browse; signed-in users publish.
- [ ] Apply the Market migration and validate live endpoints.
- Validation: URL/API/UI regression tests added in `tools/test-market*.cjs` and `tools/test-cloud.cjs`; open-dialog update protection tested in `tools/test-updates.cjs`. Browser: all 13 catalog cards, six dashboard shortcuts, correct total count, Dino search, six Zekâ results, guest publish disabled and form controls verified. Native Brave control timed out; live Market RPC currently returns 404, so global publication is not yet enabled. Real-account posting and physical/mobile device testing remain unverified. `node --test tools/*.cjs` passed 97/97; syntax checks and `git diff --check` passed. Service-worker generation includes 133 URLs.

- Small-screen navigation wraps to its own row. Open Market submission dialog defers automatic site-update reload, preserving the draft.


## 2026-10-21 — Home game selection and Market moderation

- Scope: real “Ana ekrana ekle” selection for at most six dashboard games; `home-games.js` stores IDs only in `cp_home_games_v1`. `home-screen.js` revalidates pinned community IDs through an approved-only server RPC; revoked/withdrawn links cannot be read from stored URLs.
- Community submission button is “Onaya gönder”; new/edited listings are pending. Own listings show review status/note. `market-admin.js` displays a server-authorized review panel with approve/reject/note and revision checks.
- `supabase/market.sql` upgrades existing listings to pending, creates a private UUID-based admin table, and enforces authorization per review call. Only approved listed games appear publicly. `supabase/market-admin-eymnyld.sql` binds the existing real eymnyld Auth UUID, fails if absent, and never grants roles based on a browser name or future signup.
- [ ] Apply updated market.sql and admin seed to live Supabase; prior native browser-control blocker remains.
- Validation: `node --test tools/*.cjs` passed 110/110, including six-slot persistence, public pending/rejected filtering, own review statuses, server-derived admin UI (a non-admin named eymnyld remains unauthorized), revision-bearing review payloads, stale-review errors, sign-out cleanup and approved-only pinned URLs. Syntax checks and `git diff --check` passed. Real browser: add/remove limit, swap XOX/Dino, page navigation and reload persistence, and “Onaya gönder” label verified; temporary selection restored. Updated SQL/admin seed not executed live due the existing native browser-control blocker. Physical devices and live authenticated moderation remain unverified.


## 2026-10-21 — Expanded home library and viewport dashboard

- Scope: raise selected games from 6 to 30, preserving `cp_home_games_v1`. `home-games.js.pageSize` chooses 6/4/3/2 visible cards by viewport; `home-screen.js` provides Previous/Next and clamps pages after resize/removal.
- New `dashboard.css` / `dashboard.js`: fixed-height outer dashboard, six accessible tabs, legacy hash routes preserved. Games never need vertical page scrolling; long non-game forms/tables scroll within their active pane. All existing IDs/account/reward/save controls retained.
- `casual-cloud.js` / `market.sql` raise approved home-game lookup bound from 6 to 30; previous unexecuted Market migration remains pending, not restarted.
- [x] 30-slot selection and viewport dashboard implemented. Existing selections preserved.
- Validation: `node --test tools/*.cjs` passed 115/115; `node --check dashboard.js`, `node --check home-screen.js` and `git diff --check` passed. Browser at 1280×720: document scroll dimensions exactly matched viewport, eight selected games paged 6+2, account/leaderboard/themes tabs worked; temporary pins restored to the original six. Responsive 6/4/3/2 counts, resize/page clamping, keyboard navigation and legacy hashes covered by tests. Physical/mobile-device layout not exercised. Service-worker assets regenerated (143 URLs). Live Market migration/admin setup remains pending as previously recorded; this change has not been deployed.


## 2026-10-21 — Dashboard grouping and account backup

- [x] Moved file backup into Hesap; removed standalone Yedek tab. Legacy `#save` / `#save-title` routes select Hesap. Renamed Temalar tab/heading to Görünüş; existing theme IDs retained.
- [x] Added “Grup başına” selector (Otomatik / 2 / 4 / 6 / 8 / 12 / 18 / 30). New `cp_home_page_size_v1` cookie validates/persists preference independently of game IDs. Changing size resets pagination; four cards use a 2×2 grid. Automatic viewport sizing and 30-game capacity preserved.
- Validation: full Node suite 117/117 passed; changed JavaScript syntax and `git diff --check` passed. Desktop browser verified selected size survives reload, next group reaches remaining games, and backup controls are within Hesap. Fixed pager overlap with code-console trigger and removed inherited game-panel bottom margin. Service worker regenerated. Physical/mobile devices not tested; not deployed.

- Follow-up: explicit groups above six use additional columns and compact cards; larger groups use fixed-size, centered logo tiles so icons stay aligned; only decorative labels/description are hidden. Focused tests passed 15/15 (including 12→1 pagination and 30-slot groups); syntax and diff checks passed. Browser showed eight actual games in one group at 1280×720 with document and pane scroll heights matching viewport; temporary extra pins restored. Screenshot saved. Physical devices not tested. Service-worker assets regenerated.


## 2026-10-21 — Shared SVG game icons

- Scope: replace the emoji/text symbols and CSS-drawn shapes in game cards with one shared line-style SVG icon set, and fix card sizing so every group size aligns. Turkish interface and existing code style preserved.
- New `game-icons.js` exposes `CasualGameIcons` (`svg/has/shape/ids`, `ROOT`, `FALLBACK`): 24×24 viewBox, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.6"`, round caps/joins, ASCII-only paths and no `<text>`. Thirteen catalog ids plus a `community` external-link fallback; unknown ids resolve to it.
- `home-games.js` drops the emoji `icon` field. `home-screen.js` renders `CasualGameIcons.svg()` for built-ins and the fallback for pinned community games; `market.js` uses the fallback for community cards. `index.html` (6 cards) and `market.html` (13 cards) carry the same inline markup, so first paint, no-JS and JavaScript rendering are identical. Versions: `style.css?v=29`, `dashboard.css?v=10`, `market.css?v=3`, `game-icons.js?v=1`, `home-games.js?v=5`, `home-screen.js?v=6`, `market.js?v=4`.
- Removed the per-game `*-art` shape rules from `style.css` and the emoji `font-size`/`letter-spacing` card hacks from `dashboard.css`. Card art now sizes only through `.game-art > svg` (max 64px), `.dashboard-app .game-art > svg` (74% of the fixed 44/38/34/32/28px tile) and `.community-icon > svg` (26px).
- Home grid rows are computed from the actual pinned-game count instead of the group size, so a 30-slot group holding 13 games fills the panel instead of leaving empty rows; paging sizes stay stable across pages.
- Icon art was chosen by rendering a contact sheet and variants in headless Chrome (log/lathe, snake, dino needed iterations); the temporary sheets were deleted and are not shipped.
- [x] All 13 games plus the community fallback in one set; no emoji and no CSS-drawn card shapes remain.
- Validation: `node --test tools/*.cjs` passed 125/125, including new `tools/test-game-icons.cjs` (set/catalog coverage, shared line-style attributes, ASCII-only paths, static HTML markup equals module output for all 19 cards, runtime and CSS regressions). `node --check` on the four changed scripts and `git diff --check` passed. Headless Chrome with a fresh profile at 1280×720 and 375×667: six default cards, eight-card dense group, thirteen-card 30-slot group and 13 Market cards all render SVG icons; no page scroll, no card overflow, equal icon sizes within a group, no emoji left; desktop/mobile/market screenshots inspected. The only console error is the pre-existing live `list_market_games` RPC 404 (Market migration still unapplied). Physical-device testing not done. Service-worker assets regenerated (145 URLs).
