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

/**
 * Finds a cover id for a book, or null if there isn't one.
 *
 * Null is a real answer rather than a failure: plenty of books have no cover
 * on Open Library, and recording that stops us asking again every time the
 * page loads. A lookup that fails for any other reason — offline, a bad
 * response — throws, so the caller can leave the book unresolved and try again
 * later rather than recording "no cover" for a book that has one.
 */
export async function findCoverId(title: string, author?: string): Promise<string | null> {
  const params = new URLSearchParams({
    title,
    limit: "1",
    // Only the one field is needed; asking for the whole record would pull
    // down a few hundred kilobytes per book for no reason.
    fields: "cover_i",
  });
  if (author?.trim()) params.set("author", author.trim());

  const res = await fetch(`${SEARCH}?${params.toString()}`);
  if (!res.ok) throw new Error(`Open Library returned ${res.status}`);
  const data: unknown = await res.json();
  const docs = (data as { docs?: { cover_i?: number }[] })?.docs;
  const id = docs?.[0]?.cover_i;
  return typeof id === "number" && id > 0 ? String(id) : null;
}
