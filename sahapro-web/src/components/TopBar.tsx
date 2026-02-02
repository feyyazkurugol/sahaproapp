"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, getSession } from "@/lib/auth";

export default function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const session = getSession();

  // login sayfasında bar göstermeyelim
  if (!session) return null;
  if (pathname.startsWith("/login")) return null;

  function onLogout() {
    clearSession();
    router.replace("/login");
  }

  return (
    <div className="w-full border-b bg-white">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold">
          SahaPro
        </Link>

        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-600">
            {session.fullName ?? session.role}
          </div>

          <button
            onClick={onLogout}
            className="text-sm px-3 py-2 rounded bg-black text-white"
          >
            Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  );
}
