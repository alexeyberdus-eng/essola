# essola lab — guide for AI agents (Codex, Claude)

Read this file and `docs/HANDOFF.md` before any task; details (base crawls, sign-in, App Store items) are in `docs/REFERENCE.md`. Update `docs/HANDOFF.md` when you finish or hand over.
The owner is a beginner and writes in Russian: answer in Russian, in plain words.

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
| `docs/` | `HANDOFF.md` (current state), `REFERENCE.md` (how things work), RuStore listing (`docs/rustore/`), points plan (`docs/monetization.md`). |

## Branches and deploys

- Main working branch: `claude/awesome-mccarthy-dlbgor`. A push there **deploys automatically**:
  - `server/yandex-scan/**` → workflow «Deploy AI scan function» updates the live server;
  - `app/**` → workflow «EAS Update» publishes to the `preview` channel (Expo Go and the test APK).
- Other agents (Codex) work in their own branch, for example `codex/<task>`, and open a PR into the main working
  branch. Pushes to other branches deploy nothing (except `main`, which also runs «EAS Update» — don't push there). Never push to the same branch at the same time as another agent.
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
The exported helpers are `_balanceReview`, `_decodeDescribe`, `_decodeCompare` and `_keywordSearch`.

## Logs and diagnosis

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
- Technologist advice in the builder must keep the formula at 100% (`balanceReview` fills with the base, never an active).
