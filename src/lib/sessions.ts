// src/lib/sessions.ts
export type UserRole = "owner" | "sales" | "dispatcher" | "tech";

export type Session = {
  token: string;
  tenantId: string;
  userId: string; // canonical
  role: UserRole;
  fullName?: string;
};

const KEYS = {
  token: "token",
  tenantId: "tenantId",
  userId: "userId",
  techUserId: "techUserId", // legacy alias
  role: "role",
  fullName: "fullName",
} as const;

// -------------------------
// safe localStorage access
// -------------------------
function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function lsGet(key: string): string | null {
  if (!canUseStorage()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

function lsRemove(key: string) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

// -------------------------
// normalizers
// -------------------------
function normalizeToken(v: string | null) {
  return (v ?? "").replace(/\s+/g, "");
}

function normalizeRole(v: string | null): UserRole | null {
  const r = (v ?? "").trim().toLowerCase();
  if (r === "owner" || r === "sales" || r === "dispatcher" || r === "tech") return r;
  return null;
}

function normalizeId(v: string | null) {
  return (v ?? "").trim();
}

// -------------------------
// API
// -------------------------
export function readSession(): Session | null {
  const token = normalizeToken(lsGet(KEYS.token));
  const tenantId = normalizeId(lsGet(KEYS.tenantId));
  const role = normalizeRole(lsGet(KEYS.role));

  const fullNameRaw = normalizeId(lsGet(KEYS.fullName));
  const fullName = fullNameRaw ? fullNameRaw : undefined;

  // legacy destek: userId yoksa techUserId’den oku
  const userId = normalizeId(lsGet(KEYS.userId)) || normalizeId(lsGet(KEYS.techUserId));

  if (!token || !tenantId || !userId || !role) return null;

  return { token, tenantId, userId, role, fullName };
}

export function clearSession() {
  lsRemove(KEYS.token);
  lsRemove(KEYS.tenantId);
  lsRemove(KEYS.userId);
  lsRemove(KEYS.role);
  lsRemove(KEYS.fullName);

  // legacy alias
  lsRemove(KEYS.techUserId);
}

export function writeSession(s: Session) {
  // minimum guard: boş session yazma (stale değer bırakma riskini azaltır)
  const token = normalizeToken(s?.token ?? "");
  const tenantId = normalizeId(s?.tenantId ?? "");
  const userId = normalizeId(s?.userId ?? "");
  const role = normalizeRole(String(s?.role ?? "")) as UserRole | null;

  if (!token || !tenantId || !userId || !role) {
    // bozuk veri gelirse en güvenlisi temizlemek
    clearSession();
    throw new Error("session_invalid");
  }

  lsSet(KEYS.token, token);
  lsSet(KEYS.tenantId, tenantId);
  lsSet(KEYS.userId, userId);

  // legacy alias’ı da doldur
  lsSet(KEYS.techUserId, userId);

  lsSet(KEYS.role, role);

  const name = (s.fullName ?? "").trim();
  if (name) lsSet(KEYS.fullName, name);
  else lsRemove(KEYS.fullName);
}
