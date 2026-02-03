"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import { readSession } from "@/lib/sessions";
import JobsHome from "./ui";

export default function JobsPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    setMounted(true);

    const s = readSession();
    if (!s) return;

    // ✅ tech dışındaki herkes dispatch'e
    if (s.role !== "tech") {
      setRedirecting(true);
      router.replace("/dispatch");
      return;
    }

    setRedirecting(false);
  }, [router]);

  // ✅ redirect sırasında JobsHome render olmasın (flash + gereksiz fetch engeli)
  if (!mounted || redirecting) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">İşlerim</h1>
        <p className="mt-2 text-sm text-gray-600">
          {redirecting ? "Yönlendiriliyor..." : "Yükleniyor..."}
        </p>
      </div>
    );
  }

  return (
    <RequireAuth>
      <JobsHome />
    </RequireAuth>
  );
}
