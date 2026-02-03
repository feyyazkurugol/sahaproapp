"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDefaultRouteForRole } from "@/lib/routing";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const s = getSession();
    if (s) {
      router.replace(getDefaultRouteForRole(s.role));
    }
  }, [router]);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>SahaPro</h1>
      <p style={{ marginTop: 8 }}>Hoş geldin. Devam etmek için giriş yap.</p>

      <div style={{ marginTop: 16 }}>
        <Link
          href="/login"
          style={{
            display: "inline-block",
            padding: "10px 14px",
            borderRadius: 8,
            background: "#000",
            color: "#fff",
            textDecoration: "none",
          }}
        >
          Giriş Yap
        </Link>
      </div>
    </div>
  );
}
