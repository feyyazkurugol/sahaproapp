// src/lib/auth.ts
// ⚠️ Backward-compat layer
// Eski import'ları kırmamak için burada duruyor.
// Yeni gerçek kaynak: src/lib/sessions.ts

import {
  readSession,
  writeSession,
  clearSession as clearSessionCore,
  type Session as CoreSession,
  type UserRole as Role,
} from "@/lib/sessions";

export const TOKEN_KEY = "token";
export const TENANT_ID_KEY = "tenantId";
export const USER_ID_KEY = "userId";
export const TECH_USER_ID_KEY = "techUserId";
export const ROLE_KEY = "role";
export const FULL_NAME_KEY = "fullName";

// Tipler: auth.ts -> sessions.ts ile birebir
export type Session = CoreSession;
export type { Role };

// -------------------------
// Legacy localStorage helpers
// -------------------------

function lsGet(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

function lsRemove(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

// -------------------------
// Backward compatible getters (✅ önce sessions, sonra legacy)
// -------------------------

export function getToken() {
  const s = readSession();
  const tokenFromSession = (s?.token ?? "").trim();
  if (tokenFromSession) return tokenFromSession;

  const v = lsGet(TOKEN_KEY);
  const t = v ? v.replace(/\s+/g, "") : "";
  return t || null;
}

export function getTenantId() {
  const s = readSession();
  const tid = (s?.tenantId ?? "").trim();
  if (tid) return tid;

  return lsGet(TENANT_ID_KEY);
}

export function getUserId() {
  const s = readSession();
  const uid = (s?.userId ?? "").trim();
  if (uid) return uid;

  return lsGet(USER_ID_KEY);
}

// ✅ geriye dönük alias
export function getTechUserId() {
  return getUserId();
}

export function getRole(): Role | null {
  const s = readSession();
  return s?.role ?? null;
}

export function getFullName() {
  const s = readSession();
  return s?.fullName ?? null;
}

export function getSession(): Session | null {
  return readSession();
}

// -------------------------
// Backward compatible setter (✅ sessions + legacy sync)
// -------------------------

function normalizeRole(v: unknown): Role | null {
  const r = String(v ?? "").trim().toLowerCase();
  if (r === "owner" || r === "sales" || r === "dispatcher" || r === "tech") return r as Role;
  return null;
}

export function setSession(s: {
  token: string;
  tenantId: string;
  userId: string;
  role?: Role | string;
  fullName?: string;
}) {
  const role = normalizeRole(s.role);
  if (!role) throw new Error("role_required");

  // ✅ asıl kaynak
  writeSession({
    token: s.token,
    tenantId: s.tenantId,
    userId: s.userId,
    role,
    fullName: s.fullName,
  });

  // ✅ legacy key’leri de yaz (fetchJson vs eski kodlar bozulmasın)
  lsSet(TOKEN_KEY, s.token);
  lsSet(TENANT_ID_KEY, s.tenantId);
  lsSet(USER_ID_KEY, s.userId);
  lsSet(ROLE_KEY, role);
  if (s.fullName) lsSet(FULL_NAME_KEY, s.fullName);
}

export function clearSession() {
  clearSessionCore();

  // ✅ legacy temizle
  lsRemove(TOKEN_KEY);
  lsRemove(TENANT_ID_KEY);
  lsRemove(USER_ID_KEY);
  lsRemove(TECH_USER_ID_KEY);
  lsRemove(ROLE_KEY);
  lsRemove(FULL_NAME_KEY);
}

// -------------------------
// RBAC helpers (ürün mantığı)
// -------------------------

export function hasAnyRole(...roles: Role[]) {
  const r = getRole();
  return r ? roles.includes(r) : false;
}

export function requireAnyRole(...roles: Role[]) {
  const s = getSession();
  if (!s) return { ok: false as const, reason: "session_required" };

  if (!roles.includes(s.role)) return { ok: false as const, reason: "forbidden" };
  return { ok: true as const, session: s };
}

// UI helpers
export const isOwner = () => getRole() === "owner";
export const isSales = () => getRole() === "sales";
export const isDispatcher = () => getRole() === "dispatcher";
export const isTech = () => getRole() === "tech";
