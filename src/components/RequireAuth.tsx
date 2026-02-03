"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { readSession } from "@/lib/sessions";
import { canAccessRoute, getDefaultRouteForRole } from "@/lib/routing";

type Props = {
  children: React.ReactNode;
};

export default function RequireAuth({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // aynı redirect'i üst üste tetiklemeyelim
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (!mounted) return;
    if (redirectedRef.current) return;

    // 1) ilk okuma
    let s = readSession();

    // 2) İlk okumada null gelirse: 1 kez micro-delay ile tekrar dene
    // (login sonrası localStorage yazıldı ama hydration/tick yüzünden anlık kaçabiliyor)
    if (!s) {
      const t = window.setTimeout(() => {
        if (redirectedRef.current) return;

        const s2 = readSession();
        if (!s2) {
          redirectedRef.current = true;
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }

        // role kontrol
        if (!canAccessRoute(s2.role, pathname)) {
          redirectedRef.current = true;
          router.replace(getDefaultRouteForRole(s2.role));
        }
      }, 0);

      return () => window.clearTimeout(t);
    }

    // role kontrol (ilk okumada session varsa)
    if (!canAccessRoute(s.role, pathname)) {
      redirectedRef.current = true;
      router.replace(getDefaultRouteForRole(s.role));
      return;
    }
  }, [mounted, pathname, router]);

  // mounted olmadan render etmeyelim (hydration uyumsuzluğu + guard yarışını azaltır)
  if (!mounted) return null;

  return <>{children}</>;
}
