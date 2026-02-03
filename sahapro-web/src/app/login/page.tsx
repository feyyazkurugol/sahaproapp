"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { login } from "@/lib/api";
import { resolvePostLoginRoute } from "@/lib/routing";
import { clearSession, writeSession, type Session, type UserRole } from "@/lib/sessions";

function normalizeRole(v: unknown): UserRole {
  const r = String(v ?? "").trim().toLowerCase();
  if (r === "owner" || r === "sales" || r === "dispatcher" || r === "tech") return r;
  throw new Error("invalid_role");
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
      // ✅ login öncesi olası eski session çakışmalarını temizle
      clearSession();

      const res = await login(email, password);
      // res: { token, tenantId, userId, role, fullName? }

      const session: Session = {
        token: res.token,
        tenantId: res.tenantId,
        userId: res.userId,
        role: normalizeRole(res.role),
        fullName: res.fullName,
      };

      writeSession(session);

      const target = resolvePostLoginRoute(session.role, next);
      router.replace(target);
    } catch (err: any) {
      setError(err?.message ?? "login_failed");
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
