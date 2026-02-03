// src/lib/http.ts
import { readSession } from "./sessions";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, "") || "http://127.0.0.1:5235";

export function u(path: string) {
  if (!path.startsWith("/")) path = `/${path}`;
  return `${API_BASE}${path}`;
}

type FetchJsonOptions = RequestInit & {
  // true => Authorization koyma (login gibi)
  noAuth?: boolean;
};

function isJsonContentType(ct: string | null) {
  return (ct ?? "").toLowerCase().includes("application/json");
}

function normalizeErrorCode(status: number, msg: string) {
  const m = (msg ?? "").trim();

  // backend zaten string code dönüyorsa onu kullan (tenant_required vs)
  if (m && !/^\d+$/.test(m) && m.length <= 80 && !m.startsWith("<")) return m;

  // status bazlı stabil kodlar
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  return "unknown_error";
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const headers = new Headers(options.headers || {});

  // JSON body gönderiyorsak default content-type
  const hasBody = options.body != null;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (hasBody && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // ✅ Authorization (default açık) — tek kaynak: sessions
  if (!options.noAuth) {
    const s = readSession();
    const token = s?.token;
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const contentType = res.headers.get("content-type");
    let bodyText = "";
    let msg = `${res.status}`;

    try {
      if (isJsonContentType(contentType)) {
        const j: any = await res.json().catch(() => null);
        if (typeof j === "string") msg = j || msg;
        else if (j && typeof j === "object") msg = j.message || j.error || JSON.stringify(j);
        else msg = `${res.status}`;
        bodyText = j ? (typeof j === "string" ? j : JSON.stringify(j)) : "";
      } else {
        bodyText = await res.text().catch(() => "");
        msg = bodyText || msg;
      }
    } catch {
      // ignore
    }

    const code = normalizeErrorCode(res.status, msg);

    const err: any = new Error(code);
    err.code = code; // ✅ UI artık err.message yerine err.code okuyabilir
    err.status = res.status;
    err.statusText = res.statusText;
    err.url = url;
    err.body = bodyText || msg;
    throw err;
  }

  // ✅ 204 / boş response ihtimali
  if (res.status === 204) return null as unknown as T;

  const contentType = res.headers.get("content-type");
  if (isJsonContentType(contentType)) {
    return (await res.json()) as T;
  }

  return (await res.text()) as unknown as T;
}
