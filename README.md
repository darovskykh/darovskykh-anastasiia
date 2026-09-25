# darovskykh-anastasiia

Робоча копія фронта TradeBV для редизайну адмінки персони. Нікуди не деплоїться і ні до чого не під'єднана.

## Що тут

- `tradebv-front/` — копія фронта TradeBV (Vite + React + TypeScript).
- `docs/tradebv-admin/vymohy.md` — вимоги до адмінки персони (дзвінок 25.09).
- `docs/tradebv-admin/dlya-vani.md` — що змінено в макеті, як запустити на фейкових даних (`npm run dev:mock`) і що перенести в справжній фронт.

## Звідки копія

- Репозиторій: `Gart-Tech-Agents/platform-source`, гілка `main`, коміт `9d59c1eb7c0dfa5e8ac4f4469cb57fe1f91b28bd` (25.09.2026).
- Папка: `objects/service/gart-tech-default-project-europe-west3.tradebv-front/source/repository` — вихідний код живого сервісу `tradebv-front` (Cloud Run, europe-west3).
- Оригінал фронта: `Gart-tech/tradebv-front`, гілка `main`.

## Важливо

- `tradebv-front/.github/workflows` містить деплой на прод при push. GitHub запускає workflows тільки з кореня репозиторію, тому тут вони не спрацюють. Не переносити `tradebv-front/` у корінь репозиторію разом із `.github`.
- Секретів у копії немає, лише `.env.example`.
