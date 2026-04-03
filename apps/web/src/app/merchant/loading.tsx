import { RouteLoadingShell } from "@/components/RouteLoadingShell";

export default function MerchantRoutesLoading() {
  return (
    <RouteLoadingShell
      role="MERCHANT_OWNER"
      title={{ ar: "جاري تحميل بيانات التاجر", en: "Loading merchant" }}
      subtitle={{ ar: "يتم تجهيز الطلبات والعملاء والفروع.", en: "Preparing orders, customers, and branches." }}
    />
  );
}
