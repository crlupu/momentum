/**
 * Book covers from Open Library.
 *
 * Chosen because it needs no API key, which matters for an app served as a
 * static site: there is nowhere to keep a secret. The image itself is fetched
 * by the browser as an ordinary <img>, so nothing here has to deal with CORS.
 *
 * Open Library ask that their cover API is not crawled, and rate-limit lookups
 * by anything other than a cover id. So a book is looked up once, when it is
 * first seen without a cover, and the id that comes back is stored on the book
 * — after which every device renders the cover straight from that id and never
 * asks again.
 */

const SEARCH = "https://openlibrary.org/search.json";

/** Size suffixes Open Library serves: small, medium, large. */
export type CoverSize = "S" | "M" | "L";

/** The image URL for a stored cover id. */
export function coverUrl(coverId: string, size: CoverSize = "M"): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

/** What one lookup can tell us about a book. */
export type BookLookup = {
  /** The cover id, or null when Open Library has no cover for it. */
  coverId: string | null;
  /** The author as Open Library has it, if it named one. */
  author?: string;
  /** Median page count across editions, where Open Library has one. */
  pages?: number;
};

/**
 * Looks a book up by title, and by author too when one is already known.
 *
 * The cover being null is a real answer rather than a failure: plenty of books
 * have no cover, and recording that stops us asking again on every load. A
 * lookup that fails for any other reason — offline, a bad response — throws,
 * so the caller can leave the book unresolved and try again later rather than
 * recording "no cover" for a book that has one.
 */
export async function lookupBook(title: string, author?: string): Promise<BookLookup> {
  const params = new URLSearchParams({
    title,
    limit: "1",
    // Only the fields used; asking for the whole record would pull down a few
    // hundred kilobytes per book for no reason.
    fields: "cover_i,author_name,number_of_pages_median",
  });
  const lead = leadAuthor(author);
  if (lead) params.set("author", lead);

  const res = await fetch(`${SEARCH}?${params.toString()}`);
  if (!res.ok) throw new Error(`Open Library returned ${res.status}`);
  const data: unknown = await res.json();
  const doc = (
    data as {
      docs?: { cover_i?: number; author_name?: string[]; number_of_pages_median?: number }[];
    }
  )?.docs?.[0];

  const id = doc?.cover_i;
  // Several authors are possible; the first is the one the book is filed
  // under, and a card has room for one name.
  const name = doc?.author_name?.[0]?.trim();

  const pages = doc?.number_of_pages_median;

  return {
    coverId: typeof id === "number" && id > 0 ? String(id) : null,
    ...(name ? { author: name } : {}),
    ...(typeof pages === "number" && pages > 0 ? { pages: Math.round(pages) } : {}),
  };
}

/**
 * The first author named, which is what Open Library files a book under.
 * "Neal Ford, Mark Richards & Zhamak Dehghani", "Gwen Shapira et al." and
 * "Massimo Pigliucci (eds.)" all search better as the first name alone:
 * the whole string matches nothing.
 */
function leadAuthor(author?: string): string | undefined {
  const first = author
    ?.replace(/\(eds?\.?\)/gi, "")
    .split(/,|&|\band\b|\bet al\.?/i)[0]
    .trim();
  return first || undefined;
}

/** One candidate from a title search, as shown in the suggestion list. */
export type BookSuggestion = {
  /** Open Library's work key, unique enough to key a list on. */
  key: string;
  title: string;
  author?: string;
  coverId?: string;
  year?: number;
  /** Median page count across editions, where Open Library has one. */
  pages?: number;
};

/**
 * Searches by title for the suggestion list.
 *
 * Takes an abort signal because this runs while typing: without it a slow
 * response to "har" could arrive after the response to "harry potter" and
 * replace a good list with a stale one.
 *
 * Editions vary in length, so the median page count is what is offered rather
 * than any one edition's — it is a starting figure to be corrected, not a
 * fact about the copy on the shelf.
 */
export async function searchBooks(
  query: string,
  signal?: AbortSignal,
  limit = 6
): Promise<BookSuggestion[]> {
  const params = new URLSearchParams({
    title: query,
    limit: String(limit),
    fields: "key,title,author_name,cover_i,first_publish_year,number_of_pages_median",
  });

  const res = await fetch(`${SEARCH}?${params.toString()}`, { signal });
  if (!res.ok) throw new Error(`Open Library returned ${res.status}`);
  const data: unknown = await res.json();
  const docs =
    (
      data as {
        docs?: {
          key?: string;
          title?: string;
          author_name?: string[];
          cover_i?: number;
          first_publish_year?: number;
          number_of_pages_median?: number;
        }[];
      }
    )?.docs ?? [];

  return docs
    .filter((d) => d.title)
    .map((d, i) => ({
      key: d.key ?? `${d.title}-${i}`,
      title: d.title as string,
      author: d.author_name?.[0]?.trim() || undefined,
      coverId: typeof d.cover_i === "number" && d.cover_i > 0 ? String(d.cover_i) : undefined,
      year: typeof d.first_publish_year === "number" ? d.first_publish_year : undefined,
      pages:
        typeof d.number_of_pages_median === "number" && d.number_of_pages_median > 0
          ? d.number_of_pages_median
          : undefined,
    }));
}
