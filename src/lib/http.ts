// src/lib/http.ts
import { getToken } from "./auth";

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

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const headers = new Headers(options.headers || {});

  // JSON body gönderiyorsak default content-type
  const hasBody = options.body != null;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (hasBody && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // ✅ Authorization (default açık)
  if (!options.noAuth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });

  // ✅ Hata durumunda: body'yi oku, status bilgilerini Error üstüne ekle
  if (!res.ok) {
    const contentType = res.headers.get("content-type");
    let bodyText = "";
    let msg = `${res.status}`;

    try {
      if (isJsonContentType(contentType)) {
        const j: any = await res.json().catch(() => null);
        // backend bazen düz string, bazen {message:""} döndürebilir
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

    const err: any = new Error(msg);
    err.status = res.status;
    err.statusText = res.statusText;
    err.url = url;
    err.body = bodyText || msg; // UI debug için
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
