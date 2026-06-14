// URL-safe slug from a free-text title/topic: lowercase, non-alphanumerics → "-",
// collapsed and trimmed. Empty input falls back to "untitled" so a URL segment is
// never blank. Used for both the note page slug and the topic segment.
export function slugify(input: string): string {
  const s = (input ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (ä→a, é→e, …)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "untitled";
}

// Publisher handle rules: 3–32 chars, lowercase letters/digits/hyphens, must start
// and end with an alphanumeric. A small reserved set is rejected so a handle can't
// shadow a meaningful path segment now or later.
const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
const RESERVED_HANDLES = new Set(["api", "admin", "note", "notes", "www", "app"]);

export function isValidHandle(handle: string): boolean {
  return HANDLE_RE.test(handle) && !RESERVED_HANDLES.has(handle);
}
