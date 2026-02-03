"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AppMenu from "@/components/AppMenu";
import { readSession, clearSession, type Session } from "@/lib/sessions";
import { getDefaultRouteForRole } from "@/lib/routing";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  // ✅ hydration fix
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ✅ session state (client only)
  const [session, setSession] = useState<Session | null>(null);

  // ✅ portal root
  const [drawerRoot, setDrawerRoot] = useState<HTMLElement | null>(null);

  // route change -> session güncelle
  useEffect(() => {
    if (!mounted) return;
    setSession(readSession());
  }, [mounted, pathname]);

  // başka tab’da logout/login olursa senkronla
  useEffect(() => {
    if (!mounted) return;
    const onStorage = () => setSession(readSession());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [mounted]);

  // ✅ next = pathname + query
  const nextPath = useMemo(() => {
    const qs = searchParams?.toString?.() ? `?${searchParams.toString()}` : "";
    return `${pathname}${qs}`;
  }, [pathname, searchParams]);

  // ✅ Auth guard (KRİTİK FIX: state null olsa bile storage’dan son kez bak)
  useEffect(() => {
    if (!mounted) return;
    if (pathname.startsWith("/login")) return;

    // state bazen 1 tick geriden geliyor → storage’dan son kontrol
    const s = session ?? readSession();

    // storage’da varsa state’i toparla, redirect yapma
    if (!session && s) setSession(s);

    if (!s) {
      router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
    }
  }, [mounted, pathname, router, session, nextPath]);

  // "/" redirect (aynı mantık)
  useEffect(() => {
    if (!mounted) return;

    const s = session ?? readSession();
    if (!session && s) setSession(s);

    if (s && pathname === "/") {
      router.replace(getDefaultRouteForRole(s.role));
    }
  }, [mounted, pathname, router, session]);

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
    return () => {};
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
    const next = encodeURIComponent(nextPath || "/");
    const qs = reason ? `&reason=${encodeURIComponent(reason)}` : "";
    router.replace(`/login?next=${next}${qs}`);
  };

  if (pathname.startsWith("/login")) return <>{children}</>;

  const userLabel = useMemo(() => {
    if (!mounted) return "";
    const s = session ?? readSession();
    return s?.fullName ?? s?.role ?? "";
  }, [mounted, session]);

  const mobileDrawer =
    mounted && mobileOpen && drawerRoot
      ? createPortal(
          <div style={{ position: "fixed", inset: 0, zIndex: 999999 }} className="md:hidden">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              style={{ position: "absolute", inset: 0 }}
              className="bg-black/40"
            />

            <div
              style={{ position: "absolute", left: 0, top: 0, height: "100%", width: 288 }}
              className="bg-white shadow-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold">Menü</div>
                <button
                  type="button"
                  className="border rounded px-3 py-1 text-sm"
                  onClick={() => setMobileOpen(false)}
                >
                  Kapat
                </button>
              </div>

              <AppMenu onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>,
          drawerRoot
        )
      : null;

  return (
    <div key={pathname} className="min-h-screen bg-white">
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
              aria-label="Menu"
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
