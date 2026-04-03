import { RouteLoadingShell } from "@/components/RouteLoadingShell";

export default function SupervisorLoading() {
  return (
    <RouteLoadingShell
      role="SUPERVISOR"
      title={{ ar: "جاري تحميل الإشراف", en: "Loading supervision" }}
      subtitle={{ ar: "يتم تجهيز الخريطة والتنبيهات.", en: "Preparing the map and alerts." }}
      compact
    />
  );
}
