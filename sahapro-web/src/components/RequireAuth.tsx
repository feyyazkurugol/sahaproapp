"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { readSession } from "@/lib/sessions";
import { canAccessRoute, getDefaultRouteForRole } from "@/lib/routing";
import type { UserRole } from "@/lib/sessions";

type Props = {
  children: React.ReactNode;
};

export default function RequireAuth({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  // ✅ auth check bitmeden UI render etmeyelim
  const [ok, setOk] = useState(false);

  useEffect(() => {
    // login sayfası guard dışı
    if (pathname?.startsWith("/login")) {
      setOk(true);
      return;
    }

    const s = readSession();

    if (!s) {
      setOk(false);
      router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
      return;
    }

    const role = s.role as UserRole;

    // yetkisi yoksa default route'a
    if (!canAccessRoute(role, pathname || "/")) {
      setOk(false);
      router.replace(getDefaultRouteForRole(role));
      return;
    }

    setOk(true);
  }, [pathname, router]);

  if (!ok) return null;

  return <>{children}</>;
}
