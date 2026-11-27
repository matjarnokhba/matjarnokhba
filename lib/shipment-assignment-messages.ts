/** رسائل رفض الإسناد (نتيجة resolveAccess) بالعربية. */
export function assignmentDeniedMessage(reason: string): string {
  switch (reason) {
    case "NOT_FOUND":
      return "المنصة أو شركة التوصيل غير موجودة";
    case "NO_LINK":
      return "لا يوجد ربط بين شركة التوصيل والمنصة";
    case "LINK_PAUSED":
      return "الربط بين شركة التوصيل والمنصة موقوف مؤقتاً";
    case "LINK_REVOKED":
      return "تم إلغاء الربط بين شركة التوصيل والمنصة";
    case "EXTERNAL_NOT_ALLOWED":
      return "شركة التوصيل لا تقبل المنصات الخارجية";
    default:
      if (reason.startsWith("PLATFORM_")) return "المنصة غير مفعّلة";
      if (reason.startsWith("COMPANY_")) return "شركة التوصيل موقوفة أو غير مفعّلة";
      if (reason.startsWith("LINK_")) return "الربط بين شركة التوصيل والمنصة غير نشط";
      return "غير مسموح بإنشاء الشحنة لهذه الجهة";
  }
}