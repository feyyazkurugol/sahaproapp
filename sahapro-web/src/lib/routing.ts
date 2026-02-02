// src/lib/routing.ts
import type { UserRole as Role } from "@/lib/sessions";

/**
 * Güvenlik: next parametresini sadece "site içi path" olarak kabul et.
 * - "/jobs/123?x=1" ✅
 * - "https://evil.com" ❌
 * - "//evil.com" ❌
 * - "jobs" ❌
 */
export function sanitizeNext(next?: string | null): string | null {
  if (!next) return null;

  const trimmed = String(next).trim();
  if (!trimmed) return null;

  // Mutlaka "/" ile başlamalı
  if (!trimmed.startsWith("/")) return null;

  // "//" ile başlayanlar (scheme-relative) yasak
  if (trimmed.startsWith("//")) return null;

  // backslash yasak (bazı edge-case redirect bypass)
  if (trimmed.includes("\\")) return null;

  return trimmed;
}

/**
 * Ürün kararı: Role -> varsayılan landing
 *
 * ✅ Senaryo:
 * - owner/dispatcher: işi dağıtır -> /dispatch
 * - tech: kendi işleri -> /jobs
 * - sales: lead -> /leads
 * - admin: admin panel -> /admin
 */
export function getDefaultRouteForRole(role: Role): string {
  switch (role) {
    case "owner":
    case "dispatcher":
      return "/dispatch";
    case "sales":
      return "/leads";
    case "admin":
      return "/admin";
    case "tech":
    default:
      return "/jobs";
  }
}

/**
 * Ürün kararı: Hangi role hangi route'lara girebilir
 * (ileride genişletmesi kolay olsun diye merkezi)
 */
export function canAccessRoute(role: Role, path: string): boolean {
  if (!path.startsWith("/")) return false;

  // normalize (query kırp)
  const p = path.split("?")[0];

  const rules: Record<Role, string[]> = {
    // ✅ owner her yere girebilir ama /jobs tech-only olacağı için buradan çıkardık
    // owner iş detayına ihtiyaç duyarsa ileride /dispatch/jobs/[id] gibi ayrı bir ekran açarız.
    owner: ["/admin", "/dispatch", "/leads"],

    // ✅ admin şimdilik sadece admin panel (en güvenlisi)
    admin: ["/admin"],

    // ✅ dispatcher sadece dispatch
    dispatcher: ["/dispatch"],

    // ✅ sales sadece leads
    sales: ["/leads"],

    // ✅ tech sadece jobs
    tech: ["/jobs"],
  };

  return rules[role]?.some((base) => p === base || p.startsWith(base + "/"));
}

/**
 * Login sonrası nihai redirect karar noktası
 */
export function resolvePostLoginRoute(role: Role, next?: string | null): string {
  const safeNext = sanitizeNext(next);
  if (safeNext && canAccessRoute(role, safeNext)) return safeNext;
  return getDefaultRouteForRole(role);
}
