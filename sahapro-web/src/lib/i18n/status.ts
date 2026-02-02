import type { Lang } from "./index";
import tr from "./locales/tr.json";
import en from "./locales/en.json";

type Dict = Record<string, any>;
const DICTS: Record<Lang, Dict> = { tr, en };

function getByPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, k) => (acc && acc[k] != null ? acc[k] : undefined), obj);
}

export function statusLabel(lang: Lang, status?: string | null) {
  const s = String(status ?? "").trim().toLowerCase();
  const key = `status.${s}`;
  const v = getByPath(DICTS[lang], key);
  return typeof v === "string" ? v : (status ?? "-");
}
