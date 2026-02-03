"use client";

import tr from "./locales/tr.json";
import en from "./locales/en.json";
import { useLang } from "./LangProvider";

type Dict = Record<string, any>;
const dicts: Record<string, Dict> = { tr, en };

function get(obj: Dict, path: string) {
  const parts = path.split(".");
  let cur: any = obj;

  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) cur = cur[p];
    else return undefined;
  }
  return cur;
}

export function useT() {
  const { lang } = useLang();

  function t(key: string) {
    const d = dicts[lang] ?? dicts.tr;
    const v = get(d, key);
    return typeof v === "string" ? v : key; // fallback
  }

  return { t, lang };
}
