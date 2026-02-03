"use client";

import RequireAuth from "@/components/RequireAuth";
import JobDetailClient from "./ui";
import { useParams } from "next/navigation";

export default function JobDetailPage() {
  const params = useParams();
  const id = (params?.id as string | undefined) ?? "";

  // Next bazen ilk render'da params boş dönebiliyor: patlatma, bekle
  if (!id) return null;

  return (
    <RequireAuth>
      <JobDetailClient workOrderId={id} />
    </RequireAuth>
  );
}
