// src/app/403/page.tsx
"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getRole, getFullName, clearSession } from "@/lib/auth";

export default function ForbiddenPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextUrl = useMemo(() => sp.get("next") || "/jobs", [sp]);
  const role = getRole();
  const name = getFullName();

  function goBack() {
    router.replace(nextUrl);
  }

  function logout() {
    clearSession();
    router.replace(`/login?next=${encodeURIComponent(nextUrl)}`);
  }

  return (
    <div style={{ maxWidth: 520, margin: "60px auto", padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>403 • Yetkisiz</h1>

      <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 14 }}>
        {name ? <div><b>{name}</b></div> : null}
        <div>
          Bu sayfayı görüntülemek için yetkin yok.
          {role ? (
            <>
              {" "}Mevcut rol: <code>{role}</code>
            </>
          ) : null}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={goBack}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Geri Dön
        </button>

        <button
          onClick={logout}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: "#fff",
            color: "#111",
            cursor: "pointer",
          }}
        >
          Çıkış Yap
        </button>
      </div>

      <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>
        Next: <code>{nextUrl}</code>
      </div>
    </div>
  );
}
