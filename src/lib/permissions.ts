// src/lib/permissions.ts
import type { Role } from "@/lib/auth";

export type Action =
  | "workorder.view"
  | "workorder.start"
  | "workorder.complete"
  | "workorder.cancel"
  | "payment.add"
  | "photo.upload"
  | "photo.delete"
  | "dispatch.assign"
  | "admin.access"
  | "leads.access";

/**
 * Ürün mantığı: role -> aksiyon yetkisi
 * Dispatcher şimdilik opsiyonel; owner gibi bazı aksiyonları yapabilir.
 */
export function can(role: Role, action: Action): boolean {
  // owner her şeyi yapar
  if (role === "owner") return true;

  // dispatcher (ileride ekip lideri / operasyon)
  if (role === "dispatcher") {
    const allowed: Action[] = [
      "workorder.view",
      "workorder.start",
      "workorder.complete",
      "workorder.cancel",
      "payment.add",
      "photo.upload",
      "photo.delete",
      "dispatch.assign",
    ];
    return allowed.includes(action);
  }

  // tech
if (role === "tech") {
  const allowed: Action[] = [
    "workorder.view",
    "workorder.start",
    "workorder.complete",
    "payment.add",     // ✅ TECH tahsilat girebilir
    "photo.upload",
    "photo.delete",
  ];
  return allowed.includes(action);
}


  // sales
  if (role === "sales") {
    const allowed: Action[] = ["leads.access"];
    return allowed.includes(action);
  }

  return false;
}

/**
 * UI için sugar:
 */
export function canCancel(role: Role) {
  return can(role, "workorder.cancel");
}
