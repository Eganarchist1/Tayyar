import { RouteLoadingShell } from "@/components/RouteLoadingShell";

export default function BranchLoading() {
  return (
    <RouteLoadingShell
      role="BRANCH_MANAGER"
      title={{ ar: "جاري تحميل الفرع", en: "Loading branch" }}
      subtitle={{ ar: "يتم تجهيز الطلبات وحالة التشغيل.", en: "Preparing branch orders and operating status." }}
      compact
    />
  );
}
