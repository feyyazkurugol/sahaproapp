export const SUPPORTED_LANGS = ["tr", "en"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

export const DEFAULT_LANG: Lang = "tr";

export function normalizeLang(v: unknown): Lang {
  const s = String(v ?? "").trim().toLowerCase();
  return (SUPPORTED_LANGS as readonly string[]).includes(s) ? (s as Lang) : DEFAULT_LANG;
}
