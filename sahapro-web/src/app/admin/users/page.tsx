"use client";

import { useEffect, useMemo, useState } from "react";
import { u, fetchJson } from "@/lib/http";
import RequireAuth from "@/components/RequireAuth";
import { useT } from "@/lib/i18n/useT";

type UserRow = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  role: string;
  status: string;
  forcePasswordChange: boolean;
  createdAt: string;
};

type CreateUserRequest = {
  fullName: string;
  phone: string;
  role: string;
  email?: string | null;
};

type CreateUserResponse = {
  id: string;
  tempPassword: string;
};

type ResetPasswordResponse = {
  id: string;
  tempPassword: string;
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] text-gray-500 mb-1">{children}</div>;
}

async function listUsers(q?: string) {
  const qs = new URLSearchParams();
  if ((q ?? "").trim()) qs.set("q", (q ?? "").trim());
  const url = u(`/api/owner/users${qs.toString() ? `?${qs.toString()}` : ""}`);
  return await fetchJson<UserRow[]>(url);
}

async function createUser(body: CreateUserRequest) {
  const url = u(`/api/owner/users`);
  return await fetchJson<CreateUserResponse>(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function resetPassword(id: string) {
  const url = u(`/api/owner/users/${id}/reset-password`);
  return await fetchJson<ResetPasswordResponse>(url, {
    method: "POST",
  });
}

async function patchUser(
  id: string,
  body: { fullName?: string | null; role?: string | null; status?: string | null }
) {
  const url = u(`/api/owner/users/${id}`);
  return await fetchJson<any>(url, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export default function AdminUsersPage() {
  const { t, lang } = useT();

  const ROLE_OPTIONS = useMemo(
    () => [
      { value: "admin", label: "Admin" },
      { value: "dispatcher", label: "Dispatcher" },
      { value: "sales", label: "Sales" },
      { value: "tech", label: "Tech" },
    ],
    []
  );

  const STATUS_OPTIONS = useMemo(
    () => [
      { value: "active", label: "Active" },
      { value: "passive", label: "Passive" },
    ],
    []
  );

  function fmt(dt?: string | null) {
    if (!dt) return "-";
    const d = new Date(dt);
    const locale = lang === "en" ? "en-US" : "tr-TR";
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }

  const [q, setQ] = useState("");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // create modal
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("tech");

  const canSubmit = useMemo(() => {
    return fullName.trim().length >= 2 && phone.trim().length >= 8 && role.trim().length > 0;
  }, [fullName, phone, role]);

  async function reload(term?: string) {
    setLoading(true);
    setErr(null);
    try {
      const data = await listUsers(term ?? q);
      setRows(data);
    } catch (e: any) {
      setErr(e?.message ?? "list_failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSearch() {
    await reload(q);
  }

  async function onCreate() {
    if (!canSubmit) return;

    try {
      setErr(null);
      setInfo(null);
      setBusy("create");

      const resp = await createUser({
        fullName: fullName.trim(),
        phone: phone.trim(),
        role: role.trim(),
        email: email.trim() ? email.trim().toLowerCase() : null,
      });

      setOpen(false);
      setFullName("");
      setPhone("");
      setEmail("");
      setRole("tech");

      setInfo(t("admin.users.created_ok").replace("{{p}}", resp.tempPassword));
      await reload(q);
    } catch (e: any) {
      setErr(e?.message ?? "create_failed");
    } finally {
      setBusy(null);
    }
  }

  async function onReset(id: string) {
    const ok = confirm(t("admin.users.reset_confirm"));
    if (!ok) return;

    try {
      setErr(null);
      setInfo(null);
      setBusy(`reset:${id}`);

      const resp = await resetPassword(id);
      setInfo(t("admin.users.reset_ok").replace("{{p}}", resp.tempPassword));
      await reload(q);
    } catch (e: any) {
      setErr(e?.message ?? "reset_failed");
    } finally {
      setBusy(null);
    }
  }

  async function onRoleChange(id: string, value: string) {
    try {
      setErr(null);
      setInfo(null);
      setBusy(`patch:${id}`);

      await patchUser(id, { role: value });
      await reload(q);
    } catch (e: any) {
      setErr(e?.message ?? "update_failed");
    } finally {
      setBusy(null);
    }
  }

  async function onStatusChange(id: string, value: string) {
    try {
      setErr(null);
      setInfo(null);
      setBusy(`patch:${id}`);

      await patchUser(id, { status: value });
      await reload(q);
    } catch (e: any) {
      setErr(e?.message ?? "update_failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <RequireAuth>
      <div className="space-y-3">
        <div className="rounded-3xl bg-white border border-black/5 shadow-sm">
          <div className="p-4 flex items-center justify-between gap-2">
            <div>
              <div className="text-base font-semibold">{t("admin.users.title")}</div>
              <div className="text-xs text-gray-500">{t("admin.users.subtitle")}</div>
            </div>

            <button
              onClick={() => setOpen(true)}
              className="rounded-2xl bg-black text-white px-4 py-2 text-sm font-semibold shadow-sm"
            >
              + {t("admin.users.new")}
            </button>
          </div>

          <div className="px-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("admin.users.search_placeholder")}
                className="rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none"
              />
              <button
                onClick={onSearch}
                disabled={loading || busy !== null}
                className="rounded-2xl bg-white border border-black/10 px-4 py-3 text-sm font-semibold shadow-sm disabled:opacity-60"
              >
                {loading ? t("admin.users.loading") : t("admin.users.search")}
              </button>
            </div>

            {info ? (
              <div className="mt-3 rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                {info}
              </div>
            ) : null}

            {err ? (
              <div className="mt-3 rounded-2xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                {err}
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-black/5 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-black/5 flex items-center justify-between">
            <div className="text-sm font-semibold">{t("admin.users.list_title")}</div>
            <div className="text-xs text-gray-500">
              {t("admin.users.count").replace("{{n}}", String(rows.length))}
            </div>
          </div>

          {loading ? (
            <div className="p-4 text-sm text-gray-600">{t("admin.users.loading")}</div>
          ) : rows.length === 0 ? (
            <div className="p-4 text-sm text-gray-600">{t("admin.users.no_users")}</div>
          ) : (
            <div className="divide-y">
              {rows.map((r) => (
                <div key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{r.fullName}</div>
                      <div className="mt-1 text-xs text-gray-600">
                        {r.phone ?? "-"} • {r.email ?? "-"}
                      </div>
                      <div className="mt-1 text-[11px] text-gray-500">
                        {fmt(r.createdAt)}{" "}
                        {r.forcePasswordChange ? `• ${t("admin.users.force_password_change")}` : ""}
                      </div>
                    </div>

                    <button
                      disabled={busy !== null}
                      onClick={() => onReset(r.id)}
                      className="shrink-0 rounded-2xl bg-white border border-black/10 px-3 py-2 text-xs font-semibold shadow-sm disabled:opacity-60"
                    >
                      {busy === `reset:${r.id}` ? t("common.working") : t("admin.users.reset_password")}
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div>
                      <FieldLabel>{t("admin.users.role")}</FieldLabel>
                      <select
                        value={r.role}
                        disabled={busy !== null}
                        onChange={(e) => onRoleChange(r.id, e.target.value)}
                        className="w-full rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none disabled:opacity-60"
                      >
                        {ROLE_OPTIONS.map((x) => (
                          <option key={x.value} value={x.value}>
                            {x.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <FieldLabel>{t("admin.users.status")}</FieldLabel>
                      <select
                        value={r.status}
                        disabled={busy !== null}
                        onChange={(e) => onStatusChange(r.id, e.target.value)}
                        className="w-full rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none disabled:opacity-60"
                      >
                        {STATUS_OPTIONS.map((x) => (
                          <option key={x.value} value={x.value}>
                            {x.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal */}
        {open ? (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <button className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-label="Close" />

            <div className="relative w-full max-w-lg rounded-3xl bg-white border border-black/10 shadow-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-base font-semibold">{t("admin.users.create.title")}</div>
                  <div className="text-xs text-gray-500">{t("admin.users.create.subtitle")}</div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-black/10 px-3 py-2 text-sm"
                >
                  {t("common.close")}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3">
                <div>
                  <FieldLabel>{t("admin.users.create.full_name")}</FieldLabel>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none"
                    placeholder="e.g. Ahmet Yılmaz"
                  />
                </div>

                <div>
                  <FieldLabel>{t("admin.users.create.phone")}</FieldLabel>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none"
                    placeholder="e.g. 0555 000 00 00"
                  />
                </div>

                <div>
                  <FieldLabel>{t("admin.users.create.email")}</FieldLabel>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none"
                    placeholder="e.g. user@company.com"
                  />
                </div>

                <div>
                  <FieldLabel>{t("admin.users.create.role")}</FieldLabel>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full rounded-2xl border border-black/10 px-4 py-3 text-sm outline-none"
                  >
                    {ROLE_OPTIONS.map((x) => (
                      <option key={x.value} value={x.value}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  disabled={!canSubmit || busy !== null}
                  onClick={onCreate}
                  className="mt-1 w-full rounded-2xl bg-black text-white px-4 py-3 text-sm font-semibold shadow-sm disabled:opacity-60"
                >
                  {busy === "create" ? t("admin.users.create.submitting") : t("admin.users.create.submit")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </RequireAuth>
  );
}
