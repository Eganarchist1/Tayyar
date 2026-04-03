import type { AuditEventRecord, DuplicateCustomerCandidate, OperationalAlertItem } from "@tayyar/types";

export function localizeAlertTitle(alert: OperationalAlertItem, locale: "ar" | "en") {
  switch (alert.titleCode) {
    case "billing.failure.title":
      return locale === "ar" ? "مشكلة مالية" : "Billing issue";
    case "orders.unassigned.title":
      return locale === "ar" ? "طلب بدون إسناد" : "Unassigned order";
    case "branches.coordinates.title":
      return locale === "ar" ? "موقع الفرع محتاج مراجعة" : "Branch location needs review";
    case "geocode.fallback.title":
      return locale === "ar" ? "العنوان محتاج تأكيد" : "Address needs confirmation";
    case "location_request.failed.title":
      return locale === "ar" ? "فشل طلب الموقع" : "Location request failed";
    default:
      return locale === "ar" ? "تنبيه تشغيلي" : "Operational alert";
  }
}

export function localizeAlertMessage(alert: OperationalAlertItem, locale: "ar" | "en") {
  const metadata = (alert.metadata || {}) as Record<string, unknown>;
  switch (alert.messageCode) {
    case "billing.failure.message":
      return locale === "ar"
        ? `فيه معاملة فاشلة مرتبطة بـ ${String(metadata.orderNumber || metadata.merchantName || "السجل")}.`
        : `A failed transaction is linked to ${String(metadata.orderNumber || metadata.merchantName || "this record")}.`;
    case "orders.unassigned.message":
      return locale === "ar"
        ? `الطلب ${String(metadata.orderNumber || "")} لسه من غير طيار في ${String(metadata.zoneName || "المنطقة")}.`
        : `Order ${String(metadata.orderNumber || "")} is still waiting for a hero in ${String(metadata.zoneName || "the zone")}.`;
    case "branches.coordinates.message":
      return locale === "ar"
        ? `إحداثيات ${String(metadata.branchName || "الفرع")} افتراضية وعايزة تثبيت.`
        : `${String(metadata.branchName || "This branch")} is still using default coordinates.`;
    case "geocode.fallback.message":
      return locale === "ar"
        ? `العنوان "${String(metadata.query || "")}" رجّع نتيجة تقريبية وعايز مراجعة.`
        : `The address "${String(metadata.query || "")}" fell back to an approximate result and needs review.`;
    case "location_request.failed.message":
      return locale === "ar"
        ? `تعذر إرسال طلب موقع للرقم ${String(metadata.customerPhone || "")}.`
        : `The location request could not be sent to ${String(metadata.customerPhone || "")}.`;
    default:
      return locale === "ar" ? "راجع التنبيه واتصرف." : "Review this alert and take action.";
  }
}

export function localizeAuditAction(action: string, locale: "ar" | "en") {
  switch (action) {
    case "MERCHANT_ONBOARDED":
      return locale === "ar" ? "إضافة تاجر جديد" : "Merchant onboarded";
    case "MERCHANT_CREATED":
      return locale === "ar" ? "إنشاء تاجر" : "Merchant created";
    case "MERCHANT_UPDATED":
      return locale === "ar" ? "تعديل بيانات التاجر" : "Merchant updated";
    case "BRANCH_CREATED":
      return locale === "ar" ? "إضافة فرع" : "Branch created";
    case "BRANCH_UPDATED":
      return locale === "ar" ? "تعديل بيانات الفرع" : "Branch updated";
    case "BRANCH_MANAGER_REASSIGNED":
      return locale === "ar" ? "تغيير مدير الفرع" : "Branch manager reassigned";
    case "CUSTOMER_UPDATED":
      return locale === "ar" ? "تعديل بيانات العميل" : "Customer updated";
    default:
      return locale === "ar" ? "تحديث إداري" : "Admin update";
  }
}

export function auditSummaryLine(event: AuditEventRecord, locale: "ar" | "en") {
  const summary = (event.summary || {}) as Record<string, unknown>;
  if (summary.branchId && event.action === "MERCHANT_ONBOARDED") {
    return locale === "ar" ? "تم إنشاء التاجر وأول فرع." : "Merchant and first branch were created.";
  }
  if (summary.managerChanged) {
    return locale === "ar" ? "تم تعديل مدير الفرع." : "Branch manager was changed.";
  }
  if (summary.phoneChanged) {
    return locale === "ar" ? "تم تحديث رقم العميل." : "Customer phone was updated.";
  }
  if (typeof summary.toggledActive === "boolean") {
    return locale === "ar"
      ? summary.toggledActive
        ? "تم تفعيل السجل."
        : "تم إيقاف السجل."
      : summary.toggledActive
        ? "Record was activated."
        : "Record was paused.";
  }
  return locale === "ar" ? "تم حفظ تعديل إداري." : "Administrative changes were saved.";
}

export function duplicateReasonLabel(reason: string, locale: "ar" | "en") {
  switch (reason) {
    case "same_phone":
      return locale === "ar" ? "نفس الرقم" : "Same phone";
    case "similar_name":
      return locale === "ar" ? "اسم قريب" : "Similar name";
    case "address_overlap":
      return locale === "ar" ? "عنوان قريب" : "Address overlap";
    default:
      return locale === "ar" ? "تشابه" : "Similarity";
  }
}

export function duplicateConfidenceLabel(candidate: DuplicateCustomerCandidate, locale: "ar" | "en") {
  switch (candidate.confidence) {
    case "high":
      return locale === "ar" ? "تشابه عالي" : "High confidence";
    case "medium":
      return locale === "ar" ? "تشابه متوسط" : "Medium confidence";
    default:
      return locale === "ar" ? "تشابه محدود" : "Low confidence";
  }
}
