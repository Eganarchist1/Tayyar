import { RouteLoadingShell } from "@/components/RouteLoadingShell";

export default function MerchantGroupLoading() {
  return (
    <RouteLoadingShell
      role="MERCHANT_OWNER"
      title={{ ar: "جاري تحميل الحساب", en: "Loading workspace" }}
      subtitle={{ ar: "يتم تجهيز الطلبات والرصيد والفروع.", en: "Preparing orders, balance, and branches." }}
    />
  );
}
