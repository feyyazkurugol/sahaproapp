"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Briefcase, Clock, CheckCircle2, XCircle, ChevronRight, RefreshCw } from "lucide-react";
import { getByTech } from "@/lib/api";
import { fetchJson, u } from "@/lib/http";
import { getTenantId, getTechUserId } from "@/lib/auth";

type WorkOrderListItemRow = {
  id: string;
  status: string;
  notes?: string | null;
  scheduledStartAt?: string | null;
  photoCount: number;
  paymentCount: number;

  cancelledAt?: string | null;
  cancelReason?: string | null;
  cancelNote?: string | null;
};

type WorkOrderCountsRow = {
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  total: number;
};

function normalizeStatus(s?: string | null) {
  const v = (s ?? "").trim().toLowerCase();
  if (v === "scheduled" || v === "pending") return "pending";
  if (v === "in_progress") return "in_progress";
  if (v === "completed") return "completed";
  if (v === "cancelled" || v === "canceled") return "cancelled";
  return "other";
}

function formatStatusTR(s: string) {
  switch (normalizeStatus(s)) {
    case "pending":
      return "Bekleyen";
    case "in_progress":
      return "Devam";
    case "completed":
      return "Tamamlandı";
    case "cancelled":
      return "İptal";
    default:
      return "Diğer";
  }
}

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function PremiumCard({
  title,
  count,
  subtitle,
  icon,
  active,
  onClick,
}: {
  title: string;
  count: number;
  subtitle: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group relative w-full text-left rounded-2xl p-4 md:p-5 transition",
        "border backdrop-blur-md shadow-sm",
        "bg-white/70 dark:bg-zinc-950/40",
        "hover:shadow-md hover:-translate-y-[1px] active:translate-y-0",
        active
          ? "border-zinc-900/20 ring-2 ring-zinc-900/10 dark:border-white/20 dark:ring-white/10"
          : "border-zinc-200/70 dark:border-white/10",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{title}</div>
          <div className="mt-1 flex items-end gap-2">
            <div className="text-3xl md:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              {count}
            </div>
            <div className="pb-1 text-xs text-zinc-500 dark:text-zinc-400">iş</div>
          </div>
          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</div>
        </div>

        <div
          className={[
            "shrink-0 rounded-2xl p-3 border",
            "bg-white/60 dark:bg-white/5",
            "border-zinc-200/70 dark:border-white/10",
          ].join(" ")}
        >
          {icon}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1">
          Detayları gör
          <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-[2px]" />
        </span>

        {active ? (
          <span className="rounded-full px-2 py-1 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">Seçili</span>
        ) : (
          <span className="rounded-full px-2 py-1 bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-200">
            Filtrele
          </span>
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition">
        <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-zinc-200/40 via-transparent to-zinc-200/40 dark:from-white/10 dark:to-white/10" />
      </div>
    </button>
  );
}

function toNumber(x: any) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function normalizeCounts(raw: any): WorkOrderCountsRow {
  return {
    pending: toNumber(raw?.pending ?? raw?.Pending ?? 0),
    inProgress: toNumber(raw?.inProgress ?? raw?.InProgress ?? 0),
    completed: toNumber(raw?.completed ?? raw?.Completed ?? 0),
    cancelled: toNumber(raw?.cancelled ?? raw?.Cancelled ?? 0),
    total: toNumber(raw?.total ?? raw?.Total ?? 0),
  };
}

function normalizeList(raw: any[]): WorkOrderListItemRow[] {
  return (Array.isArray(raw) ? raw : [])
    .map((x) => ({
      id: x?.id ?? x?.Id ?? "",
      status: x?.status ?? x?.Status ?? "",
      notes: x?.notes ?? x?.Notes ?? null,
      scheduledStartAt: x?.scheduledStartAt ?? x?.ScheduledStartAt ?? null,
      photoCount: toNumber(x?.photoCount ?? x?.PhotoCount ?? 0),
      paymentCount: toNumber(x?.paymentCount ?? x?.PaymentCount ?? 0),

      cancelledAt: x?.cancelledAt ?? x?.CancelledAt ?? null,
      cancelReason: x?.cancelReason ?? x?.CancelReason ?? null,
      cancelNote: x?.cancelNote ?? x?.CancelNote ?? null,
    }))
    .filter((x) => !!x.id);
}

type FilterKey = "all" | "pending" | "in_progress" | "completed" | "cancelled";

function isFilterKey(x: string): x is FilterKey {
  return x === "all" || x === "pending" || x === "in_progress" || x === "completed" || x === "cancelled";
}

export default function JobsHome() {
  const router = useRouter();
  const sp = useSearchParams();

  const selectedParam = (sp.get("status") ?? "all").toLowerCase();
  const selected: FilterKey = isFilterKey(selectedParam) ? selectedParam : "all";

  const [loadingList, setLoadingList] = useState(true);
  const [loadingCounts, setLoadingCounts] = useState(true);

  const [errList, setErrList] = useState<string | null>(null);
  const [errCounts, setErrCounts] = useState<string | null>(null);

  const [items, setItems] = useState<WorkOrderListItemRow[]>([]);
  const [counts, setCounts] = useState<WorkOrderCountsRow>({
    pending: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    total: 0,
  });

  // ✅ ÜRÜN MANTIĞI: localStorage -> state (login sonrası güncellensin)
  const [tenantId, setTenantId] = useState<string>("");
  const [techUserId, setTechUserId] = useState<string>("");

  useEffect(() => {
    setTenantId(getTenantId() || "");
    setTechUserId(getTechUserId() || "");
  }, []);

  const setStatus = (s: FilterKey) => {
    const params = new URLSearchParams(Array.from(sp.entries()));
    if (s === "all") params.delete("status");
    else params.set("status", s);
    router.push(`/jobs?${params.toString()}`);
  };

  const fetchCounts = async (tId: string, uId: string) => {
    setLoadingCounts(true);
    setErrCounts(null);

    try {
      if (!tId || !uId) throw new Error("session_required");

      const url = u(`/api/workorders/by-tech/${encodeURIComponent(uId)}/counts?tenantId=${encodeURIComponent(tId)}`);
      const raw = await fetchJson<any>(url);
      setCounts(normalizeCounts(raw));
    } catch (e: any) {
      setErrCounts(e?.message ?? "Counts fetch failed");
      setCounts({ pending: 0, inProgress: 0, completed: 0, cancelled: 0, total: 0 });
    } finally {
      setLoadingCounts(false);
    }
  };

  const fetchList = async (tId: string, uId: string, filter: FilterKey) => {
    setLoadingList(true);
    setErrList(null);

    try {
      if (!tId || !uId) throw new Error("session_required");

      const raw = await getByTech(tId, uId);
      const list = normalizeList(raw as any[]);

      const filtered = filter === "all" ? list : list.filter((x) => normalizeStatus(x.status) === filter);
      setItems(filtered);
    } catch (e: any) {
      setErrList(e?.message ?? "List fetch failed");
      setItems([]);
    } finally {
      setLoadingList(false);
    }
  };

  const refreshAll = async () => {
    if (!tenantId || !techUserId) return;
    await Promise.all([fetchCounts(tenantId, techUserId), fetchList(tenantId, techUserId, selected)]);
  };

  useEffect(() => {
    if (!tenantId || !techUserId) return;

    fetchCounts(tenantId, techUserId);
    fetchList(tenantId, techUserId, selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, tenantId, techUserId]);

  const headerRight = useMemo(() => {
    const busy = loadingCounts || loadingList;
    return (
      <button
        type="button"
        onClick={refreshAll}
        disabled={busy || !tenantId || !techUserId}
        className={[
          "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm border transition",
          "border-zinc-200/70 bg-white/70 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed",
          "dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
        ].join(" ")}
        title="Yenile"
      >
        <RefreshCw className={["h-4 w-4", busy ? "animate-spin" : ""].join(" ")} />
        Yenile
      </button>
    );
  }, [loadingCounts, loadingList, tenantId, techUserId, selected]);

  const listTitle = selected === "all" ? "Tüm işler" : `${formatStatusTR(selected)} işleri`;

  const listMeta = useMemo(() => {
    if (!tenantId || !techUserId) {
      return <span className="text-xs text-red-600">Oturum bulunamadı (login gerekli).</span>;
    }
    if (loadingList) return <span className="text-xs text-zinc-500 dark:text-zinc-400">Yükleniyor…</span>;
    if (errList) return <span className="text-xs text-red-600">{errList}</span>;
    return <span className="text-xs text-zinc-500 dark:text-zinc-400">{items.length} kayıt</span>;
  }, [tenantId, techUserId, loadingList, errList, items.length]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl px-4 py-6 md:py-10">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Personel</div>
            <h1 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              İşler
            </h1>

            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              {!tenantId || !techUserId ? (
                <span className="text-red-600">Oturum bulunamadı.</span>
              ) : loadingCounts ? (
                <>
                  Toplam <span className="font-medium">…</span> iş
                </>
              ) : errCounts ? (
                <span className="text-red-600">{errCounts}</span>
              ) : (
                <>
                  Toplam <span className="font-medium">{counts.total}</span> iş
                </>
              )}
            </div>
          </div>

          {headerRight}
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <PremiumCard
            title="Bekleyen"
            count={counts.pending}
            subtitle="Planlı / henüz başlanmadı"
            icon={<Clock className="h-6 w-6 text-zinc-900 dark:text-white" />}
            active={selected === "pending"}
            onClick={() => setStatus("pending")}
          />
          <PremiumCard
            title="Devam"
            count={counts.inProgress}
            subtitle="Sahada işlem sürüyor"
            icon={<Briefcase className="h-6 w-6 text-zinc-900 dark:text-white" />}
            active={selected === "in_progress"}
            onClick={() => setStatus("in_progress")}
          />
          <PremiumCard
            title="Tamamlandı"
            count={counts.completed}
            subtitle="Kilitli (foto/ödeme değişmez)"
            icon={<CheckCircle2 className="h-6 w-6 text-zinc-900 dark:text-white" />}
            active={selected === "completed"}
            onClick={() => setStatus("completed")}
          />
          <PremiumCard
            title="İptal"
            count={counts.cancelled}
            subtitle="İptal edilen işler"
            icon={<XCircle className="h-6 w-6 text-zinc-900 dark:text-white" />}
            active={selected === "cancelled"}
            onClick={() => setStatus("cancelled")}
          />
        </div>

        <div className="mt-7">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{listTitle}</h2>
            {listMeta}
          </div>

          <div className="mt-3 space-y-2">
            {loadingList ? (
              <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
                <div className="h-4 w-40 bg-zinc-200/70 rounded dark:bg-white/10" />
                <div className="mt-2 h-3 w-64 bg-zinc-200/70 rounded dark:bg-white/10" />
              </div>
            ) : errList ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                {errList}
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 text-sm text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                Bu filtrede iş yok.
              </div>
            ) : (
              items.map((it) => {
                const isCancelled = normalizeStatus(it.status) === "cancelled";
                const cancelReason = (it.cancelReason ?? "").toString().trim();
                const cancelNote = (it.cancelNote ?? "").toString().trim();

                return (
                  <button
                    key={it.id}
                    onClick={() => router.push(`/jobs/${it.id}`)}
                    className="w-full text-left rounded-2xl border border-zinc-200/70 bg-white/70 p-4 transition
                               hover:bg-white hover:shadow-sm
                               dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-zinc-900 dark:text-white">İş #{it.id.slice(0, 8)}</div>

                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{fmtDate(it.scheduledStartAt)}</div>

                        {it.notes ? (
                          <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-200 line-clamp-2">{it.notes}</div>
                        ) : null}

                        {isCancelled && (cancelReason || cancelNote) ? (
                          <div className="mt-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2 dark:bg-red-950/40 dark:border-red-900">
                            <div className="text-[11px] font-semibold text-red-700 dark:text-red-300">İptal nedeni</div>

                            {cancelReason ? (
                              <div className="mt-1 text-xs text-red-800 dark:text-red-200">{cancelReason}</div>
                            ) : null}

                            {cancelNote ? (
                              <div className="mt-1 text-[11px] text-red-700/80 dark:text-red-300/80">{cancelNote}</div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-2">
                        <span className="rounded-full px-2 py-1 text-xs border border-zinc-200/70 bg-zinc-50 text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                          {formatStatusTR(it.status)}
                        </span>

                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {it.photoCount} foto • {it.paymentCount} tahsilat
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
