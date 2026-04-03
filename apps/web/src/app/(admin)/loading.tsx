import { RouteLoadingShell } from "@/components/RouteLoadingShell";

export default function AdminGroupLoading() {
  return (
    <RouteLoadingShell
      role="ADMIN"
      title={{ ar: "جاري تحميل الإدارة", en: "Loading admin" }}
      subtitle={{ ar: "يتم تجهيز بيانات التشغيل والتنبيهات.", en: "Preparing operations and alerts." }}
    />
  );
}
