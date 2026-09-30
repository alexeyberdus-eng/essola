# yandex-scan — распознавание состава через Yandex Cloud

Функция принимает фото этикетки, читает текст через Vision OCR и отдаёт чистый список ингредиентов, который выделяет YandexGPT Lite.

## Развёртывание (после активации аккаунта)
1. В консоли Yandex Cloud создайте сервисный аккаунт с ролями `ai.vision.user` и `ai.languageModels.user`, выпустите для него API-ключ.
2. Создайте Cloud Function (среда Node.js 18+), вставьте `index.js`, точка входа `index.handler`.
3. Переменные окружения функции:
   - `YC_API_KEY` — API-ключ сервисного аккаунта;
   - `YC_FOLDER_ID` — ID каталога;
   - `APP_KEY` — любая длинная строка-пароль (та же, что в приложении).
4. Сделайте функцию публичной и возьмите её адрес (`https://functions.yandexcloud.net/…`).
5. Добавьте в GitHub Secrets `EXPO_PUBLIC_SCAN_URL` (адрес функции) и `EXPO_PUBLIC_SCAN_KEY` (тот же `APP_KEY`).

Запрос: `POST {"image": "<base64 JPEG>"}` с заголовком `X-App-Key`. Ответ: `{"text": "...", "ingredients": ["Aqua", ...]}`.
