export function toSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(new RegExp("[^a-z0-9]+", "g"), "-")
    .replace(new RegExp("^-+|-+$", "g"), "")
    .replace(new RegExp("--+", "g"), "-");
}

export function nowIso(): string {
  return new Date().toISOString();
}
