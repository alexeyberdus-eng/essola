# essola lab — guide for AI agents (Codex, Claude)

Read this file and `docs/HANDOFF.md` before any task; details (base crawls, sign-in, App Store items) are in `docs/REFERENCE.md`. Update `docs/HANDOFF.md` when you finish or hand over.

**Change log is mandatory.** Every commit you push adds a line at the top of `docs/CHANGELOG.md`, in the same commit:
time (Moscow), author (Claude / Codex), branch, what changed and why in plain Russian, commit hash or «(этот коммит)»,
and where it went live (Expo Go / сервер / RuStore) if it did.

The owner is a beginner and writes in Russian: answer in Russian, in plain words.

## People and accounts (no secrets here)

- The owner runs an ИП in Russia. RuStore is published on the owner's account.
- Google Play: a personal account of the owner's friend (Canada). Closed test «Alpha» was published on 07.10.2026;
  12+ testers for 14 days are needed before the production release.
- Apple: planned through the same friend's account, with the owner as Admin, and an App Transfer later. No iOS build yet.
- Expo account `alex777essola`, project `essola`, free build plan: the build queue can take hours. The workflow
  «Ссылки на сборки» (change `.github/build-links.trigger` and push) waits for the newest build and posts the links.
- Admin panel: `https://functions.yandexcloud.net/d4eikcrvo6v275frt26v?admin` (password = secret `ADMIN_TOKEN`).
- Privacy policy, terms and support pages: the same address with `?doc=privacy`, `?doc=terms`, `?doc=support`.

## What the product is

Mobile app «essola lab» (Expo / React Native). Features:
- scanner of cosmetics compositions: photo, front label, barcode / «Честный знак», shop link;
- product base of ~371 000 products;
- comparison of two products;
- home-recipe builder (конструктор) with a technologist review;
- Essola shop, recipes feed, forum, Essola Club.

## Layout

| Path | What |
|---|---|
| `app/` | The Expo app (SDK 57, expo-router). Screens in `app/src/app/`, logic in `app/src/lib/`, data in `app/src/data/`. Also read `app/AGENTS.md` (Expo rules). |
| `app/src/lib/analyze.ts` | Composition scoring, runs on the phone, no AI. |
| `app/src/lib/ai.ts` | All calls to our server (`mode: 'scan' \| 'label' \| 'describe' \| 'review' \| 'compare' \| 'catalog' \| …`). |
| `app/scripts/` | Base builders run by GitHub Actions: Letual, INKEEDecoder, CosIng, ingredient index, catalog. |
| `server/yandex-scan/index.js` | The single Yandex Cloud Function: AI calls (YandexGPT, Qwen vision), product base, accounts, forum, limits, stats. |
| `server/yandex-scan/admin.html` | Admin panel, including «Расходы и статистика» (AI spend per mode per day). |
| `docs/` | `CHANGELOG.md` (every change), `HANDOFF.md` (current state), `REFERENCE.md` (how things work), RuStore listing (`docs/rustore/`), points plan (`docs/monetization.md`). |

## Branches and deploys

- Main working branch: `claude/awesome-mccarthy-dlbgor`. A push there **deploys automatically**:
  - `server/yandex-scan/**` → workflow «Deploy AI scan function» updates the live server;
  - `app/**` → workflow «EAS Update» publishes to the `preview` channel (Expo Go and the test APK).
- **Several agents at once.** Only one agent at a time works directly in the main working branch — the one the owner
  named for that. Every other agent (a second Claude, Codex) works in its own branch and opens a PR into the main
  working branch:
  - start your branch from the main working branch, not from the repository's default branch (the default branch
    `claude/vavyv-v95vm9` is old):
    `git fetch origin claude/awesome-mccarthy-dlbgor && git checkout -B <your-branch> origin/claude/awesome-mccarthy-dlbgor`;
  - before the PR, merge the latest main working branch into yours (no rebase or force-push of shared branches);
  - pushes to other branches deploy nothing (except `main`, which also runs «EAS Update» — don't push there).
  - Never push to the same branch at the same time as another agent.
- Store users (RuStore, `production` channel) get changes only from the manual workflow «Выпустить обновление».
  Run it only when the owner asks.
- A new APK or store build is needed only for native changes: modules, permissions, icon. Use the workflow
  «Android APK» with `store: true` for RuStore.

## Checks before pushing

```bash
cd app && npm ci
npx tsc --noEmit              # typecheck
npm run test:analyzer         # analyzer sanity check, must print "analyzer ok"
node --check ../server/yandex-scan/index.js
```

Server helpers can be unit-checked with node, for example
`node -e "require('./server/yandex-scan/index.js')._balanceReview(...)"`.
The exported helpers are `_balanceReview`, `_decodeDescribe`, `_decodeCompare`, `_imageOk` and `_keywordSearch`.

## Logs and diagnosis

- Data backup: workflow «Резервная копия данных» (`.github/workflows/backup.yml`) packs the whole bucket, encrypts it
  with the `BACKUP_PASSWORD` secret, keeps it 30 days as an artifact and copies it to the Timeweb server when
  `TIMEWEB_HOST` / `TIMEWEB_SSH_KEY` exist. Run it by changing `.github/backup.trigger`.
- Server logs: change `server/yandex-scan/logs.trigger` and push → workflow «AI scan function logs» prints the recent logs.
- AI spend: admin panel → «Расходы и статистика».
- Secrets live only in GitHub → Settings → Secrets: `YC_*`, `EXPO_TOKEN`, `ADMIN_TOKEN`, `VK_CLIENT_ID`, and Apple keys later.
  Never put keys in code, chat or files. Never ask the owner to paste them.

## AI cost rules (keep spend low)

- Every model answer is cached on the server for everyone (same composition / formula / pair → no new call).
- Prefer coded short answers decoded on the server: `DESCRIBE` + `decodeDescribe`, `COMPARE_LITE` + `decodeCompare`.
- Daily limits per kind are enforced in `allow()`: free 3, Club 10, describe 30/100, admin unlimited.
- Photos are resized on the phone (`app/src/lib/ocr.ts`): 1080 px for a composition, 560 px for a label.
- Real prices are in `docs/monetization.md`.

## Hard rules

- No mass scraping of Ozon / Wildberries / Gold Apple, and never bypass shop anti-bot checks.
  - Allowed: the user's own in-app WebView reading the page they opened, and the WB public `card.json` per link.
  - Letual and INKEEDecoder: used with the owners' permission.
  - CosIng: EU open data, keep the attribution.
  - COSMILE: not allowed.
- Never fabricate user content (reviews, forum posts). Editorial content is signed «essola».
- Payments: no hidden enabling through the server. Points or payments come only in a new app version reviewed by the
  store. On iPhone, digital goods are sold only through Apple in-app purchases. The plan is in `docs/monetization.md`
  and is **not enabled yet**: App Store publication comes first.
- Don't publish the owner's photos. Admin access is by email hash or `ADMIN_TOKEN`.
- Who acts on the server is decided by `actor()`: the session, or a guest id with its device secret. Never trust
  `req.id` alone for anything that changes data.
- Paid calls go through `allow()` (reservation files, fails closed). Compositions from phones go through
  `userSubmit()` and never overwrite another record.
- Technologist advice in the builder must keep the formula at 100% (`balanceReview` fills with the base, never an active).
