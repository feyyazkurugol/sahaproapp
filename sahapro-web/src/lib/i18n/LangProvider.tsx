"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

type Lang = "tr" | "en";

type I18nCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
};

const Ctx = createContext<I18nCtx | null>(null);

export function LangProvider({
  children,
  defaultLang = "tr",
}: {
  children: React.ReactNode;
  defaultLang?: Lang;
}) {
  const [lang, setLang] = useState<Lang>(defaultLang);

  const value = useMemo(() => ({ lang, setLang }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ✅ senin mevcut hook’un buysa:
export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within LangProvider");
  return ctx;
}

// ✅ ALIAS: useT.ts bunu istiyor
export const useLang = useI18n;
