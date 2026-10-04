import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { CatalogClient, searchBooks } from "./catalog.js";

const SERVER_INSTRUCTIONS = [
  "Каталог аўдыякніг «Кніжны воз» з https://api.knizhnyvoz.com (Swagger: /api).",
  "Чытанне апублікаваных кніг працуе без токена. KNIZHNYVOZ_API_TOKEN дадае Authorization: Bearer і адкрывае чарнавікі.",
  "Кнігі для дзяцей і падлеткаў. Спачатку шукай праз search_books, потым бяры главы праз get_book.",
  "Катэгорыі бяры з list_categories і перадавай іх key у search_books.",
  "Адказвай па-беларуску, калі карыстальнік піша па-беларуску.",
].join(" ");

export function createServer(catalog = new CatalogClient()): McpServer {
  const server = new McpServer(
    {
      name: "knizhnyvoz",
      version: "1.0.0",
      title: "Кніжны воз",
    },
    { instructions: SERVER_INSTRUCTIONS },
  );

  server.registerTool(
    "list_categories",
    {
      title: "Катэгорыі",
      description:
        "Спіс катэгорый галерэі «Кніжнага возу» (узрост і тэматычныя падборкі). Key можна перадаць у search_books.",
      inputSchema: z.object({}),
    },
    async () => {
      const categories = await catalog.listCategories();
      return jsonResult(categories);
    },
  );

  server.registerTool(
    "search_books",
    {
      title: "Пошук кніг",
      description:
        "Шукае аўдыякнігі па назве, аўтару, апісанні, чытачу і катэгорыі. Усе словы запыту мусяць сустрэцца. Пусты запыт вяртае каталог.",
      inputSchema: z.object({
        query: z
          .string()
          .optional()
          .describe("Словы для пошуку, напрыклад «Караткевіч» або «казкі пра ліса»"),
        category: z
          .string()
          .optional()
          .describe("Key або назва катэгорыі, напрыклад babies або «Для малечы (0+)»"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Колькі кніг вярнуць, ад 1 да 50. Па змаўчанні 20"),
      }),
    },
    async ({ query, category, limit }) => {
      const books = await catalog.listBooks();
      return jsonResult(searchBooks(books, { query, category, limit }));
    },
  );

  server.registerTool(
    "get_book",
    {
      title: "Кніга",
      description:
        "Поўная картка аўдыякнігі: апісанне, ролі і спіс главаў з працягласцю і спасылкай на аўдыё.",
      inputSchema: z.object({
        id: z.string().describe("UUID кнігі з search_books"),
      }),
    },
    async ({ id }) => {
      const book = await catalog.getBook(id);
      return jsonResult(book);
    },
  );

  server.registerResource(
    "catalog",
    "knizhnyvoz://catalog",
    {
      title: "Каталог Кніжнага возу",
      description: "Кароткі спіс усіх аўдыякніг",
      mimeType: "application/json",
    },
    async (uri) => {
      const books = await catalog.listBooks();
      const cards = searchBooks(books, { limit: books.length }).books;
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(cards, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    "book",
    new ResourceTemplate("knizhnyvoz://books/{bookId}", {
      list: async () => {
        const books = await catalog.listBooks();
        return {
          resources: books.map((book) => ({
            uri: `knizhnyvoz://books/${book.id}`,
            name: book.name,
            description: book.author,
            mimeType: "application/json",
          })),
        };
      },
    }),
    {
      title: "Аўдыякніга",
      description: "Картка адной аўдыякнігі разам з главамі",
      mimeType: "application/json",
    },
    async (uri, { bookId }) => {
      const book = await catalog.getBook(String(bookId));
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(book, null, 2),
          },
        ],
      };
    },
  );

  return server;
}

function jsonResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}
