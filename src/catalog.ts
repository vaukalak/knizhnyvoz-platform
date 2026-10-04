const DEFAULT_API_BASE = "https://api.knizhnyvoz.com";
const CACHE_TTL_MS = 5 * 60 * 1000;

export type Category = {
  id: string;
  key: string;
  name: string;
};

export type Role = {
  role: string;
  names: string[];
};

export type BookSummary = {
  id: string;
  imageUri: string;
  name: string;
  author: string;
  description: string;
  categories: Category[];
  roles: Role[];
  totalDuration: number;
  isPublished: boolean;
  chapters: Chapter[];
};

export type Chapter = {
  id: string;
  name: string;
  duration: number;
  url: string;
  blocked: boolean;
};

export type BookCard = {
  id: string;
  name: string;
  author: string;
  description: string;
  categories: { key: string; name: string }[];
  roles: Role[];
  durationMs: number;
  duration: string;
  imageUri: string;
  url: string;
  isPublished: boolean;
};

export type BookDetails = BookCard & {
  chapters: {
    index: number;
    id: string;
    name: string;
    durationMs: number;
    duration: string;
    blocked: boolean;
    url: string;
  }[];
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export function bookPageUrl(bookId: string, chapterIndex?: number): string {
  const url = new URL(`/app/book/${bookId}`, "https://knizhnyvoz.com");
  if (chapterIndex !== undefined) {
    url.searchParams.set("chapter", String(chapterIndex));
  }
  return url.toString();
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) {
    return `${minutes} хв`;
  }
  return `${hours} гадз ${minutes} хв`;
}

export function toBookCard(book: BookSummary): BookCard {
  return {
    id: book.id,
    name: book.name,
    author: book.author,
    description: book.description.replaceAll("&nbsp;", " ").trim(),
    categories: book.categories.map((category) => ({
      key: category.key,
      name: category.name,
    })),
    roles: book.roles,
    durationMs: book.totalDuration,
    duration: formatDuration(book.totalDuration),
    imageUri: book.imageUri,
    url: bookPageUrl(book.id),
    isPublished: book.isPublished,
  };
}

function normalize(value: string): string {
  return value.toLocaleLowerCase("be").replace(/\s+/g, " ").trim();
}

function bookHaystack(book: BookSummary): string {
  const roleText = book.roles
    .flatMap((role) => [role.role, ...role.names])
    .join(" ");
  const categoryText = book.categories
    .flatMap((category) => [category.key, category.name])
    .join(" ");
  const chapterText = book.chapters.map((chapter) => chapter.name).join(" ");
  return normalize(
    [book.name, book.author, book.description, roleText, categoryText, chapterText].join(
      " ",
    ),
  );
}

export type SearchBooksInput = {
  query?: string;
  category?: string;
  limit?: number;
};

export function searchBooks(
  books: BookSummary[],
  input: SearchBooksInput,
): { total: number; books: BookCard[] } {
  const query = normalize(input.query ?? "");
  const category = normalize(input.category ?? "");
  const tokens = query.split(" ").filter(Boolean);
  const limit = input.limit ?? 20;

  const matched = books.filter((book) => {
    if (category) {
      const inCategory = book.categories.some((item) => {
        return (
          normalize(item.key) === category || normalize(item.name) === category
        );
      });
      if (!inCategory) {
        return false;
      }
    }
    if (tokens.length === 0) {
      return true;
    }
    const haystack = bookHaystack(book);
    return tokens.every((token) => haystack.includes(token));
  });

  const ranked = matched.sort((left, right) => {
    const leftName = normalize(left.name);
    const rightName = normalize(right.name);
    const leftScore = tokens.reduce(
      (score, token) => score + (leftName.includes(token) ? 2 : 0),
      0,
    );
    const rightScore = tokens.reduce(
      (score, token) => score + (rightName.includes(token) ? 2 : 0),
      0,
    );
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }
    return left.name.localeCompare(right.name, "be");
  });

  return {
    total: ranked.length,
    books: ranked.slice(0, limit).map((book) => {
      const card = toBookCard(book);
      return {
        ...card,
        description: excerpt(card.description, 400),
      };
    }),
  };
}

function excerpt(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

type ApiChapter = {
  id: string;
  title: string;
  number?: number;
  url: string;
  duration: number;
};

type ApiBookRole = {
  role_id: string;
  person_id: string;
};

type ApiBook = {
  id: string;
  title: string;
  description?: string | null;
  banner_url?: string | null;
  isPublished?: boolean;
  chapters?: ApiChapter[] | null;
  categories?: Category[] | null;
  roles?: ApiBookRole[] | null;
};

type ApiPerson = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
};

