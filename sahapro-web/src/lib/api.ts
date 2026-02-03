// src/lib/api.ts
import { fetchJson, u } from "./http";

export type WorkOrderListItem = {
  id: string;
  status: string;
  notes: string | null;
  scheduledStartAt: string | null;
  assignedAt: string | null;
  note: string | null;
  photoCount: number;
  paymentCount: number;
};

export type WorkOrderDetail = {
  workOrder: {
    id: string;
    status: string;
    notes: string | null;
    scheduledStartAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    startLat: number | null;
    startLng: number | null;
    endLat: number | null;
    endLng: number | null;

    cancelledAt?: string | null;
    cancelReason?: string | null;
    cancelNote?: string | null;
  };
  customer: {
    id: string;
    type: string;
    name: string;
    phone: string | null;
    notes: string | null;
  } | null;
  site: {
    id: string;
    title: string;
    addressText: string;
    city: string | null;
    countryCode: string | null;
  } | null;
  photos: Array<{
    id: string;
    kind: string;
    storageKey: string;
    takenAt: string;
    takenBy: string | null;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    currency: string;
    method: string;
    status: string;
    paidAt: string | null;
    createdBy: string | null;
  }>;
};

type StartBody = { tenantId: string; userId: string; lat?: number | null; lng?: number | null };
type CompleteBody = { tenantId: string; userId: string; lat?: number | null; lng?: number | null };

export type LoginResponse = {
  token: string;
  tenantId: string;
  userId: string;
  role: string;
  fullName?: string;
  full_name?: string;
  name?: string;

  // ✅ yeni: auth response genişledi
  forcePasswordChange?: boolean;
};

export async function login(identifier: string, password: string) {
  const url = u("/api/auth/login");

  const resp = await fetchJson<LoginResponse>(url, {
    method: "POST",
    noAuth: true,
    body: JSON.stringify({
      identifier: (identifier ?? "").trim(),
      password: password ?? "",
    }),
  });

  const fullName =
    (resp.fullName ?? (resp as any).full_name ?? (resp as any).name ?? undefined) || undefined;

  // ✅ NOT: session yazma işi LoginPage'inde (writeSession) yapılacak
  return { ...resp, fullName };
}

export async function getByTech(tenantId: string, techUserId: string) {
  const url = u(`/api/workorders/by-tech/${techUserId}?tenantId=${encodeURIComponent(tenantId)}`);
  return await fetchJson<WorkOrderListItem[]>(url);
}

export async function getWorkOrderDetail(workOrderId: string, tenantId: string) {
  const url = u(`/api/workorders/${workOrderId}/detail?tenantId=${encodeURIComponent(tenantId)}`);
  return await fetchJson<WorkOrderDetail>(url);
}

