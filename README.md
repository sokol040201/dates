# DATES

Компактная Windows-утилита в стиле Liquid Glass — современный аналог Birthday Millennium.

![Windows](https://img.shields.io/badge/Windows-x64-0078D4?logo=windows&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

## Возможности

- Frameless окно с матовым стеклом, акцентные темы и прозрачность
- **Знаменательные даты** и **именины** из встроенного каталога
- **Дни рождения** и свои события: форма, пакетный ввод, импорт/экспорт TXT/CSV/JSON
- Напоминания (в т.ч. повтор вечером в день события), трей, автозапуск
- Поиск, метки, сортировка, календарь месяца, карточка дня и шаблоны поздравлений
- Бэкап настроек и событий одним кликом
- **Автообновления** с [GitHub Releases](https://github.com/sokol040201/dates/releases)

## Установка

Скачайте последний релиз:  
https://github.com/sokol040201/dates/releases/latest

- `DATES_*_x64-setup.exe` — установщик (рекомендуется)
- `DATES_*_x64_en-US.msi` — MSI

После установки DATES сам проверяет обновления и ставит их из Releases.

## Разработка

```bash
npm install
npm run tauri dev
```

Сборка локально:

```bash
npm run tauri build
```

Для подписанных updater-артефактов нужны переменные:

```bash
# PowerShell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content .tauri/dates.key -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "your-password"
npm run tauri build
```

## Релиз

1. Поднимите версию в `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`
2. Закоммитьте и создайте тег:

```bash
git tag v1.0.0
git push origin v1.0.0
```

3. GitHub Actions соберёт Windows-бинарники, подпишет их и опубликует Release с `latest.json` для автообновлений.

Секреты репозитория:

| Secret | Описание |
|--------|----------|
| `TAURI_SIGNING_PRIVATE_KEY` | Содержимое `.tauri/dates.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Пароль ключа |

## Горячие клавиши

| Клавиши | Действие |
|---------|----------|
| `Ctrl+,` | Настройки |
| `Ctrl+N` | Ваши события |
| `Esc` | Закрыть оверлей |
| `Ctrl+Shift+D` | Показать / скрыть окно (глобально) |

## Стек

- Tauri 2 + React + TypeScript + Vite + Tailwind
- SQLite (`tauri-plugin-sql`)
- Solar Icons

## Лицензия

MIT — см. [LICENSE](LICENSE).