type ApiRole = {
  id: string;
  name: string;
};

export class CatalogClient {
  private readonly booksCache = new Map<string, CacheEntry<BookSummary[]>>();
  private readonly categoriesCache = new Map<string, CacheEntry<Category[]>>();

  constructor(
    private readonly apiBase = process.env.KNIZHNYVOZ_API_BASE ?? DEFAULT_API_BASE,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly now: () => number = () => Date.now(),
    private readonly token = process.env.AUTH_COOKIE ?? process.env.KNIZHNYVOZ_API_TOKEN,
  ) {}

  async listBooks(): Promise<BookSummary[]> {
    const cacheKey = this.accessToken() ? "books" : "books/published";
    return this.cached(this.booksCache, cacheKey, async () => {
      const [listed, people, roles] = await Promise.all([
        this.getJson<ApiBook[]>(cacheKey),
        this.getJson<ApiPerson[]>("people"),
        this.getJson<ApiRole[]>("roles"),
      ]);
      const detailed = listed.every(hasBookRelations)
        ? listed
        : await mapPool(listed, 8, (book) => this.getJson<ApiBook>(`books/${book.id}`));
      return detailed.map((book) => toSummary(book, people, roles));
    });
  }

  async listCategories(): Promise<Category[]> {
    return this.cached(this.categoriesCache, "categories", () => {
      return this.getJson<Category[]>("categories");
    });
  }

  async getBook(bookId: string): Promise<BookDetails> {
    const books = await this.listBooks();
    const book = books.find((item) => item.id === bookId);
    if (!book) {
      throw new Error(`Кніга ${bookId} не знойдзена`);
    }
    return {
      ...toBookCard(book),
      chapters: book.chapters.map((chapter, index) => ({
        index: index + 1,
        id: chapter.id,
        name: chapter.name,
        durationMs: chapter.duration,
        duration: formatDuration(chapter.duration),
        blocked: chapter.blocked,
        url: chapter.url,
      })),
    };
  }

  private accessToken(): string | undefined {
    const token = this.token?.trim();
    return token ? token : undefined;
  }

  private async getJson<T>(path: string): Promise<T> {
    const url = new URL(path, this.apiBase.endsWith("/") ? this.apiBase : `${this.apiBase}/`);
    const headers: Record<string, string> = { accept: "application/json" };
    const token = this.accessToken();
    if (token) {
      headers.cookie = token.includes("=") ? token : `auth_token=${token}`;
    }
    const response = await this.fetchImpl(url, { headers });
    if (!response.ok) {
      throw new Error(`Кніжны воз API ${path}: HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  }

  private async cached<T>(
    store: Map<string, CacheEntry<T>>,
    key: string,
    load: () => Promise<T>,
  ): Promise<T> {
    const existing = store.get(key);
    if (existing && existing.expiresAt > this.now()) {
      return existing.value;
    }
    const value = await load();
    store.set(key, { value, expiresAt: this.now() + CACHE_TTL_MS });
    return value;
  }
}

function hasBookRelations(book: ApiBook): boolean {
  return Array.isArray(book.categories) && Array.isArray(book.roles);
}

function toSummary(book: ApiBook, people: ApiPerson[], roles: ApiRole[]): BookSummary {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const rolesById = new Map(roles.map((role) => [role.id, role.name]));
  const grouped = new Map<string, string[]>();
  for (const link of book.roles ?? []) {
    const roleName = rolesById.get(link.role_id) ?? "Роля";
    const person = peopleById.get(link.person_id);
    const name = [person?.firstName, person?.lastName].filter(Boolean).join(" ").trim();
    const names = grouped.get(roleName) ?? [];
    names.push(name || link.person_id);
    grouped.set(roleName, names);
  }
  const resolvedRoles = [...grouped].map(([role, names]) => ({ role, names }));
  const chapters = [...(book.chapters ?? [])]
    .sort((left, right) => (left.number ?? 0) - (right.number ?? 0))
    .map((chapter) => ({
      id: chapter.id,
      name: chapter.title,
      duration: chapter.duration,
      url: chapter.url,
      blocked: false,
    }));
  return {
    id: book.id,
    imageUri: book.banner_url ?? "",
    name: book.title,
    author: resolvedRoles.find((role) => role.role === "Аўтар")?.names.join(", ") ?? "",
    description: book.description?.replaceAll("&nbsp;", " ").trim() ?? "",
    categories: book.categories ?? [],
    roles: resolvedRoles,
    totalDuration: chapters.reduce((sum, chapter) => sum + chapter.duration, 0),
    isPublished: book.isPublished !== false,
    chapters,
  };
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  mapItem: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapItem(items[index]!);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}
