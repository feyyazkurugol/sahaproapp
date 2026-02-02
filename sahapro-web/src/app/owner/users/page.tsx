"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { readSession } from "@/lib/sessions";
import { useT } from "@/lib/i18n/useT";

export default function OwnerUsersPage() {
  const { t } = useT();
  const router = useRouter();

  useEffect(() => {
    const s = readSession();
    if (!s || s.role !== "owner") {
      router.replace("/");
    }
  }, [router]);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">
        {t("navItems.ownerUsers")}
      </h1>

      <div className="text-sm text-gray-600">
        {/* burası birazdan dolacak */}
        Kullanıcı yönetimi buraya gelecek.
      </div>
    </div>
  );
}
