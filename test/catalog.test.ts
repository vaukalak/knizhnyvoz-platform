import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CatalogClient,
  formatDuration,
  searchBooks,
  type BookSummary,
} from "../src/catalog.js";

const books: BookSummary[] = [
  {
    id: "book-1",
    imageUri: "https://example.test/1.jpg",
    name: "Вожык і ліс",
    author: "Янка Маўр",
    description: "Казка пра сяброўства ў лесе",
    categories: [{ id: "c1", key: "babies", name: "Для малечы (0+)" }],
    roles: [{ role: "Чытае", names: ["Алена Гарэцкая"] }],
    totalDuration: 3_600_000,
    isPublished: true,
    chapters: [],
  },
  {
    id: "book-2",
    imageUri: "https://example.test/2.jpg",
    name: "Дзікае паляванне караля Стаха",
    author: "Уладзімір Караткевіч",
    description: "Гісторыя пра стары замак",
    categories: [{ id: "c2", key: "olderchildren", name: "12+ для падлеткаў" }],
    roles: [{ role: "Чытае", names: ["Ігар Сігоў"] }],
    totalDuration: 90_000,
    isPublished: true,
    chapters: [],
  },
];

describe("formatDuration", () => {
  it("піша гадзіны і хвіліны", () => {
    assert.equal(formatDuration(3_600_000), "1 гадз 0 хв");
    assert.equal(formatDuration(90_000), "1 хв");
  });
});

describe("searchBooks", () => {
  it("знаходзіць кнігу па аўтару і катэгорыі", () => {
    const matches = searchBooks(books, {
      query: "караткевіч",
      category: "olderchildren",
    });
    assert.equal(matches.total, 1);
    assert.deepEqual(
      matches.books.map((book) => book.id),
      ["book-2"],
    );
    assert.equal(matches.books[0]?.url, "https://knizhnyvoz.com/app/book/book-2");
  });

  it("патрабуе ўсе словы запыту", () => {
    const matches = searchBooks(books, { query: "вожык замак" });
    assert.equal(matches.total, 0);
  });

  it("скарачае доўгае апісанне ў выдачы пошуку", () => {
    const long = {
      ...books[0]!,
      description: "а".repeat(500),
    };
    const matches = searchBooks([long], { limit: 1 });
    assert.equal(matches.books[0]?.description.endsWith("…"), true);
    assert.ok((matches.books[0]?.description.length ?? 0) <= 401);
  });
});

describe("CatalogClient", () => {
  it("збірае аўтара з роляў і людзей і шле токен", async () => {
    const seen: { url: string; cookie?: string }[] = [];
    const apiBook = {
      id: "book-1",
      title: "Вожык і ліс",
      description: "Казка",
      banner_url: "https://example.test/1.jpg",
      isPublished: false,
      categories: [{ id: "c1", key: "babies", name: "Для малечы (0+)" }],
      roles: [{ role_id: "role-author", person_id: "person-1" }],
      chapters: [
        {
          id: "ch-1",
          title: "Раздзел 1",
          number: 1,
          duration: 3_600_000,
          url: "https://example.test/1.mp3",
        },
      ],
    };
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      seen.push({ url, cookie: headers.get("cookie") ?? undefined });
      const body = url.endsWith("/books")
        ? [apiBook]
        : url.endsWith("/people")
          ? [{ id: "person-1", firstName: "Янка", lastName: "Маўр" }]
          : url.endsWith("/roles")
            ? [{ id: "role-author", name: "Аўтар" }]
            : url.endsWith("/categories")
              ? apiBook.categories
              : apiBook;
      return new Response(JSON.stringify(body), { status: 200 });
    };
    const catalog = new CatalogClient(
      "https://api.knizhnyvoz.test",
      fetchImpl,
      () => 0,
      "secret-token",
    );
    const found = await catalog.getBook("book-1");
    assert.equal(found.author, "Янка Маўр");
    assert.equal(found.chapters[0]?.name, "Раздзел 1");
    assert.equal(found.duration, "1 гадз 0 хв");
    assert.equal(found.isPublished, false);
    assert.equal(seen[0]?.url, "https://api.knizhnyvoz.test/books");
    assert.equal(seen[0]?.cookie, "auth_token=secret-token");

    delete process.env.KNIZHNYVOZ_API_TOKEN;
    process.env.AUTH_COOKIE = "cookie-jwt";
    const fromEnv = new CatalogClient("https://api.knizhnyvoz.test", fetchImpl, () => 1);
    await fromEnv.listCategories();
    assert.equal(seen.at(-1)?.cookie, "auth_token=cookie-jwt");
    delete process.env.AUTH_COOKIE;
    const listed = await catalog.listCategories();
    assert.equal(listed[0]?.key, "babies");
  });
});
