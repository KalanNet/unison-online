// app/lib/seo.ts
export const SEO = {
  TITLE_MAX: 60,      // «золотий» діапазон для title (~50–60)
  DESC_MAX: 160,      // мета-опис ~150–160
  SLUG_MAX: 60,       // короткі читабельні URL, ≤60
  LABEL_MAX: 10,      // як ти просив
};

export function slugify(input: string): string {
  const base = (input || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "";
}

export function normalizeSlugInput(s: string): string {
  return slugify(s).slice(0, SEO.SLUG_MAX);
}

export type MetaFields = { title: string; description: string; slug: string };
export type MetaErrors = Partial<Record<keyof MetaFields | "label" | "image", string>>;

export function validateMeta({ title, description, slug }: MetaFields): MetaErrors {
  const errors: MetaErrors = {};
  if (!title.trim()) errors.title = "Title is required";
  if (title.length > SEO.TITLE_MAX) errors.title = `Max ${SEO.TITLE_MAX} characters`;
  if (description.length > SEO.DESC_MAX) errors.description = `Max ${SEO.DESC_MAX} characters`;
  if (!slug) errors.slug = "Slug is required";
  if (slug.length > SEO.SLUG_MAX) errors.slug = `Max ${SEO.SLUG_MAX} characters`;
  if (!/^[a-z0-9-]+$/.test(slug)) errors.slug = "Only lowercase letters, numbers, hyphens";
  return errors;
}
