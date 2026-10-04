# Кніжны воз MCP

MCP-сервер каталога бясплатных беларускіх аўдыякніг [Кніжны воз](https://knizhnyvoz.com).

Сервер чытае публічнае API праграмы:

- `GET /books` — спіс кніг
- `GET /gallery-categories` — катэгорыі
- `GET /books/:id` — главы

## Інструменты

- `list_categories` — катэгорыі галерэі
- `search_books` — пошук па назве, аўтару, апісанні, чытачу і катэгорыі
- `get_book` — картка кнігі і главы з аўдыё

Рэсурсы: `knizhnyvoz://catalog` і `knizhnyvoz://books/{bookId}`.

## Запуск у Cursor

Усталюйце залежнасці і перазапусціце MCP. Канфіг ужо ляжыць у `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "knizhnyvoz": {
      "command": "npx",
      "args": ["tsx", "src/stdio.ts"]
    }
  }
}
```

## Каманды

```sh
npm install
npm test
npm start
npm run start:http
```

HTTP-эндпоінт: `http://127.0.0.1:3000/mcp`. Для праслухоўвання звонку задайце `HOST=0.0.0.0` і `PORT`. Базавы адрас API можна перавызначыць праз `KNIZHNYVOZ_API_BASE`.
