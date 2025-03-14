# Документация Telegram-бота

## Обзор

Этот **Telegram-бот** написан на **TypeScript** и создан для автоматизации сбора информации из чатов и формировании отчетов в Google Таблицы. Бот отслеживает сообщения в чатах, в которые он добавлен, и с заданной периодичностью формирует отчёт в Google Таблицы, в котором указывает, в каких чатах он не заметил заданных фраз (хештегов) за указанный период времени.

### Основные функции:
- **Планирование отчетов:** Формирует отчёты с заранее заданной периодичностью.
- **Фильтрация по отсутствию фразы:** Фильтрует чаты, в которых не были замечены заданные фразы (хештеги).
- **Интеграция с Google Таблицами:** Отчёты записываются в Google Sheets с помощью API.
- **Админ-панель:** Управление настройками бота доступно только для администратора (target_id в settings.json) через команду `/settings`.

---

## Предварительные требования

Перед началом работы убедитесь, что у вас установлено следующее:

1. **Node.js** (версия 16 или выше)
2. **npm** (менеджер пакетов Node.js)
3. **Проект Google Cloud** с включенным API Google Sheets
4. **Сервисный аккаунт** для доступа к API Google Sheets
5. Telegram-бот, созданный через [BotFather](https://core.telegram.org/bots#botfather), и соответствующий токен.

---

## Установка и настройка

### Шаг 1: Клонирование репозитория

```bash
git clone https://github.com/greendolf/collector.git
cd your-repository-folder
```

### Шаг 2: Установка зависимостей

Запустите следующую команду для установки всех необходимых зависимостей:

```bash
npm install
```

### Шаг 3: Создание файла `auth.json`

Создайте файл с именем `auth.json` в корневой директории проекта. Этот файл должен содержать учётные данные для вашего сервисного аккаунта Google. Вы можете скачать этот JSON-файл при создании сервисного аккаунта в Google Cloud Console.

Пример структуры `auth.json`:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "your-private-key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n",
  "client_email": "your-service-account-email@your-project.iam.gserviceaccount.com",
  "client_id": "your-client-id",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/your-service-account-email%40your-project.iam.gserviceaccount.com"
}
```

### Шаг 4: Создание файла `settings.json`

Создайте файл с именем `settings.json` в корневой директории проекта. Используйте следующий формат, основанный на предоставленном примере:

```json
{
  "bot_token": "your_bot_token",
  "google_sheet_id": "your_google_sheet_id",
  "target_id": 111111111,
  "timezone": "Asia/Krasnoyarsk",
  "report_day": 1,
  "report_time": [
    "09",
    "00"
  ],
  "period": [
    "1",
    "week"
  ],
  "hashtags": [
    {
      "hashtag": "#митрепорт",
      "header": "Тут не было митрепортов"
    },
    {
      "hashtag": "#еженедельныйотчет",
      "header": "Тут не было еж. отчетов"
    }
  ]
}
```

#### Пояснение полей:
- `bot_token`: Токен вашего Telegram-бота, полученный от BotFather.
- `google_sheet_id`: ID Google Таблицы, куда будут сохраняться отчёты.
- `target_id`: ID пользователя Telegram, который имеет доступ к админ-панели. Только этот пользователь может управлять настройками бота.
- `timezone`: Часовой пояс, используемый для планирования отчетов (например, `Asia/Krasnoyarsk`).
- `report_day`: День недели для запланированных отчетов (0 = воскресенье, 1 = понедельник и т.д.).
- `report_time`: Время дня для запланированных отчетов (в формате `[час, минута]`).
- `period`: Частота отчетов (`[значение, единица]`, например, `["1", "week"]` для еженедельных отчетов).
- `hashtags`: Список хештегов и соответствующих заголовков для фильтрации сообщений.

### Шаг 5: Включение API Google Sheets

Убедитесь, что API Google Sheets включен для вашего проекта Google Cloud. Кроме того, предоставьте доступ к целевой Google Таблице электронной почте, указанной в поле `client_email` вашего `auth.json`.

---

## Админ-панель

Управление настройками бота доступно только для пользователя Telegram, ID которого указан в поле `target_id` в файле `settings.json`. Для доступа к админ-панели отправьте команду `/settings` в **личные сообщения бота**.

> **Важно:** Команда `/settings` будет работать только в личных сообщениях с ботом и только для пользователя с ID, указанным в `target_id`.

---

## Запуск бота

Чтобы запустить бота, выполните следующую команду:

```bash
npm run start
```

Бот подключится к Telegram и начнет прослушивать команды и сообщения.

---

## Компиляция TypeScript

Поскольку бот написан на **TypeScript**, перед запуском необходимо скомпилировать код в JavaScript. Для этого выполните следующую команду:

```bash
npm run build
```

Это создаст скомпилированные файлы в папке `dist` (или другой, указанной в вашем `tsconfig.json`).

---

## Развертывание

Для развертывания в production рекомендуется использовать менеджер процессов, такой как **PM2**, чтобы бот работал непрерывно:

1. Установите PM2 глобально:

   ```bash
   npm install -g pm2
   ```

2. Запустите бота с помощью PM2:

   ```bash
   pm2 start dist/main.js --name "telegram-bot"
   ```

   > **Примечание:** Если вы компилируете TypeScript в другую папку, убедитесь, что указываете правильный путь к скомпилированному файлу.

3. Сохраните список процессов PM2:

   ```bash
   pm2 save
   ```

4. Для просмотра логов:

   ```bash
   pm2 logs
   ```