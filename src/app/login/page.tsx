"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { login } from "@/lib/api";
import { resolvePostLoginRoute } from "@/lib/routing";
import {
  clearSession,
  writeSession,
  readSession,
  type Session,
  type UserRole,
} from "@/lib/sessions";

function normalizeRole(v: unknown): UserRole {
  const r = String(v ?? "").trim().toLowerCase();
  if (r === "owner" || r === "sales" || r === "dispatcher" || r === "tech") return r;
  throw new Error("invalid_role");
}

function extractErrorMessage(err: any): string {
  const body = typeof err?.body === "string" ? err.body.trim() : "";
  if (body) return body;

  const msg = typeof err?.message === "string" ? err.message.trim() : "";
  if (msg) return msg;

  const st = typeof err?.statusText === "string" ? err.statusText.trim() : "";
  if (st) return st;

  return "login_failed";
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // ✅ eski session temizle
      clearSession();

      const res = await login(email, password);

      const session: Session = {
        token: res.token,
        tenantId: res.tenantId,
        userId: res.userId,
        role: normalizeRole(res.role),
        fullName: res.fullName,
      };

      // ✅ yaz
      writeSession(session);

      // ✅ aynı tabda storage listener'ların fark etmesi için tetikle
      // (normalde storage olayı sadece diğer tablarda tetiklenir)
      try {
        window.dispatchEvent(new Event("storage"));
      } catch {}

      // ✅ doğrula: storage yazılamıyorsa burası patlayacak ve net hata göreceksin
      const check = readSession();
      if (!check) {
        throw new Error(
          "session_not_persisted (localStorage blocked? browser privacy / extension / incognito?)"
        );
      }

      const target = resolvePostLoginRoute(check.role, next);
      router.replace(target);
      router.refresh();
    } catch (err: any) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Giriş</h1>

        <input
          type="email"
          placeholder="E-posta"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border px-3 py-2 rounded"
          required
          autoComplete="email"
        />

        <input
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border px-3 py-2 rounded"
          required
          autoComplete="current-password"
        />

        {error && <div className="text-red-600 text-sm">{error}</div>}

        <button type="submit" disabled={loading} className="w-full bg-black text-white py-2 rounded">
          {loading ? "Giriş yapılıyor…" : "Giriş yap"}
        </button>
      </form>
    </div>
  );
}