export async function startWorkOrder(workOrderId: string, body: StartBody) {
  const url = u(`/api/workorders/${workOrderId}/start`);
  return await fetchJson<any>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function completeWorkOrder(workOrderId: string, body: CompleteBody) {
  const url = u(`/api/workorders/${workOrderId}/complete`);
  return await fetchJson<any>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

type AddPaymentBody = {
  tenantId: string;
  userId: string;
  amount: number;
  currency?: string;
  method: "cash" | "transfer" | "pos_later";
};

export async function addPayment(workOrderId: string, body: AddPaymentBody) {
  const url = u(`/api/workorders/${workOrderId}/payments`);
  return await fetchJson<any>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

type UploadPhotoBody = {
  tenantId: string;
  userId: string;
  kind: "before" | "after" | "other";
  file: File;
};

export async function uploadWorkOrderPhoto(workOrderId: string, body: UploadPhotoBody) {
  const qs = new URLSearchParams({
    tenantId: body.tenantId,
    userId: body.userId,
    kind: body.kind,
  });

  const url = u(`/api/workorders/${workOrderId}/photos/upload?${qs.toString()}`);
  const fd = new FormData();
  fd.append("file", body.file);

  return await fetchJson<any>(url, { method: "POST", body: fd });
}

export async function deleteWorkOrderPhoto(
  workOrderId: string,
  tenantId: string,
  attachmentId: string
) {
  const url = u(
    `/api/workorders/${workOrderId}/photos/${attachmentId}?tenantId=${encodeURIComponent(tenantId)}`
  );
  return await fetchJson<any>(url, { method: "DELETE" });
}

type CancelBody = {
  tenantId: string;
  userId: string;
  reason: string;
  note?: string;
  lat?: number | null;
  lng?: number | null;
};

export async function cancelWorkOrder(workOrderId: string, body: CancelBody) {
  const url = u(`/api/workorders/${workOrderId}/cancel`);
  return await fetchJson<any>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// -------------------------
// ✅ Dispatch helpers
// -------------------------

export type TechUserListItem = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null; // ✅ email opsiyonel oldu
  role: string;
  status: string | null;
};

export async function getTechUsers(q?: string) {
  const term = (q ?? "").trim();
  const qs = new URLSearchParams();
  if (term) qs.set("q", term);

  const url = u(`/api/users/techs${qs.toString() ? `?${qs.toString()}` : ""}`);
  return await fetchJson<TechUserListItem[]>(url);
}

export async function assignWorkOrderToUser(workOrderId: string, techUserId: string, note?: string) {
  const url = u(`/api/workorders/${workOrderId}/assign-user`);
  return await fetchJson<any>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      techUserId,
      note: note?.trim() ? note.trim() : null,
    }),
  });
}

// ✅ Dispatch tenant-wide list row
export type DispatchWorkOrderRow = {
  id: string;
  status: string;
  notes: string | null;
  scheduledStartAt: string | null;

  customerId: string | null;
  customerName: string | null;

  siteId: string | null;
  siteTitle: string | null;
  addressText: string | null;

  assignedToUserId: string | null;

  assignedAt: string | null;
  dispatchNote: string | null;

  cancelledAt: string | null;
  cancelReason: string | null;
};

export async function listWorkOrders(
  status?: string,
  q?: string,
  opts?: { onlyUnassigned?: boolean }
) {
  const st = (status ?? "").trim();
  const term = (q ?? "").trim();

  const qs = new URLSearchParams();
  if (st) qs.set("status", st);
  if (term) qs.set("q", term);

  // ✅ yeni param
  if (opts?.onlyUnassigned) qs.set("onlyUnassigned", "true");

  const url = u(`/api/workorders${qs.toString() ? `?${qs.toString()}` : ""}`);
  return await fetchJson<DispatchWorkOrderRow[]>(url);
}

// -------------------------
// ✅ Owner Users (NEW)
// -------------------------

export type OwnerUserListItem = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  role: string;
  status: string;
  forcePasswordChange: boolean;
  createdAt: string;
};

export type CreateOwnerUserBody = {
  fullName: string;
  phone: string;
  role: "owner" | "dispatcher" | "sales" | "tech";
  email?: string | null;
};

export type CreateOwnerUserResponse = {
  id: string;
  tempPassword: string;
};

export async function ownerListUsers(q?: string) {
  const term = (q ?? "").trim();
  const qs = new URLSearchParams();
  if (term) qs.set("q", term);

  const url = u(`/api/owner/users${qs.toString() ? `?${qs.toString()}` : ""}`);
  return await fetchJson<OwnerUserListItem[]>(url);
}

export async function ownerCreateUser(body: CreateOwnerUserBody) {
  const url = u(`/api/owner/users`);
  return await fetchJson<CreateOwnerUserResponse>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: body.fullName,
      phone: body.phone,
      role: body.role,
      email: body.email ?? null,
    }),
  });
}

export async function ownerResetUserPassword(userId: string) {
  const url = u(`/api/owner/users/${userId}/reset-password`);
  return await fetchJson<{ id: string; tempPassword: string }>(url, {
    method: "POST",
  });
}

export async function ownerUpdateUser(
  userId: string,
  patch: { fullName?: string; role?: string; status?: "active" | "passive" }
) {
  const url = u(`/api/owner/users/${userId}`);
  return await fetchJson<any>(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}
