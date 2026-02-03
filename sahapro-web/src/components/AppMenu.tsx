"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, readSession, type Session } from "@/lib/sessions";
import { getNavItemsForRole } from "@/lib/navigation";
import { useT } from "@/lib/i18n/useT";

type NavItem = { href: string; labelKey: string };

export default function AppMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useT();
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!mounted) return;
    setSession(readSession());
  }, [mounted, pathname]);

  // başka tab’da logout olursa menü de düşsün
  useEffect(() => {
    if (!mounted) return;
    const onStorage = () => setSession(readSession());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [mounted]);

  const role = useMemo(() => {
    return (session?.role ?? "").trim().toLowerCase();
  }, [session]);

  const items = useMemo(() => {
    if (!session) return [];

    const raw = (getNavItemsForRole(session.role) ?? []) as NavItem[];

    // ✅ UI safety belt: role'a göre kritik menüleri filtrele
    // İşlerim (/jobs) => sadece tech
    // Dispatch (/dispatch) => sadece owner/dispatcher
    return raw.filter((it) => {
      const href = (it.href ?? "").toLowerCase();

      const isJobs = href === "/jobs" || href.startsWith("/jobs/");
      const isDispatch = href === "/dispatch" || href.startsWith("/dispatch/");
      const isOwnerUsers = href === "/owner/users" || href.startsWith("/owner/users/");

      if (isJobs) return role === "tech";
      if (isDispatch) return role === "owner" || role === "dispatcher";
      if (isOwnerUsers) return role === "owner"; // ✅ Users sadece owner

      return true;
    });
  }, [session, role]);

  function logout() {
    clearSession();
    setSession(null);

    const next = encodeURIComponent(pathname || "/");
    router.replace(`/login?next=${next}`);

    onNavigate?.();
  }

  if (!mounted) return null;
  if (!session) return null;

  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => onNavigate?.()}
            className={[
              "block px-3 py-2 rounded text-sm",
              active ? "bg-black text-white" : "hover:bg-gray-100",
            ].join(" ")}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}

      <div className="pt-3 mt-3 border-t">
        <button
          type="button"
          onClick={logout}
          className="w-full text-left px-3 py-2 text-sm rounded hover:bg-red-50 text-red-600"
        >
          {t("auth.logout")}
        </button>
      </div>
    </nav>
  );
}
