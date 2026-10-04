# Кніжны воз MCP

MCP-сервер каталога беларускіх аўдыякніг [Кніжны воз](https://knizhnyvoz.com).

Даныя бяруцца з [https://api.knizhnyvoz.com](https://api.knizhnyvoz.com). Старонка [https://api.knizhnyvoz.com/api](https://api.knizhnyvoz.com/api) — гэта Swagger, а не прэфікс метадаў.

- `GET /books/published` — апублікаваны каталог, без токена
- `GET /books` — каталог разам з чарнавікамі, калі зададзены токен
- `GET /books/:id` — главы, катэгорыі і ролі
- `GET /categories`, `GET /people`, `GET /roles`

## Токен

Лагін — гэта JWT, не пароль у рэпазіторыі. Скапіруйце `.env.example` у `.env` і ўпішыце токен:

```sh
KNIZHNYVOZ_API_TOKEN=eyJ...
```

Сервер чытае `.env` пры старце і шле загаловак `Authorization: Bearer …`. Токен, які ўжо ёсць у асяроддзі, файл не перазапісвае. Сам `.env` у git не трапляе.

Без токена працуе пошук па апублікаваных кнігах. З токенам у выдачу трапляюць і неапублікаваныя.

## Інструменты

- `list_categories` — катэгорыі
- `search_books` — пошук па назве, аўтару, апісанні, чытачу, катэгорыі і главах
- `get_book` — картка кнігі і главы з аўдыё

Рэсурсы: `knizhnyvoz://catalog` і `knizhnyvoz://books/{bookId}`.

## Запуск у Cursor

```sh
npm install
cp .env.example .env
```

Канфіг MCP: `.cursor/mcp.json`. Пасля змены `.env` перазапусціце сервер.

## Каманды

```sh
npm test
npm start
npm run start:http
```

HTTP-эндпоінт: `http://127.0.0.1:3000/mcp`. Для праслухоўвання звонку задайце `HOST=0.0.0.0` і `PORT`.
