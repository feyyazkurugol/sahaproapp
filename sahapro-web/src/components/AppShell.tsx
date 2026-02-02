"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import AppMenu from "@/components/AppMenu";
import { readSession, clearSession, type Session } from "@/lib/sessions";
import { getDefaultRouteForRole } from "@/lib/routing";
import { useT } from "@/lib/i18n/useT";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // ✅ hydration fix
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ✅ session state (client only)
  const [session, setSession] = useState<Session | null>(null);

  // ✅ portal root (body altına eklenen gerçek root)
  const [drawerRoot, setDrawerRoot] = useState<HTMLElement | null>(null);

  // ilk mount + route change -> session güncelle
  useEffect(() => {
    setSession(readSession());
  }, [pathname]);

  // başka tab’da logout/login olursa senkronla
  useEffect(() => {
    const onStorage = () => setSession(readSession());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Auth guard
  useEffect(() => {
    if (!mounted) return;

    const s = readSession();
    if (!s && !pathname.startsWith("/login")) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [mounted, pathname, router]);

  // "/" redirect
  useEffect(() => {
    if (!mounted) return;

    const s = readSession();
    if (s && pathname === "/") {
      router.replace(getDefaultRouteForRole(s.role));
    }
  }, [mounted, pathname, router]);

  // route değişince drawer kapansın
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // ✅ portal root’u body’ye ekle
  useEffect(() => {
    if (!mounted) return;

    const id = "mobile-drawer-root";
    let el = document.getElementById(id) as HTMLElement | null;

    if (!el) {
      el = document.createElement("div");
      el.id = id;
      document.body.appendChild(el);
    }

    setDrawerRoot(el);

    return () => {
      // root'u kaldırmıyoruz (yeniden kullanılabilir)
    };
  }, [mounted]);

  // ✅ menü açıkken body scroll kilitle
  useEffect(() => {
    if (!mounted) return;

    const prev = document.body.style.overflow;
    if (mobileOpen) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted, mobileOpen]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const logout = (reason?: string) => {
    clearSession();
    setSession(null);
    const next = encodeURIComponent(pathname || "/");
    const qs = reason ? `&reason=${encodeURIComponent(reason)}` : "";
    router.replace(`/login?next=${next}${qs}`);
  };

  if (pathname.startsWith("/login")) return <>{children}</>;

  const userLabel = useMemo(() => {
    if (!mounted) return "";
    if (!session) return "";
    return session.fullName ?? session.role ?? "";
  }, [mounted, session]);

  // ✅ mobile drawer (inline fixed + portal)
  const mobileDrawer =
    mounted && mobileOpen && drawerRoot
      ? createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 999999,
            }}
            className="md:hidden"
          >
            <button
              type="button"
              aria-label={t("nav.close_menu")}
              onClick={() => setMobileOpen(false)}
              style={{
                position: "absolute",
                inset: 0,
              }}
              className="bg-black/40"
            />

            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                height: "100%",
                width: 288, // w-72
              }}
              className="bg-white shadow-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">{t("nav.menu")}</div>
                <button
                  type="button"
                  className="border rounded px-3 py-1 text-sm"
                  onClick={() => setMobileOpen(false)}
                >
                  {t("common.close")}
                </button>
              </div>

              <AppMenu onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>,
          drawerRoot
        )
      : null;

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="md:hidden border rounded px-3 py-2 text-sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMobileOpen((v) => !v);
              }}
              aria-label={t("nav.menu")}
            >
              ☰
            </button>

            <Link href="/" className="font-semibold">
              SahaPro
            </Link>
          </div>

          <div className="text-sm text-gray-600">{userLabel}</div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4">
        <div className="flex">
          {/* Desktop sidebar */}
          <aside className="hidden md:block w-60 border-r py-4 pr-4">
            {mounted ? (
              <AppMenu />
            ) : (
              <div className="space-y-2">
                <div className="h-8 rounded bg-gray-100" />
                <div className="h-8 rounded bg-gray-100" />
                <div className="h-8 rounded bg-gray-100" />
              </div>
            )}
          </aside>

          <main className="flex-1 py-6 md:pl-6">{children}</main>
        </div>
      </div>

      {mobileDrawer}
    </div>
  );
}
