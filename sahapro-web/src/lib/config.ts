// src/lib/config.ts

function envOrFallback(name: string, fallback: string) {
  const v = (process.env[name] ?? "").trim();
  return v.length ? v : fallback;
}

// API base (env boş string gelirse de fallback çalışsın)
export const API_BASE = envOrFallback("NEXT_PUBLIC_API_BASE", "http://127.0.0.1:5235")
  // bazen localhost yazıyorsun; node-fetch/next bazen garip davranıyor -> sabitle
  .replace("http://localhost", "http://127.0.0.1")
  .replace("https://localhost", "https://127.0.0.1")
  // sonda slash varsa temizle
  .replace(/\/+$/, "");

console.log("[CONFIG] NEXT_PUBLIC_API_BASE =", process.env.NEXT_PUBLIC_API_BASE);
console.log("[CONFIG] API_BASE =", API_BASE);

// TEST ids (env boş string gelirse de fallback çalışsın)
export const TEST_TENANT_ID = envOrFallback(
  "NEXT_PUBLIC_TEST_TENANT_ID",
  "1e0140bf-d9e4-42ae-bb7a-86a7b4ecbc2d"
);

export const TEST_TECH_USER_ID = envOrFallback(
  "NEXT_PUBLIC_TEST_TECH_USER_ID",
  "8a2b9558-634b-4777-bc94-b5ba7c651257"
);
