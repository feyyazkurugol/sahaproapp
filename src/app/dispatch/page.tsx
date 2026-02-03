"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { readSession } from "@/lib/sessions";
import {
  getTechUsers,
  assignWorkOrderToUser,
  listWorkOrders,
  type TechUserListItem,
} from "@/lib/api";

// ✅ i18n
import { useT } from "@/lib/i18n/useT";

type StatusFilter = "pending" | "in_progress" | "completed" | "cancelled" | "all";

type DispatchWorkOrderRow = {
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

function fmtShort(dt?: string | null) {
  if (!dt) return "-";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return dt;
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function statusBadge(s?: string | null) {
  const v = (s ?? "").toLowerCase();
  if (v === "in_progress") return "bg-blue-50 text-blue-700";
  if (v === "completed") return "bg-green-50 text-green-700";
  if (v === "cancelled" || v === "canceled") return "bg-red-50 text-red-700";
  return "bg-gray-100 text-gray-700";
}

function errText(e: any) {
  if (!e) return "unknown_error";
  if (typeof e === "string") return e;
  const parts: string[] = [];
  if (e.message) parts.push(String(e.message));
  if (e.status) parts.push(`status=${e.status}`);
  if (e.statusText) parts.push(`statusText=${e.statusText}`);
  if (e.body && typeof e.body === "string") parts.push(`body=${e.body}`);
  return parts.filter(Boolean).join(" | ") || "request_failed";
}

export default function DispatchPage() {
  const router = useRouter();
  const { t } = useT();

  // ✅ Hydration fix: session'ı render sırasında değil, mount sonrası oku
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<ReturnType<typeof readSession> | null>(null);

  // ✅ eğer tech/sales ise dispatch render etmeyelim (flash + gereksiz fetch olmasın)
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    setMounted(true);

    try {
      const s = readSession();
      setSession(s);

      // ✅ role bazlı route guard:
      // tech -> jobs, sales -> leads
      if (s?.role === "tech") {
        setRedirecting(true);
        router.replace("/jobs");
        return;
      }

      if (s?.role === "sales") {
        setRedirecting(true);
        router.replace("/leads");
        return;
      }

      setRedirecting(false);
    } catch {
      setSession(null);
      setRedirecting(false);
    }
  }, [router]);

  const role = session?.role;
  const canUse = role === "owner" || role === "dispatcher";

  // filters
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [q, setQ] = useState("");

  // workorders list
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DispatchWorkOrderRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  // tech list
  const [techs, setTechs] = useState<TechUserListItem[]>([]);
  const [techLoading, setTechLoading] = useState(false);
  const [techError, setTechError] = useState<string | null>(null);

  // assign form
  const [selectedTechId, setSelectedTechId] = useState("");
  const [note, setNote] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignOk, setAssignOk] = useState<string | null>(null);

  const selected = useMemo(
    () => items.find((x) => x.id === selectedId) ?? null,
    [items, selectedId]
  );

  // ✅ status label (API value -> i18n)
  function statusLabel(raw?: string | null) {
    const v = (raw ?? "").toLowerCase();
    if (v === "scheduled" || v === "pending") return t("status.pending");
    if (v === "in_progress") return t("status.in_progress");
    if (v === "completed") return t("status.completed");
    if (v === "cancelled" || v === "canceled") return t("status.cancelled");
    return raw ?? "-";
  }

  async function refreshList(opts?: { keepSelected?: boolean }) {
    if (!session || !canUse) return;

    const keepSelected = opts?.keepSelected ?? true;

    setLoading(true);
    setError(null);

    try {
      // ✅ pending seçiliyken sadece atanacak işler gelsin
      const onlyUnassigned = status === "pending";

      const list = await listWorkOrders(status, q.trim() || undefined, { onlyUnassigned });

      const safe: DispatchWorkOrderRow[] = (list ?? []) as any;

      setItems(safe);

      if (safe.length === 0) {
        setSelectedId("");
      } else if (!keepSelected) {
        setSelectedId(safe[0].id);
      } else {
        setSelectedId((prev) => {
          if (prev && safe.some((x) => x.id === prev)) return prev;
          return safe[0].id;
        });
      }
    } catch (e: any) {
      setError(errText(e));
      setItems([]);
      setSelectedId("");
    } finally {
      setLoading(false);
    }
  }

  // initial load + status change
  useEffect(() => {
    if (!mounted || redirecting || !session || !canUse) return;
    refreshList({ keepSelected: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, redirecting, session?.token, canUse, status]);

  // debounced search
  useEffect(() => {
    if (!mounted || redirecting || !session || !canUse) return;
    const tmr = setTimeout(() => refreshList({ keepSelected: true }), 400);
    return () => clearTimeout(tmr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, redirecting, q]);

  // ✅ tech list once
  useEffect(() => {
    if (!mounted || redirecting || !session || !canUse) return;

    setTechLoading(true);
    setTechError(null);

    getTechUsers()
      .then((list) => {
        const safe = list ?? [];
        setTechs(safe);
        setSelectedTechId((prev) => prev || (safe[0]?.id ?? ""));
      })
      .catch((e: any) => setTechError(errText(e)))
      .finally(() => setTechLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, redirecting, session?.token, canUse]);

  async function assign() {
    setAssignOk(null);
    setAssignError(null);

    if (!selected) return setAssignError("work_order_required");
    if (!selectedTechId) return setAssignError("tech_required");

    setAssignLoading(true);
    try {
      await assignWorkOrderToUser(selected.id, selectedTechId, note.trim() || undefined);
      setAssignOk("assigned_ok");
      await refreshList({ keepSelected: true });
    } catch (e: any) {
      setAssignError(errText(e));
    } finally {
      setAssignLoading(false);
    }
  }

  if (!mounted || redirecting) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">{t("dispatch.title")}</h1>
        <p className="mt-2 text-sm text-gray-600">
          {redirecting ? t("common.redirecting") : t("common.loading")}
        </p>
      </div>
    );
  }

  if (!canUse) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">{t("dispatch.title")}</h1>
        <p className="mt-2 text-sm text-red-600">{t("dispatch.forbidden")}</p>
      </div>
    );
  }

  return (
    <div className="py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">{t("dispatch.title")}</h1>
          <p className="text-sm text-gray-600 mt-1">{t("dispatch.subtitle")}</p>
        </div>

        <button
          type="button"
          onClick={() => refreshList({ keepSelected: true })}
          className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
        >
          {t("common.refresh")}
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-700">{t("common.status")}</div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="border px-3 py-2 rounded text-sm"
          >
            <option value="pending">{t("status.pending")}</option>
            <option value="in_progress">{t("status.in_progress")}</option>
            <option value="completed">{t("status.completed")}</option>
            <option value="cancelled">{t("status.cancelled")}</option>
            <option value="all">{t("status.all")}</option>
          </select>
        </div>

        <div className="flex-1">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("dispatch.searchPlaceholder")}
            className="w-full border px-3 py-2 rounded text-sm"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* Left: list */}
        <div className="border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold">{t("dispatch.listTitle")}</div>
            <div className="text-xs text-gray-500">
              {items.length} {t("common.records")}
            </div>
          </div>

          {loading ? (
            <div className="p-4 text-sm text-gray-600">{t("common.loading")}</div>
          ) : error ? (
            <div className="p-4 text-sm text-red-600">{error}</div>
          ) : items.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">{t("common.noRecords")}</div>
          ) : (
            <div className="max-h-[70vh] overflow-auto">
              {items.map((x) => {
                const active = x.id === selectedId;
                return (
                  <button
                    key={x.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(x.id);
                      setAssignOk(null);
                      setAssignError(null);
                    }}
                    className={[
                      "w-full text-left px-4 py-3 border-b last:border-b-0",
                      active ? "bg-gray-50" : "hover:bg-gray-50",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {x.customerName ?? "-"} — {x.siteTitle ?? "-"}
                        </div>
                        <div className="text-xs text-gray-600 truncate">
                          {x.addressText ?? x.notes ?? "-"}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={["text-xs px-2 py-1 rounded", statusBadge(x.status)].join(" ")}>
                          {statusLabel(x.status)}
                        </span>
                        <span className="text-xs text-gray-500">{fmtShort(x.scheduledStartAt)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right */}
        <div className="border rounded-lg p-4">
          <div className="font-semibold mb-3">{t("dispatch.selectedTitle")}</div>

          {!selected ? (
            <div className="text-sm text-gray-600">{t("dispatch.selectHint")}</div>
          ) : (
            <>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-gray-600">{t("common.status")}</span>
                  <span className="font-medium">{statusLabel(selected.status)}</span>
                </div>

                <div className="flex justify-between gap-2">
                  <span className="text-gray-600">{t("dispatch.plan")}</span>
                  <span className="font-medium">{fmtShort(selected.scheduledStartAt)}</span>
                </div>

                <div className="pt-2 border-t">
                  <div className="text-gray-600">{t("dispatch.customer")}</div>
                  <div className="font-medium">{selected.customerName ?? "-"}</div>
                </div>

                <div className="pt-2 border-t">
                  <div className="text-gray-600">{t("dispatch.siteAddress")}</div>
                  <div className="font-medium">
                    {selected.siteTitle ?? "-"} — {selected.addressText ?? "-"}
                  </div>
                </div>

                <div className="pt-3 flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(selected.id).catch(() => {})}
                    className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
                  >
                    {t("common.copyId")}
                  </button>
                  <span className="px-3 py-2 rounded border text-sm text-gray-500">
                    {t("dispatch.detailHint")}
                  </span>
                </div>
              </div>

              <div className="mt-6 border-t pt-4">
                <div className="font-semibold mb-2">{t("dispatch.assignTitle")}</div>

                <div className="text-sm text-gray-700">{t("dispatch.techUser")}</div>

                {techLoading ? (
                  <div className="mt-2 text-sm text-gray-600">{t("dispatch.techLoading")}</div>
                ) : techError ? (
                  <div className="mt-2 text-sm text-red-600">{techError}</div>
                ) : (
                  <select
                    value={selectedTechId}
                    onChange={(e) => setSelectedTechId(e.target.value)}
                    className="mt-2 w-full border px-3 py-2 rounded"
                  >
                    {techs.length === 0 ? (
                      <option value="">{t("dispatch.noTech")}</option>
                    ) : (
                      techs.map((tUser) => (
                        <option key={tUser.id} value={tUser.id}>
                          {tUser.fullName || tUser.email} {tUser.status ? `— ${tUser.status}` : ""}
                        </option>
                      ))
                    )}
                  </select>
                )}

                <div className="mt-4 text-sm text-gray-700">{t("dispatch.noteOptional")}</div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t("dispatch.notePlaceholder")}
                  className="mt-2 w-full border px-3 py-2 rounded min-h-[90px]"
                />

                <div className="mt-4 flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={assign}
                    disabled={assignLoading || !selected || !selectedTechId}
                    className="px-3 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-60"
                  >
                    {assignLoading ? t("dispatch.assigning") : t("dispatch.assign")}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAssignOk(null);
                      setAssignError(null);
                      setNote("");
                    }}
                    className="px-3 py-2 rounded border text-sm hover:bg-gray-50"
                  >
                    {t("dispatch.clearNote")}
                  </button>
                </div>

                {assignError && <div className="mt-3 text-sm text-red-600">{assignError}</div>}
                {assignOk && <div className="mt-3 text-sm text-green-700">{t("dispatch.assignOk")}</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
