"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  WorkOrderDetail,
  getWorkOrderDetail,
  startWorkOrder,
  completeWorkOrder,
  uploadWorkOrderPhoto,
  addPayment,
  deleteWorkOrderPhoto,
  cancelWorkOrder,
} from "@/lib/api";
import { u } from "@/lib/http";
import { getTenantId, getTechUserId } from "@/lib/auth";
import { useT } from "@/lib/i18n/useT";

function fmt(dt?: string | null) {
  if (!dt) return "-";
  const d = new Date(dt);
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

type StatusKey = "pending" | "in_progress" | "completed" | "cancelled" | "unknown";

function statusKeyFromBackend(status?: string | null): StatusKey {
  const s = (status ?? "").toLowerCase();
  if (s === "pending") return "pending";
  if (s === "in_progress") return "in_progress";
  if (s === "completed") return "completed";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  return "unknown";
}

function statusUiMeta(key: StatusKey) {
  if (key === "pending") return { cls: "bg-blue-50 text-blue-700 ring-blue-200", dot: "bg-blue-500" };
  if (key === "in_progress") return { cls: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500" };
  if (key === "completed") return { cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" };
  if (key === "cancelled") return { cls: "bg-red-50 text-red-700 ring-red-200", dot: "bg-red-500" };
  return { cls: "bg-gray-50 text-gray-700 ring-gray-200", dot: "bg-gray-400" };
}

const STATUS_LABEL_KEY: Record<
  StatusKey,
  "status.pending" | "status.in_progress" | "status.completed" | "status.cancelled" | "status.unknown"
> = {
  pending: "status.pending",
  in_progress: "status.in_progress",
  completed: "status.completed",
  cancelled: "status.cancelled",
  unknown: "status.unknown",
};

function mapsUrl(address: string, lat?: number | null, lng?: number | null) {
  if (lat != null && lng != null) return `https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(address)}`;
  return `https://maps.apple.com/?q=${encodeURIComponent(address)}`;
}

type GeoResult = { ok: true; lat: number; lng: number; accuracy?: number } | { ok: false; messageKey: string };

async function getCurrentLocation(timeoutMs = 12000): Promise<GeoResult> {
  if (typeof window === "undefined") return { ok: false, messageKey: "geo.browser_only" };
  if (!("geolocation" in navigator)) return { ok: false, messageKey: "geo.not_supported" };

  return await new Promise<GeoResult>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          ok: true,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => {
        if (err?.code === 1) return resolve({ ok: false, messageKey: "geo.permission_denied" });
        if (err?.code === 2) return resolve({ ok: false, messageKey: "geo.unavailable" });
        if (err?.code === 3) return resolve({ ok: false, messageKey: "geo.timeout" });
        resolve({ ok: false, messageKey: "geo.unknown_error" });
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}

function toPublicUrl(storageKey: string) {
  if (!storageKey) return "";
  if (/^https?:\/\//i.test(storageKey)) return storageKey;
  if (storageKey.startsWith("/")) return u(storageKey);
  return u(`/${storageKey}`);
}

function fmtCoord(v?: number | null) {
  if (v == null) return "-";
  return Number(v).toFixed(6);
}

const ACTIONS_HINT_KEY: Record<
  "start" | "complete" | "cancelled" | "completed_locked",
  "job.hint.start" | "job.hint.complete" | "job.hint.cancelled" | "job.hint.completed_locked"
> = {
  start: "job.hint.start",
  complete: "job.hint.complete",
  cancelled: "job.hint.cancelled",
  completed_locked: "job.hint.completed_locked",
};

function actionsHintKey(canStart: boolean, canComplete: boolean, statusLower: string) {
  if (canStart) return ACTIONS_HINT_KEY.start;
  if (canComplete) return ACTIONS_HINT_KEY.complete;
  if (statusLower === "cancelled" || statusLower === "canceled") return ACTIONS_HINT_KEY.cancelled;
  return ACTIONS_HINT_KEY.completed_locked;
}

type Props = {
  workOrderId: string;
  initial?: WorkOrderDetail;
};

export default function JobDetailClient({ initial, workOrderId }: Props) {
  const { t } = useT();
  const router = useRouter();

  const [busy, setBusy] = useState<
    "start" | "complete" | "cancel" | "upload_before" | "upload_after" | "delete_photo" | "pay" | null
  >(null);

  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<"cash" | "transfer" | "pos_later">("cash");

  const inputBeforeRef = useRef<HTMLInputElement | null>(null);
  const inputAfterRef = useRef<HTMLInputElement | null>(null);

  const [data, setData] = useState<WorkOrderDetail | null>(initial ?? null);
  const [loading, setLoading] = useState<boolean>(!initial);

  const [tenantId, setTenantId] = useState<string>("");
  const [techUserId, setTechUserId] = useState<string>("");

  useEffect(() => {
    setTenantId(getTenantId() || "");
    setTechUserId(getTechUserId() || "");
  }, []);

  async function reloadDetail() {
    if (!tenantId) {
      setErr("errors.tenant_required");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const d = await getWorkOrderDetail(workOrderId, tenantId);
      setData(d);
    } catch (e: any) {
      setErr(e?.message ? `errors.${e.message}` : "errors.detail_fetch_failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initial) return;
    if (!tenantId) return;
    reloadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId, tenantId]);

  const wo = data?.workOrder;
  const statusLower = (wo?.status ?? "").toLowerCase();

  const statusKey = statusKeyFromBackend(wo?.status ?? "");
  const st = statusUiMeta(statusKey);

  const isCancelled = statusKey === "cancelled";
  const canStart = statusLower === "pending";
  const canComplete = statusLower === "in_progress";
  const canCancel = statusLower === "pending" || statusLower === "in_progress";

  const title = data?.customer?.name ?? wo?.notes ?? t("job.title.fallback");
  const address = data?.site?.addressText ?? t("common.unknown");
  const phone = data?.customer?.phone ?? null;

  const isLocked = statusLower === "completed";
  const canAddPhoto = statusLower === "in_progress";
  const canPay = statusLower === "in_progress" || statusLower === "completed";

  const actionsHint = t(actionsHintKey(canStart, canComplete, statusLower));

  function requireSessionIds() {
    if (!tenantId) throw new Error("tenant_required");
    if (!techUserId) throw new Error("tech_user_required");
    return { tenantId, userId: techUserId };
  }

  if (loading && !data) return <div className="p-4 text-sm text-gray-600">{t("common.loading")}</div>;

  if (err && !data) {
    return (
      <div className="p-4">
        <div className="rounded-2xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">{t(err)}</div>
      </div>
    );
  }

  if (!data || !wo) return <div className="p-4 text-sm text-gray-600">{t("common.not_found")}</div>;

  async function onStart() {
    try {
      setErr(null);
      setInfo(null);
      setBusy("start");

      const { tenantId, userId } = requireSessionIds();

      const geo = await getCurrentLocation();
      const lat = geo.ok ? geo.lat : null;
      const lng = geo.ok ? geo.lng : null;

      if (geo.ok) setInfo(`${t("geo.ok")} (±${Math.round(geo.accuracy ?? 0)}m)`);
else setInfo(`${t(geo.messageKey)} (${t("geo.continue_without_location")})`);


      await startWorkOrder(workOrderId, { tenantId, userId, lat, lng });

      await reloadDetail();
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ? `errors.${e.message}` : "errors.start_failed");
    } finally {
      setBusy(null);
    }
  }

  async function onComplete() {
    try {
      setErr(null);
      setInfo(null);
      setBusy("complete");

      const { tenantId, userId } = requireSessionIds();

      const geo = await getCurrentLocation();
      const lat = geo.ok ? geo.lat : null;
      const lng = geo.ok ? geo.lng : null;
if (geo.ok) setInfo(`${t("geo.ok")} (±${Math.round(geo.accuracy ?? 0)}m)`);
else setInfo(`${t(geo.messageKey)} (${t("geo.continue_without_location")})`);


      await completeWorkOrder(workOrderId, { tenantId, userId, lat, lng });

      await reloadDetail();
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ? `errors.${e.message}` : "errors.complete_failed");
    } finally {
      setBusy(null);
    }
  }

  async function onCancel() {
    const reason = window.prompt(t("job.cancel.prompt_reason"));
    if (!reason) return;

    try {
      setErr(null);
      setInfo(null);
      setBusy("cancel");

      const { tenantId, userId } = requireSessionIds();

      const geo = await getCurrentLocation();
      const lat = geo.ok ? geo.lat : null;
      const lng = geo.ok ? geo.lng : null;

      await cancelWorkOrder(workOrderId, { tenantId, userId, reason, lat, lng });

      setInfo(t("job.cancel.success"));
      await reloadDetail();
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ? `errors.${e.message}` : "errors.cancel_failed");
    } finally {
      setBusy(null);
    }
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setInfo(t("job.address.copied"));
    } catch {
      // ignore
    }
  }

  function onPickBefore() {
    inputBeforeRef.current?.click();
  }
  function onPickAfter() {
    inputAfterRef.current?.click();
  }

  async function onUpload(kind: "before" | "after", file: File | null) {
    if (!file) return;
    try {
      setErr(null);
      setInfo(null);
      setBusy(kind === "before" ? "upload_before" : "upload_after");

      const { tenantId, userId } = requireSessionIds();

      await uploadWorkOrderPhoto(workOrderId, { tenantId, userId, kind, file });

      setInfo(kind === "before" ? t("job.photos.before_added") : t("job.photos.after_added"));
      await reloadDetail();
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ? `errors.${e.message}` : "errors.photo_upload_failed");
    } finally {
      setBusy(null);
      if (kind === "before" && inputBeforeRef.current) inputBeforeRef.current.value = "";
      if (kind === "after" && inputAfterRef.current) inputAfterRef.current.value = "";
    }
  }

  async function onDeletePhoto(attachmentId: string) {
    if (isLocked) return;
    const ok = confirm(t("job.photos.delete_confirm"));
    if (!ok) return;

    try {
      setErr(null);
      setInfo(null);
      setBusy("delete_photo");

      if (!tenantId) throw new Error("tenant_required");

      await deleteWorkOrderPhoto(workOrderId, tenantId, attachmentId);

      setInfo(t("job.photos.deleted"));
      await reloadDetail();
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ? `errors.${e.message}` : "errors.delete_failed");
    } finally {
      setBusy(null);
    }
  }

  async function onPay() {
    try {
      setErr(null);
      setInfo(null);
      setBusy("pay");

      const { tenantId, userId } = requireSessionIds();

      const n = Number(String(amount).replace(",", "."));
      if (!isFinite(n) || n <= 0) {
        setErr("errors.invalid_amount");
        return;
      }

      await addPayment(workOrderId, {
        tenantId,
        userId,
        amount: n,
        currency: "TRY",
        method,
      });

      setAmount("");
      setInfo(t("job.payment.saved"));
      await reloadDetail();
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ? `errors.${e.message}` : "errors.payment_failed");
    } finally {
      setBusy(null);
    }
  }

  const photosBefore = (data.photos ?? []).filter((p) => (p.kind ?? "").toLowerCase() === "before");
  const photosAfter = (data.photos ?? []).filter((p) => (p.kind ?? "").toLowerCase() === "after");
  const payments = data.payments ?? [];

  return (
    <div className="space-y-3">
      {/* Hero */}
      <div className="rounded-3xl bg-white border border-black/5 shadow-sm">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${st.dot}`} />
                <div className="truncate text-base font-semibold text-gray-900">{title}</div>
              </div>
              <div className="mt-1 text-xs text-gray-600">
                {data.site?.title ? `${data.site.title} • ` : ""}
                {address}
              </div>
            </div>

            {/* ✅ TS-friendly: no dynamic key */}
            <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${st.cls}`}>
              {t(STATUS_LABEL_KEY[statusKey])}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-gray-50 border border-black/5 p-3">
              <div className="text-[11px] text-gray-500 leading-3">{t("job.meta.plan")}</div>
              <div className="mt-1 text-xs font-semibold">{fmt(wo.scheduledStartAt)}</div>
            </div>
            <div className="rounded-2xl bg-gray-50 border border-black/5 p-3">
              <div className="text-[11px] text-gray-500 leading-3">{t("job.meta.started")}</div>
              <div className="mt-1 text-xs font-semibold">{fmt(wo.startedAt)}</div>
            </div>
            <div className="rounded-2xl bg-gray-50 border border-black/5 p-3">
              <div className="text-[11px] text-gray-500 leading-3">{t("job.meta.completed")}</div>
              <div className="mt-1 text-xs font-semibold">{fmt(wo.completedAt)}</div>
            </div>
          </div>

          {/* Location */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-gray-50 border border-black/5 p-3">
              <div className="text-[11px] text-gray-500 leading-3">{t("job.location.start")}</div>
              <div className="mt-1 text-xs font-semibold">
                {fmtCoord(wo.startLat)}, {fmtCoord(wo.startLng)}
              </div>
              {wo.startLat != null && wo.startLng != null ? (
                <a
                  className="mt-2 inline-block text-[11px] font-semibold underline text-gray-700"
                  href={mapsUrl(address, wo.startLat, wo.startLng)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("common.open_in_maps")}
                </a>
              ) : null}
            </div>

            <div className="rounded-2xl bg-gray-50 border border-black/5 p-3">
              <div className="text-[11px] text-gray-500 leading-3">{t("job.location.end")}</div>
              <div className="mt-1 text-xs font-semibold">
                {fmtCoord(wo.endLat)}, {fmtCoord(wo.endLng)}
              </div>
              {wo.endLat != null && wo.endLng != null ? (
                <a
                  className="mt-2 inline-block text-[11px] font-semibold underline text-gray-700"
                  href={mapsUrl(address, wo.endLat, wo.endLng)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("common.open_in_maps")}
                </a>
              ) : null}
            </div>
          </div>

          {phone ? (
            <a
              href={`tel:${phone}`}
              className="mt-3 block rounded-2xl bg-black text-white px-4 py-3 text-center text-sm font-semibold shadow-sm active:scale-[0.99]"
            >
              {t("job.call_customer")} • {phone}
            </a>
          ) : null}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={mapsUrl(address, wo.startLat ?? wo.endLat, wo.startLng ?? wo.endLng)}
              className="rounded-2xl bg-white border border-black/10 px-4 py-3 text-center text-xs font-semibold shadow-sm active:scale-[0.99]"
            >
              {t("common.open_in_maps")}
            </a>
            <button
              onClick={copyAddress}
              className="rounded-2xl bg-white border border-black/10 px-4 py-3 text-center text-xs font-semibold shadow-sm active:scale-[0.99]"
            >
              {t("job.address.copy")}
            </button>
          </div>

          <div className="mt-3 text-[11px] text-gray-500">{actionsHint}</div>

          {isCancelled && (wo.cancelReason || wo.cancelNote) ? (
            <div className="mt-3 rounded-2xl bg-red-50 border border-red-200 p-3">
              <div className="text-xs font-semibold text-red-700">{t("job.cancel.title")}</div>

              {wo.cancelReason ? (
                <div className="mt-1 text-sm text-red-900">
                  <span className="font-medium">{t("job.cancel.reason")}:</span> {wo.cancelReason}
                </div>
              ) : null}

              {wo.cancelNote ? <div className="mt-1 text-xs text-red-800 opacity-80">{wo.cancelNote}</div> : null}

              {wo.cancelledAt ? <div className="mt-1 text-[11px] text-red-600">{fmt(wo.cancelledAt)}</div> : null}
            </div>
          ) : null}

          {info ? (
            <div className="mt-3 rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">{info}</div>
          ) : null}

          {err ? (
            <div className="mt-3 rounded-2xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">{t(err)}</div>
          ) : null}
        </div>
      </div>

      {/* Actions */}
      <div className="rounded-3xl bg-white border border-black/5 shadow-sm">
        <div className="p-4">
          <div className="text-sm font-semibold">{t("job.actions.title")}</div>
          <div className="mt-3 grid grid-cols-1 gap-2">
            {canStart ? (
              <button
                disabled={busy !== null}
                onClick={onStart}
                className="rounded-2xl bg-black text-white px-4 py-3 text-sm font-semibold shadow-sm disabled:opacity-60"
              >
                {busy === "start" ? t("job.actions.start_busy") : t("job.actions.start")}
              </button>
            ) : null}

            {canCancel ? (
              <button
                disabled={busy !== null}
                onClick={onCancel}
                className="rounded-2xl bg-red-600 text-white px-4 py-3 text-sm font-semibold shadow-sm disabled:opacity-60"
              >
                {busy === "cancel" ? t("job.actions.cancel_busy") : t("job.actions.cancel")}
              </button>
            ) : null}

            {canComplete ? (
              <button
                disabled={busy !== null}
                onClick={onComplete}
                className="rounded-2xl bg-emerald-600 text-white px-4 py-3 text-sm font-semibold shadow-sm disabled:opacity-60"
              >
                {busy === "complete" ? t("job.actions.complete_busy") : t("job.actions.complete")}
              </button>
            ) : null}

            {!canStart && !canComplete && !canCancel ? (
              <div className="rounded-2xl bg-gray-50 border border-black/5 p-3 text-xs text-gray-600">{t("job.actions.disabled")}</div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Photos */}
      <div className="rounded-3xl bg-white border border-black/5 shadow-sm">
        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">{t("job.photos.title")}</div>

            {canAddPhoto ? (
              <div className="flex gap-2">
                <button
                  disabled={busy !== null}
                  onClick={() => inputBeforeRef.current?.click()}
                  className="rounded-2xl bg-white border border-black/10 px-3 py-2 text-xs font-semibold shadow-sm disabled:opacity-60"
                >
                  {busy === "upload_before" ? t("common.uploading") : t("job.photos.add_before")}
                </button>
                <button
                  disabled={busy !== null}
                  onClick={() => inputAfterRef.current?.click()}
                  className="rounded-2xl bg-white border border-black/10 px-3 py-2 text-xs font-semibold shadow-sm disabled:opacity-60"
                >
                  {busy === "upload_after" ? t("common.uploading") : t("job.photos.add_after")}
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-gray-500">{isLocked ? t("job.photos.locked") : t("job.photos.need_in_progress")}</div>
            )}
          </div>

          <input
            ref={inputBeforeRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onUpload("before", e.target.files?.[0] ?? null)}
          />
          <input
            ref={inputAfterRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onUpload("after", e.target.files?.[0] ?? null)}
          />

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-semibold text-gray-700">{t("job.photos.before")}</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {photosBefore.length ? (
                  photosBefore.map((p) => {
                    const url = toPublicUrl(p.storageKey);
                    return (
                      <div key={p.id} className="relative overflow-hidden rounded-2xl border border-black/10 bg-gray-50" title={fmt(p.takenAt)}>
                        <a href={url} target="_blank" rel="noreferrer" className="block">
                          <img src={url} alt="before" className="h-24 w-full object-cover" />
                        </a>

                        {!isLocked ? (
                          <button
                            disabled={busy !== null}
                            onClick={() => onDeletePhoto(p.id)}
                            className="absolute right-2 top-2 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold shadow disabled:opacity-60"
                          >
                            {busy === "delete_photo" ? t("common.working") : t("common.delete")}
                          </button>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-[11px] text-gray-500">{t("common.none_yet")}</div>
                )}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-700">{t("job.photos.after")}</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {photosAfter.length ? (
                  photosAfter.map((p) => {
                    const url = toPublicUrl(p.storageKey);
                    return (
                      <div key={p.id} className="relative overflow-hidden rounded-2xl border border-black/10 bg-gray-50" title={fmt(p.takenAt)}>
                        <a href={url} target="_blank" rel="noreferrer" className="block">
                          <img src={url} alt="after" className="h-24 w-full object-cover" />
                        </a>

                        {!isLocked ? (
                          <button
                            disabled={busy !== null}
                            onClick={() => onDeletePhoto(p.id)}
                            className="absolute right-2 top-2 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold shadow disabled:opacity-60"
                          >
                            {busy === "delete_photo" ? t("common.working") : t("common.delete")}
                          </button>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-[11px] text-gray-500">{t("common.none_yet")}</div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-gray-500">{t("job.photos.note_lock")}</div>
        </div>
      </div>

      {/* Payment */}
      <div className="rounded-3xl bg-white border border-black/5 shadow-sm">
        <div className="p-4">
          <div className="text-sm font-semibold">{t("job.payment.title")}</div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder={t("job.payment.amount_placeholder")}
              className="rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none"
              disabled={!canPay || busy !== null}
            />

            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
              className="rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none"
              disabled={!canPay || busy !== null}
            >
              <option value="cash">{t("payment.method.cash")}</option>
              <option value="transfer">{t("payment.method.transfer")}</option>
              <option value="pos_later">{t("payment.method.pos_later")}</option>
            </select>
          </div>

          <button
            disabled={!canPay || busy !== null}
            onClick={onPay}
            className="mt-2 w-full rounded-2xl bg-black text-white px-4 py-3 text-sm font-semibold shadow-sm disabled:opacity-60"
          >
            {busy === "pay" ? t("common.saving") : t("job.payment.save")}
          </button>

          <div className="mt-3 space-y-2">
            {payments.length ? (
              payments.map((p) => (
                <div key={p.id} className="rounded-2xl bg-gray-50 border border-black/5 p-3 text-xs">
                  <div className="font-semibold">
                    {p.amount} {p.currency} • {p.method} • {p.status}
                  </div>
                  <div className="text-gray-600 mt-1">{fmt(p.paidAt)}</div>
                </div>
              ))
            ) : (
              <div className="text-[11px] text-gray-500">{t("job.payment.none_yet")}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
