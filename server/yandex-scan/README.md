# yandex-scan — ИИ для сканера и конструктора (Yandex AI Studio)

- `mode: "scan"` — фото этикетки → чистый список ингредиентов (Alice AI VLM).
- `mode: "describe"` — список ингредиентов → «что даёт состав» (YandexGPT Lite).
Баллы считает приложение по своей базе, не ИИ.

## Развёртывание
1. Сервисный аккаунт с ролью `ai.languageModels.user`, API-ключ к нему.
2. Cloud Function, Node.js 18+, код `index.js`, точка входа `index.handler`, таймаут 30 с.
3. Переменные окружения:
   - `YC_API_KEY` — API-ключ; `YC_FOLDER_ID` — ID каталога;
   - `APP_KEY` — любая длинная строка-пароль (та же в приложении);
   - `VLM_MODEL` — ID модели Alice AI VLM из AI Studio → «Модели», в формате `<id>/latest`
     (если не задан — `gemma-3-27b-it/latest`);
   - `TEXT_MODEL` — по умолчанию `yandexgpt-lite/latest`.
4. Сделать функцию публичной, адрес — в GitHub Secrets `EXPO_PUBLIC_SCAN_URL`, пароль — в `EXPO_PUBLIC_SCAN_KEY`.
