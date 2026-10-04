import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CatalogClient,
  formatDuration,
  searchBooks,
  type BookSummary,
  type Category,
  type Chapter,
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
  it("чытае кнігі, катэгорыі і главы", async () => {
    const categories: Category[] = books[0]!.categories;
    const chapters: Chapter[] = [
      {
        id: "ch-1",
        name: "Раздзел 1",
        duration: 60_000,
        url: "https://example.test/1.mp3",
        blocked: false,
      },
    ];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      const body = url.endsWith("/books")
        ? books
        : url.endsWith("/gallery-categories")
          ? categories
          : chapters;
      return new Response(JSON.stringify(body), { status: 200 });
    };
    const catalog = new CatalogClient("https://knizhnyvoz.test", fetchImpl, () => 0);
    const found = await catalog.getBook("book-1");
    assert.equal(found.chapters[0]?.name, "Раздзел 1");
    assert.equal(found.duration, "1 гадз 0 хв");
    const listed = await catalog.listCategories();
    assert.equal(listed[0]?.key, "babies");
  });
});
