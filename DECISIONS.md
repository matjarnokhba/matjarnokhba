# DECISIONS.md

# متجر نخبة — Engineering Decisions

**Version:** 3.3
**Status:** Final Architecture Reference + Implementation Status
**Last Updated:** 2026-10-10
**Currency:** MAD
**Database:** PostgreSQL
**ORM:** Prisma
**Framework:** Next.js 16 App Router
**Runtime:** Node.js
**Deployment:** Vercel
**Database Provider:** Neon

---

# 0. Purpose

هذا الملف هو المرجع الأساسي للقرارات الهندسية والتجارية لنظام متجر نخبة.

أي كود أو Schema أو Migration أو Service أو API يجب أن يتوافق مع هذه الوثيقة.

عند وجود تعارض بين التنفيذ وهذه الوثيقة:

1. لا يتم تجاهل القرار.
2. لا يتم تغيير السلوك بصمت.
3. يجب تعديل `DECISIONS.md` أولًا.
4. بعد اعتماد التعديل يتم تعديل الكود وSchema وMigration عند الحاجة.

هذه الوثيقة لا تعتبر مجرد Documentation، بل تمثل **مصدر الحقيقة المعماري للمشروع**.

**ملاحظة (v2.3):** هذا الملف يوثّق البنية المعمارية المثالية للـMVP. للاطلاع على **ما تم تنفيذه فعلاً** حتى الآن، راجع:
**القسم 76 — Implementation Status**

---

# 1. Product Vision

متجر نخبة هو متجر إلكتروني حقيقي قابل للتوسع.

الإصدار الحالي:

* Single Seller
* Customer Accounts
* Products
* Categories
* Product Variants
* Inventory
* Cart
* Orders
* COD
* Shipping Zones
* Coupons
* Returns
* Reviews
* Notifications
* Audit Logs
* Admin Dashboard

البنية مصممة منذ البداية بحيث يمكن الانتقال لاحقًا إلى Multi-Vendor دون إعادة بناء النظام الأساسي.

---

# 2. MVP Scope

## 2.1 Included

يجب أن يدعم MVP:

* المنتجات
* التصنيفات
* البحث الأساسي
* الفلاتر
* Product Variants
* Cart
* Guest Cart
* Customer Account
* Addresses
* Orders
* Order Tracking
* COD
* Inventory
* Reservations
* Order-level Coupons
* Shipping Zones
* Returns
* Reviews
* Notifications
* Audit Logs
* Admin Dashboard
* Seller entity
* Inventory movements

## 2.2 Deferred

هذه العناصر ليست ضمن MVP:

* Multi-Vendor الكامل
* Electronic Payments
* Shipping API
* Email
* SMS
* Queue infrastructure
* External Search Engine
* Multi-Currency
* Advanced VAT
* Advanced Analytics
* CDN optimization
* Redis
* Refund Admin Override

---

# 3. Architecture

## 3.1 Application

* Next.js 16
* App Router
* React
* Tailwind CSS
* TypeScript

## 3.2 Backend

يستخدم التطبيق:

* Server Actions
* API Routes
* Services Layer
* Prisma Data Access

Business Logic لا يوضع داخل UI components.

## 3.3 Database

PostgreSQL على Neon.

Prisma هو ORM الأساسي.

Prisma Schema يمثل:

* Models
* Relations
* Enums
* Unique constraints
* Standard indexes

أما القيود التي لا يدعمها Prisma مباشرة، فتضاف داخل SQL migrations يدوية.

## 3.4 Source of Truth

Server هو المصدر الوحيد للحقيقة بالنسبة إلى:

* الأسعار
* المخزون
* الخصومات
* الإجماليات
* حالة الطلب
* صلاحيات المستخدم
* Reservations
* Coupons
* Returns
* Refunds

لا يجوز للعميل إرسال قيمة مالية موثوقة إلى Server.

---

# 4. Business Rules

## 4.1 Users

User roles:

```text
CUSTOMER
ADMIN
SUPER_ADMIN
```

الـCustomer لا يحصل على صلاحيات إدارية.

Seller ليس Role للمستخدم، بل كيان تجاري مستقل مرتبط بالمستخدم.

---

# 4.2 Seller

Seller statuses:

```text
PENDING
ACTIVE
SUSPENDED
CLOSED
```

## PENDING

* لا يمكن إنشاء منتجات.
* لا يمكن استقبال الطلبات.

## ACTIVE

* يمكن إنشاء المنتجات.
* يمكن تعديل المنتجات.
* يمكن استقبال الطلبات.

## SUSPENDED

* لا يمكن إنشاء المنتجات.
* لا يمكن تعديل المنتجات.
* لا يمكن استقبال الطلبات.
* جميع منتجات Seller تصبح `INACTIVE` تلقائيًا.

إعادة Seller من `SUSPENDED` إلى `ACTIVE` لا تعيد المنتجات تلقائيًا إلى `ACTIVE`.

## CLOSED

* لا يمكن إنشاء المنتجات.
* لا يمكن تعديل المنتجات.
* لا يمكن استقبال الطلبات.
* جميع المنتجات تصبح `INACTIVE`.
* البيانات التاريخية تبقى محفوظة.

Seller لا يحتوي حاليًا على `deletedAt`.

إذا تمت إضافة Soft Delete مستقبلًا، يجب تعديل Public Product Query وفقًا لذلك.

---

# 4.3 Public Product Query

أي Query عام للمنتجات يجب أن يفرض:

```text
Product.status = ACTIVE
Product.deletedAt IS NULL
Seller.status = ACTIVE
```

لا يجوز عرض منتج عام إذا كان Seller غير `ACTIVE`.

---

# 4.4 Product

Product يمثل المنتج المنطقي وليس الوحدة التي تحمل السعر النهائي للبيع.

Product لا يحتوي:

```text
price
discountPrice
sku
stock
```

هذه البيانات مرتبطة بالـProductVariant.

Product يدعم Soft Delete:

```text
deletedAt
```

لا يوجد Hard Delete للمنتج إذا كان مرتبطًا ببيانات تاريخية.

---

# 4.5 Product Variant

ProductVariant هو الوحدة الفعلية القابلة للبيع.

يحتوي:

```text
id
productId
sku
price
discountPrice
isDefault
isActive
optionsHash
createdAt
updatedAt
```

القواعد:

* SKU unique.
* كل Product يجب أن يحتوي Variant واحدًا على الأقل.
* إذا لم توجد Options:

  * يجب وجود Variant واحد فقط.
  * يجب أن يكون Default.
* إذا كانت هناك Options:

  * كل Variant يجب أن يحتوي قيمة واحدة من كل Option مطلوبة.
  * لا توجد قيم إضافية.
  * لا توجد تركيبات مكررة.
* لا يمكن حذف آخر Variant.
* لا يمكن حذف Default Variant بدون تعيين Default بديل.

`discountPrice`:

```text
NULL
OR
0 < discountPrice < price
```

يتم فرض ذلك في Service + DB CHECK.

---

# 4.6 Product Options

ProductOption:

```text
id
productId
name
order
```

Unique:

```text
(productId, name)
```

ProductOptionValue:

```text
id
optionId
value
order
```

Unique:

```text
(optionId, value)
```

ProductVariantOptionValue:

```text
id
variantId
optionValueId
```

Unique:

```text
(variantId, optionValueId)
```

في MVP جميع ProductOptions تعتبر required.

---

# 4.7 Orders and Returns

## Order Creation

Server يستقبل فقط:

* variantId
* quantity
* shippingAddressId أو new address
* couponCode
* paymentMethod
* idempotencyKey

Client لا يرسل:

* userId
* price
* discount
* subtotal
* shippingCost
* taxAmount
* total

Server يحسب جميع القيم.

---

## Order Price

عند إنشاء الطلب:

```text
OrderItem.unitPrice
```

يأخذ السعر الحالي من ProductVariant.

لا يوجد رفض للطلب بسبب تغير السعر بعد وضع المنتج في Cart.

لا يوجد price snapshot داخل Cart.

OrderItem يحتفظ بالسعر التاريخي.

---

## Order Status

الحالات:

```text
NEW
PROCESSING
SHIPPED
DELIVERED
CANCELLED
RETURNED
```

الانتقالات:

```text
NEW → PROCESSING
PROCESSING → SHIPPED
SHIPPED → DELIVERED

NEW → CANCELLED
PROCESSING → CANCELLED

DELIVERED → RETURNED
```

`RETURNED` لا يستخدم مباشرة من UI، بل من ReturnService وفق قواعد الإرجاع.

كل تغيير Order Status يجب أن يمر عبر:

```text
changeOrderStatus(tx, ...)
```

---

# 4.8 Order Cancellation

Customer يمكنه إلغاء Order إذا:

```text
status = NEW
AND
createdAt + 1 hour > now
```

Admin يمكنه إلغاء:

```text
NEW
PROCESSING
```

عند الإلغاء:

* Reservation يتم تحريره.
* Inventory.reservedQuantity ينخفض.
* InventoryMovement = UNRESERVE.
* OrderStatusHistory يسجل التغيير.
* Notification تنشأ.
* AuditLog يسجل العملية.

كل ذلك داخل Transaction واحدة.

---

# 4.9 Inventory

Inventory هو **المصدر الوحيد للحقيقة الخاصة بالمخزون**.

لا يوجد stock داخل ProductVariant.

Inventory:

```text
id
variantId
quantity
reservedQuantity
lowStockThreshold
updatedAt
```

القيود:

```text
quantity >= 0
reservedQuantity >= 0
reservedQuantity <= quantity
```

كل تعديل للمخزون يجب أن يمر عبر:

```text
InventoryService
```

لا يجوز تعديل Inventory مباشرة من UI أو Service غير مخصص.

---

# 4.10 Inventory Movement

Movement Types:

```text
STOCK_IN
STOCK_OUT
ADJUSTMENT
SALE
RETURN
RESERVE
UNRESERVE
```

كل Movement يحتفظ بـ:

* before quantity
* after quantity
* before reserved quantity
* after reserved quantity
* reason
* referenceType
* referenceId
* performedById
* createdAt

`performedById = NULL` يعني System operation.

`performedById != NULL` يعني User operation.

System operations تشمل:

* Cron
* Migration
* Automatic expiry
* Other internal operations

---

# 4.11 Reservation

Reservation تستخدم لحجز المخزون أثناء Checkout.

Reservation:

```text
ACTIVE
CONFIRMED
RELEASED
EXPIRED
```

One Reservation per Order.

Checkout:

```text
Order NEW
Reservation ACTIVE
```

مدة الحجز:

```text
30 minutes
```

عند تأكيد الطلب:

```text
Reservation → CONFIRMED
Order → PROCESSING
Inventory.quantity ينخفض
Inventory.reservedQuantity ينخفض
Movement = SALE
```

كل ذلك داخل Transaction.

---

# 4.12 Reservation Expiry

Cron يعمل تقريبًا كل 5 دقائق.

يبحث عن:

```text
Reservation.status = ACTIVE
expiresAt < now
Order.status = NEW
```

لكل Reservation:

1. Lock Order.
2. تأكد أن Order ما زال NEW.
3. Lock Reservation.
4. تأكد أنها ACTIVE.
5. تحرير Inventory.
6. Movement = UNRESERVE.
7. Reservation = EXPIRED.
8. Order = CANCELLED.
9. OrderStatusHistory.
10. Notification.
11. Commit.

---

# 4.13 Lock Ordering

عند وجود أكثر من Critical Entity:

```text
Order
↓
Reservation
↓
Inventory
```

Inventory-only transaction لا تحتاج Lock على Order أو Reservation.

ممنوع بناء Transaction تحتاج:

```text
Inventory → Order
```

بعد بدء:

```text
Order → Inventory
```

لمنع Deadlocks.

أي Service جديد يتعامل مع هذه الكيانات يجب أن يحافظ على Lock Ordering.

---

# 4.14 Returns

ReturnRequest:

```text
PENDING
APPROVED
REJECTED
COMPLETED
```

الانتقالات:

```text
PENDING → APPROVED
PENDING → REJECTED
APPROVED → COMPLETED
```

نهائية:

```text
REJECTED → لا شيء
COMPLETED → لا شيء
```

ممنوع:

```text
PENDING → COMPLETED
REJECTED → COMPLETED
COMPLETED → COMPLETED
```

---

## CREATE Return

Transaction:

1. Lock OrderItem.
2. Verify Order belongs to User.
3. Verify Order = DELIVERED.
4. Verify return window.
5. حساب الكمية السابقة المطلوبة للإرجاع.
6. التحقق من عدم تجاوز الكمية الأصلية.
7. إنشاء ReturnRequest = PENDING.
8. إنشاء ReturnItem.

Committed quantity لأغراض منع تجاوز الكمية:

```text
PENDING
+
APPROVED
+
COMPLETED
```

`REJECTED` لا تُحسب.

---

## APPROVE Return

Transaction:

1. Lock OrderItem.
2. Lock ReturnRequest.
3. تأكد أن ReturnRequest = PENDING.
4. احسب الكمية المقبولة السابقة:

   * APPROVED
   * COMPLETED
5. تأكد أن الكمية الجديدة لا تتجاوز الأصل.
6. ReturnRequest = APPROVED.

---

## REJECT Return

فقط:

```text
PENDING → REJECTED
```

ولا تدخل ReturnItems المرفوضة في الحسابات المالية أو كمية الإرجاع المكتملة.

---

# 4.15 COMPLETE Return

Precondition:

```text
ReturnRequest.status = APPROVED
```

لا يجوز تنفيذ COMPLETE لأي حالة أخرى.

Transaction واحدة:

```text
BEGIN TRANSACTION

1. Lock ReturnRequest
2. Validate status = APPROVED
3. Lock Order
4. Lock relevant OrderItems
5. Update ReturnRequest → COMPLETED
6. Return inventory through InventoryService
7. Create InventoryMovement = RETURN
8. Calculate refunds
9. Apply refund reconciliation
10. Update Order.refundedAmount
11. Apply shipping refund if full return
12. Update PaymentStatus if fully refunded
13. If all OrderItems are COMPLETED:
      changeOrderStatus(tx, orderId, RETURNED, ...)
14. Create required AuditLog/Notifications
15. COMMIT
```

`changeOrderStatus` يجب أن يستخدم نفس `tx`.

---

# 4.16 Definition of Fully Returned Order

"كل OrderItems مكتملة" تعني:

لكل OrderItem:

```text
SUM(
  ReturnItem.quantity
  WHERE ReturnRequest.status = COMPLETED
)
=
OrderItem.quantity
```

ولا تدخل:

```text
PENDING
APPROVED
REJECTED
```

في تحديد اكتمال الإرجاع النهائي.

مثال منطقي:

```sql
SELECT oi.id
FROM "OrderItem" oi
WHERE oi."orderId" = $1
AND (
  SELECT COALESCE(SUM(ri.quantity), 0)
  FROM "ReturnItem" ri
  JOIN "ReturnRequest" rr
    ON rr.id = ri."returnId"
  WHERE ri."orderItemId" = oi.id
    AND rr.status = 'COMPLETED'
) < oi.quantity;
```

إذا أعاد Query أي صف، فالطلب لم يكتمل إرجاعه.

إذا لم يُعد أي صف، فكل OrderItems مكتملة.

---

# 4.17 Refund Policy

MVP يستخدم COD.

النظام يسجل Refunds ماليًا، لكن التحويل النقدي الفعلي يتم يدويًا.

---

## Refund Formula

لكل ReturnItem:

```text
refundRaw =
unitPrice
×
quantity
×
(1 - discount / subtotal)
```

جميع الحسابات باستخدام Decimal.

لا يوجد تقريب وسيط.

---

## Rounding

جميع المبالغ المالية تقرب إلى خانتين عشريتين باستخدام:

```text
ROUND_HALF_UP
```

ولا يوصف هذا بأنه Banker's Rounding.

---

# 4.18 Refund Rounding Reconciliation

عند اكتمال إرجاع كل OrderItems، يجب ضمان أن مجموع Refunds يساوي القيمة المالية المستحقة للإرجاع بالضبط.

في MVP:

```text
target = subtotal - discount
```

مع:

```text
taxAmount = 0
```

لذلك:

```text
target + shippingCost = total
```

## قاعدة التوزيع

1. احسب جميع `refundRaw` باستخدام Decimal بدون تقريب.
2. حوّل القيم إلى أصغر وحدة مالية مطلوبة.
3. احسب القيمة المقربة لكل عنصر.
4. احسب الفرق بين `target` ومجموع القيم المقربة.
5. وزع فرق السنتات بطريقة deterministic على العناصر ذات أكبر remainder.
6. لا يسمح لأي `refundAmount` أن يصبح سالبًا.
7. خزّن كل `refundAmount` بدقتين عشريتين.
8. يتم تعليم العنصر الذي حمل فرق التسوية:

```text
isLastAdjustment = true
```

ويجب أن يكون اختيار العنصر deterministic.

الهدف النهائي:

```text
Σ ReturnItem.refundAmount = target
```

بالضبط.

ثم عند اكتمال جميع المنتجات:

```text
refund products
+
shippingCost
=
Order.total
```

إذا كان:

```text
taxAmount > 0
```

في إصدار مستقبلي:

```text
target = subtotal - discount + taxAmount
```

---

# 4.19 Shipping Refund

الإرجاع الجزئي:

```text
shipping refund = 0
```

عند اكتمال إرجاع جميع OrderItems:

```text
Order.shippingCost
```

يضاف مرة واحدة.

يستخدم:

```text
Order.shippingRefunded
```

لمنع تكرار Refund الشحن.

لا يجوز إضافة shipping refund إذا:

```text
shippingRefunded = true
```

---

# 4.20 Refund Accumulation

كل ReturnRequest مكتمل يزيد:

```text
Order.refundedAmount
```

عند:

```text
Order.refundedAmount >= Order.total
```

تصبح:

```text
PaymentStatus = REFUNDED
```

في حالة Partial Refund:

```text
PaymentStatus = PAID
```

---

# 4.21 Refund Constraints

يجب أن يكون:

```text
refundedAmount >= 0
refundedAmount <= total
```

يجب أن تكون Refund calculations باستخدام Decimal.

التقريب النهائي:

```text
ROUND_HALF_UP
```

لا Admin Override في MVP.

---

# 4.22 Future Refund Adjustment

في مرحلة مستقبلية يمكن إضافة:

```text
RefundAdjustment
```

لتسجيل أي تعديل يدوي من Admin.

يجب أن يتضمن:

* amount
* reason
* admin
* createdAt
* AuditLog

ولا يدخل ضمن MVP.

---

# 4.23 Reviews

Review لا يُسمح بها إلا إذا:

* User logged in.
* Order belongs to User.
* Order = DELIVERED.
* يوجد OrderItem للمنتج.
* لا يوجد Review سابق لنفس Product + User.

Review:

```text
id
productId
userId
orderId
orderItemId
rating
comment
isApproved
createdAt
updatedAt
```

Unique:

```text
(productId, userId)
```

لا يوجد:

```text
isVerifiedPurchase
```

لأن كل Review في MVP يجب أن تكون مرتبطة بعملية شراء حقيقية.

Rating:

```text
1 <= rating <= 5
```

DB CHECK + Service validation.

---

# 4.24 Shipping Zones

ShippingZone:

```text
id
name
cost
freeThreshold
isActive
order
createdAt
updatedAt
```

ShippingZoneCity:

```text
id
shippingZoneId
city
cityNormalized
```

كل مدينة تنتمي إلى Zone واحدة فقط.

Unique:

```text
cityNormalized
```

Free shipping حسب:

```text
freeThreshold
```

Order يحتوي:

```text
shippingZoneId
```

وقد يكون NULL إذا لم يتم تحديد Zone.

---

# 4.25 Coupons

Coupon:

```text
id
code
type
value
minOrderAmount
maxUses
maxUsesPerUser
usedCount
startDate
endDate
isActive
createdAt
updatedAt
```

Types:

```text
PERCENTAGE
FIXED
```

Code:

```text
trim()
uppercase()
```

Percentage:

```text
0 < value <= 100
```

Fixed:

```text
value > 0
```

Discount لا يتجاوز:

```text
subtotal
```

---

## Coupon Concurrency

عند تطبيق Coupon:

1. Lock Coupon FOR UPDATE.
2. تحقق من:

   * isActive
   * dates
   * minOrderAmount
   * maxUses
   * maxUsesPerUser
3. احسب discount.
4. أنشئ Order.
5. أنشئ CouponUsage.
6. Increment usedCount.
7. Commit.

كل ذلك داخل Transaction.

---

# 4.26 Idempotency

IdempotencyKey:

```text
id
key
userId
endpoint
requestHash
response
statusCode
createdAt
expiresAt
```

`key` unique.

`requestHash`:

```text
SHA-256(request body)
```

القواعد:

إذا لم يوجد Key:

```text
execute
save response
```

إذا وجد بنفس Hash:

```text
return previous response
```

إذا وجد بـHash مختلف:

```text
409 Conflict
```

مدة الاحتفاظ:

```text
24 hours
```

---

# 4.27 Cart

Guest Cart يستخدم Session UUID v4.

Cookie:

```text
HttpOnly
Secure
SameSite=Lax
30 days
```

Cart يحتوي بالضبط واحدًا من:

```text
userId
sessionId
```

أي:

```text
XOR
```

لا يمكن وجود الاثنين.

لا يمكن أن يكون كلاهما NULL.

---

## Cart Ownership

User Cart:

```text
permanent
```

Guest Cart:

```text
session-bound
30 days
```

---

## Login Merge

عند تسجيل دخول User:

1. ابحث عن Guest Cart.
2. ابحث عن User Cart.
3. إذا وجدا:

   * نفس Variant → اجمع الكميات.
   * Variants مختلفة → احتفظ بالجميع.
4. احذف Guest Cart.
5. اربط الناتج بالمستخدم.

كل العملية Transactional.

Logout لا يحذف User Cart.

---

# 4.28 Address

User يمكنه امتلاك عدة Addresses.

يمكن أن يكون لديه Default Address واحد فقط.

Partial Unique Index:

```text
(userId)
WHERE isDefault = true
AND deletedAt IS NULL
```

عند تعيين Default جديد:

1. إزالة Default القديم.
2. تعيين الجديد.
3. نفس Transaction.

عند حذف Default:

* إذا توجد Addresses أخرى:

  * يتم اختيار بديل.
* إذا لا توجد:

  * لا يوجد Default.

Address يستخدم Soft Delete.

---

# 4.29 Order Snapshots

Order يحتفظ Snapshot تاريخي للعنوان والعميل.

لا يجوز أن تتغير البيانات التاريخية عند تعديل User أو Address لاحقًا.

Order:

```text
shippingAddressSnapshot
customerSnapshot
```

OrderItem يحتفظ:

```text
productName
variantName
sku
imageUrl
quantity
unitPrice
total
taxRate
taxAmount
```

---

# 4.30 Order Sequence

OrderNumber:

```text
ORD-YYYY-NNNNN
```

OrderSequence:

```text
year
lastNumber
```

الإنشاء Atomic داخل نفس Order Transaction.

الفكرة:

```sql
INSERT INTO "OrderSequence"
(year, "lastNumber")
VALUES
(year, 1)
ON CONFLICT(year)
DO UPDATE
SET "lastNumber" =
  "OrderSequence"."lastNumber" + 1
RETURNING "lastNumber";
```

ثم:

```text
ORD-YYYY-NNNNN
```

---

# 4.31 DeliveredAt

قبل DELIVERED:

```text
deliveredAt = NULL
```

عند أول انتقال إلى DELIVERED:

```text
deliveredAt = now
```

بعد ذلك لا يتم تغييره.

Return window:

```text
7 × 24 hours
```

ابتداءً من:

```text
deliveredAt
```

---

# 4.32 Payment

MVP:

```text
COD
```

PaymentStatus:

```text
PENDING
PAID
REFUNDED
```

عند إنشاء Order:

```text
PENDING
```

عند أول DELIVERED:

```text
PAID
```

Partial Refund:

```text
PAID
```

Full Refund:

```text
REFUNDED
```

لا يوجد Electronic Payment في MVP.

---

# 4.33 Money

Currency:

```text
MAD
```

جميع Financial fields:

```text
Decimal(10,2)
```

لا Floating Point للحسابات المالية.

Multi-Currency مؤجل.

---

# 4.34 Taxes

MVP:

```text
taxAmount = 0
taxRate = 0
```

VAT غير مطبق حاليًا.

Schema يحتفظ بالحقول استعدادًا للمستقبل.

---

# 4.35 Categories

Category:

```text
id
name
slug
parentId
image
isActive
order
createdAt
updatedAt
deletedAt
```

Rules:

* max depth = 3
* no cycles
* Service يتحقق من ancestor chain.
* Soft Delete.
* لا Hard Delete إذا توجد بيانات مرتبطة.

Slug:

```text
kebab-case
```

---

# 4.36 Sessions

Authentication يستخدم DB Sessions.

لا يعتمد MVP على JWT.

Session:

```text
id
userId
tokenHash
userAgent
ipAddress
expiresAt
createdAt
lastUsedAt
revokedAt
revokedReason
```

Token:

```text
32 random bytes
```

يتم تخزين Hash فقط في DB:

```text
SHA-256
```

Raw token:

```text
HttpOnly
Secure
SameSite=Lax
```

مدة Session:

```text
30 days
```

Logout:

```text
revokedAt = now
```

Password change:

```text
revoke all sessions
```

Admin يمكنه Revoke Session.

Login يجب أن يكون Rate Limited.

`lastUsedAt` يحدث تقريبًا كل 5 دقائق.

---

# 4.37 Passwords

Password hashing:

```text
bcrypt
cost = 12
```

لا يتم تخزين Password plaintext.

---

# 4.38 AuditLog

AuditLog immutable.

يحتوي:

```text
id
userId
action
entity
entityId
oldData
newData
ipAddress
userAgent
createdAt
```

`userId = NULL` يعني System operation.

يتم تسجيل:

* Order status changes
* Product changes
* Permissions
* Login success
* Login failure
* Customer changes
* Manual stock adjustments
* Payment changes
* Other sensitive operations

لا يتم تسجيل:

* ordinary reads
* cart additions
* ordinary browsing

---

# 4.39 Notifications

Notification:

```text
id
userId
type
title
message
readAt
createdAt
```

Notification Types:

```text
ORDER_CREATED
ORDER_STATUS_CHANGED
PAYMENT_RECEIVED
SHIPPING_UPDATED
RETURN_REQUESTED
RETURN_APPROVED
RETURN_REJECTED
```

Notifications لا تعتبر مصدر الحقيقة.

Order/Return/Payment state يبقى مصدر الحقيقة في الجداول الأصلية.

---

# 4.40 changeOrderStatus()

Signature:

```typescript
async function changeOrderStatus(
  tx: Prisma.TransactionClient,
  orderId: number,
  newStatus: OrderStatus,
  options: {
    changedBy: number
    note?: string
  }
): Promise<void>
```

القواعد:

* `tx` إلزامي.
* لا ينشئ Transaction خاصة به.
* لا يستعمل `prisma.$transaction()` داخله.
* كل عمليات Order.status تتم باستخدام نفس `tx`.
* History يستخدم نفس `tx`.
* Notification يستخدم نفس `tx`.
* AuditLog يستخدم نفس `tx`.
* Transaction Boundary مسؤولية المتصل.

يُستخدم من:

* Admin Actions
* ReturnService.complete()
* Cron
* أي Service يحتاج تغيير Order status

مثال:

```typescript
await prisma.$transaction(async (tx) => {
  await changeOrderStatus(
    tx,
    orderId,
    'PROCESSING',
    {
      changedBy: adminId
    }
  )
})
```

Return:

```typescript
await prisma.$transaction(async (tx) => {
  // operations

  await changeOrderStatus(
    tx,
    orderId,
    'RETURNED',
    {
      changedBy: adminId
    }
  )
})
```

ممنوع:

```typescript
await prisma.$transaction(async (tx) => {
  await changeOrderStatus(...)
})
```

إذا كانت `changeOrderStatus` ستفتح Transaction جديدة.

---

# 4.41 Soft Delete Policy

Soft Delete:

```text
User
Address
Product
Category
Review
Coupon
```

No Soft Delete:

```text
Order
OrderItem
OrderStatusHistory
InventoryMovement
AuditLog
ReturnRequest
```

Cart وCartItem:

```text
Hard Delete
```

Session:

```text
revokedAt
```

بدل Soft Delete.

---

# 5. Database Models

عدد الجداول الأساسي:

```text
31
```

---

## Group 1 — Identity

### 1. User

```text
id
name
email
phone
passwordHash
role
createdAt
updatedAt
deletedAt
```

Relations:

```text
Address[]
Session[]
Seller?
Cart?
Order[]
CouponUsage[]
Review[]
ReturnRequest[]
Notification[]
AuditLog[]
```

---

### 2. Address

```text
id
userId
label
fullName
phone
city
addressLine
postalCode
isDefault
createdAt
updatedAt
deletedAt
```

---

### 3. Session

```text
id
userId
tokenHash
userAgent
ipAddress
expiresAt
createdAt
lastUsedAt
revokedAt
revokedReason
```

---

### 4. Seller

```text
id
userId
name
status
createdAt
updatedAt
```

User → Seller:

```text
1 : 1
```

---

# Group 2 — Catalog & Inventory

## 5. Category

```text
id
name
slug
parentId
image
isActive
order
createdAt
updatedAt
deletedAt
```

---

## 6. Product

```text
id
sellerId
categoryId
name
slug
description
status
createdAt
updatedAt
deletedAt
```

---

## 7. ProductImage

```text
id
productId
url
alt
order
createdAt
```

---

## 8. ProductOption

```text
id
productId
name
order
```

---

## 9. ProductOptionValue

```text
id
optionId
value
order
```

---

## 10. ProductVariant

```text
id
productId
sku
price
discountPrice
isDefault
isActive
optionsHash
createdAt
updatedAt
```

---

## 11. ProductVariantOptionValue

```text
id
variantId
optionValueId
```

---

## 12. Inventory

```text
id
variantId
quantity
reservedQuantity
lowStockThreshold
updatedAt
```

One-to-one with ProductVariant.

---

## 13. InventoryMovement

```text
id BIGINT
inventoryId
type
beforeQuantity
afterQuantity
beforeReservedQuantity
afterReservedQuantity
reason
referenceType
referenceId
performedById
createdAt
```

---

# Group 3 — Cart & Orders

## 14. Cart

```text
id
userId
sessionId
createdAt
updatedAt
```

Invariant:

```text
exactly one of userId/sessionId is non-null
```

---

## 15. CartItem

```text
id
cartId
variantId
quantity
createdAt
updatedAt
```

---

## 16. Order

```text
id
orderNumber
userId
status
paymentMethod
paymentStatus
refundedAmount
shippingRefunded
subtotal
taxAmount
shippingCost
discount
total
shippingAddressSnapshot
customerSnapshot
shippingZoneId
notes
deliveredAt
createdAt
updatedAt
```

No Soft Delete.

---

## 17. OrderItem

```text
id
orderId
productId
variantId
productName
variantName
sku
imageUrl
quantity
unitPrice
total
taxRate
taxAmount
```

`productId` required.

`variantId` nullable for historical flexibility.

No Soft Delete.

---

## 18. OrderStatusHistory

```text
id
orderId
fromStatus
toStatus
changedById
note
createdAt
```

Immutable.

---

## 19. Reservation

```text
id
orderId
status
expiresAt
releasedAt
releaseReason
createdAt
```

One per Order.

---

## 20. ReservationItem

```text
id
reservationId
variantId
quantity
```

Unique:

```text
(reservationId, variantId)
```

---

## 21. IdempotencyKey

```text
id
key
userId
endpoint
requestHash
response
statusCode
createdAt
expiresAt
```

---

## 22. OrderSequence

```text
year
lastNumber
```

`year` primary key.

---

# Group 4 — Shipping & Coupons

## 23. ShippingZone

```text
id
name
cost
freeThreshold
isActive
order
createdAt
updatedAt
```

---

## 24. ShippingZoneCity

```text
id
shippingZoneId
city
cityNormalized
```

Unique:

```text
cityNormalized
```

---

## 25. Coupon

```text
id
code
type
value
minOrderAmount
maxUses
maxUsesPerUser
usedCount
startDate
endDate
isActive
createdAt
updatedAt
deletedAt
```

---

## 26. CouponUsage

```text
id
couponId
userId
orderId
discount
usedAt
```

Unique:

```text
orderId
```

---

# Group 5 — Returns & Reviews

## 27. ReturnRequest

```text
id
orderId
userId
status
reason
adminNote
requestedAt
processedAt
processedById
```

---

## 28. ReturnItem

```text
id
returnId
orderItemId
quantity
condition
refundAmount
isLastAdjustment
```

Defaults:

```text
refundAmount = 0
isLastAdjustment = false
```

Unique:

```text
(returnId, orderItemId)
```

Index:

```text
orderItemId
```

---

## 29. Review

```text
id
productId
userId
orderId
orderItemId
rating
comment
isApproved
createdAt
updatedAt
deletedAt
```

Unique:

```text
(productId, userId)
```

---

# Group 6 — System

## 30. Notification

```text
id
userId
type
title
message
readAt
createdAt
```

---

## 31. AuditLog

```text
id BIGINT
userId
action
entity
entityId
oldData
newData
ipAddress
userAgent
createdAt
```

Immutable.

---

# 6. Relationships

```text
User
 ├── Address[]
 ├── Session[]
 ├── Seller?
 ├── Cart?
 ├── Order[]
 ├── CouponUsage[]
 ├── Review[]
 ├── ReturnRequest[]
 ├── Notification[]
 └── AuditLog[]

Seller
 └── Product[]

Category
 ├── Category[]
 └── Product[]

Product
 ├── ProductImage[]
 ├── ProductOption[]
 ├── ProductVariant[]
 └── Review[]

ProductOption
 └── ProductOptionValue[]

ProductVariant
 ├── ProductVariantOptionValue[]
 ├── Inventory
 ├── CartItem[]
 ├── OrderItem[]
 └── ReservationItem[]

Inventory
 └── InventoryMovement[]

Cart
 └── CartItem[]

Order
 ├── OrderItem[]
 ├── OrderStatusHistory[]
 ├── Reservation
 ├── CouponUsage?
 └── ReturnRequest[]

Reservation
 └── ReservationItem[]

ShippingZone
 └── ShippingZoneCity[]

Coupon
 └── CouponUsage[]

ReturnRequest
 └── ReturnItem[]

OrderItem
 ├── Review[]
 └── ReturnItem[]
```

---

# 7. Enums

عدد Enums الأساسي:

```text
13
```

## UserRole

```text
CUSTOMER
ADMIN
SUPER_ADMIN
```

## SellerStatus

```text
PENDING
ACTIVE
SUSPENDED
CLOSED
```

## ProductStatus

```text
DRAFT
ACTIVE
INACTIVE
```

## MovementType

```text
STOCK_IN
STOCK_OUT
ADJUSTMENT
SALE
RETURN
RESERVE
UNRESERVE
```

## ReferenceType

```text
ORDER
MANUAL
SYSTEM
RETURN
```

## OrderStatus

```text
NEW
PROCESSING
SHIPPED
DELIVERED
CANCELLED
RETURNED
```

## PaymentMethod

```text
COD
```

## PaymentStatus

```text
PENDING
PAID
REFUNDED
```

## ReservationStatus

```text
ACTIVE
CONFIRMED
RELEASED
EXPIRED
```

## CouponType

```text
PERCENTAGE
FIXED
```

## ReturnStatus

```text
PENDING
APPROVED
REJECTED
COMPLETED
```

## NotificationType

```text
ORDER_CREATED
ORDER_STATUS_CHANGED
PAYMENT_RECEIVED
SHIPPING_UPDATED
RETURN_REQUESTED
RETURN_APPROVED
RETURN_REJECTED
```

## AuditAction

```text
CREATE
UPDATE
DELETE
LOGIN_SUCCESS
LOGIN_FAILED
LOGOUT
STATUS_CHANGE
PERMISSION_CHANGE
PAYMENT_CHANGE
STOCK_ADJUSTMENT
```

---

# 8. Constraints

## 8.1 Cart XOR

Exactly one:

```text
userId
sessionId
```

must be non-null.

Conceptually:

```sql
CHECK (
  ("userId" IS NOT NULL AND "sessionId" IS NULL)
  OR
  ("userId" IS NULL AND "sessionId" IS NOT NULL)
)
```

---

# 8.2 Cart Unique User

Partial unique:

```sql
CREATE UNIQUE INDEX cart_user_unique
ON "Cart" ("userId")
WHERE "userId" IS NOT NULL;
```

---

# 8.3 Cart Unique Session

Partial unique:

```sql
CREATE UNIQUE INDEX cart_session_unique
ON "Cart" ("sessionId")
WHERE "sessionId" IS NOT NULL;
```

---

# 8.4 Address Default

Partial unique:

```sql
CREATE UNIQUE INDEX address_default_unique
ON "Address" ("userId")
WHERE "isDefault" = true
AND "deletedAt" IS NULL;
```

---

# 8.5 Product Variant Default

Partial unique:

```sql
CREATE UNIQUE INDEX product_variant_default_unique
ON "ProductVariant" ("productId")
WHERE "isDefault" = true;
```

---

# 8.6 Product Variant Discount

```sql
CHECK (
  "discountPrice" IS NULL
  OR (
    "discountPrice" > 0
    AND "discountPrice" < "price"
  )
)
```

---

# 8.7 Inventory

```sql
CHECK ("quantity" >= 0);

CHECK ("reservedQuantity" >= 0);

CHECK ("reservedQuantity" <= "quantity");
```

---

# 8.8 Order Constraints

```sql
ALTER TABLE "Order"
ADD CONSTRAINT order_subtotal_positive
CHECK ("subtotal" > 0),

ADD CONSTRAINT order_discount_valid
CHECK ("discount" >= 0 AND "discount" <= "subtotal"),

ADD CONSTRAINT order_shipping_valid
CHECK ("shippingCost" >= 0),

ADD CONSTRAINT order_total_valid
CHECK ("total" >= 0),

ADD CONSTRAINT order_tax_valid
CHECK ("taxAmount" >= 0),

ADD CONSTRAINT order_refund_valid
CHECK (
  "refundedAmount" >= 0
  AND "refundedAmount" <= "total"
);
```

Service Layer يجب أن يفرض نفس القواعد.

---

# 8.9 Review Rating

```sql
CHECK (
  "rating" >= 1
  AND "rating" <= 5
)
```

---

# 8.10 Coupon

Service + DB يجب أن يضمن:

```text
PERCENTAGE:
0 < value <= 100

FIXED:
value > 0
```

---

# 9. Indexes

Indexes الأساسية:

```text
User.email
User.phone

Address.userId

Session.tokenHash
Session.userId
Session.expiresAt

Product.sellerId
Product.categoryId
Product.status
Product.deletedAt

ProductVariant.productId
ProductVariant.sku
ProductVariant.optionsHash

Inventory.variantId

InventoryMovement.inventoryId
InventoryMovement.referenceId
InventoryMovement.performedById
InventoryMovement.createdAt

Cart.userId
Cart.sessionId

CartItem.cartId
CartItem.variantId

Order.userId
Order.status
Order.createdAt
Order.orderNumber

OrderItem.orderId
OrderItem.productId

OrderStatusHistory.orderId

Reservation.orderId
Reservation.status
Reservation.expiresAt

ReservationItem.reservationId
ReservationItem.variantId

IdempotencyKey.expiresAt

ShippingZoneCity.cityNormalized

Coupon.code
CouponUsage.couponId
CouponUsage.userId

ReturnRequest.orderId
ReturnRequest.userId
ReturnRequest.status

ReturnItem.orderItemId

Review.productId
Review.userId
Review.orderItemId

Notification.userId
Notification.readAt

AuditLog.entity
AuditLog.entityId
AuditLog.userId
AuditLog.createdAt
```

---

# 10. Manual Migrations

Prisma Schema لا يكفي وحده لبعض القيود.

Manual SQL مطلوب لـ:

* Cart XOR
* Cart user partial unique
* Cart session partial unique
* Address default partial unique
* ProductVariant default partial unique
* ProductVariant discount CHECK
* Inventory CHECK constraints
* Order CHECK constraints
* Review rating CHECK

يجب الحفاظ على هذه القيود عند إنشاء Migrations مستقبلية.

لا يجوز حذف Manual Constraints بسبب Prisma migration.

---

# 11. Service Layer Rules

Business Logic يجب أن يكون في Services.

أمثلة:

```text
AuthService
UserService
SellerService
ProductService
VariantService
InventoryService
CartService
OrderService
ReservationService
CouponService
ReturnService
ReviewService
ShippingService
NotificationService
AuditService
```

UI لا ينفذ Business Logic مباشرة.

---

# 12. InventoryService Rules

كل:

```text
STOCK_IN
STOCK_OUT
ADJUSTMENT
SALE
RETURN
RESERVE
UNRESERVE
```

يجب أن يمر عبر InventoryService.

InventoryService يجب أن:

1. Lock Inventory.
2. Verify current state.
3. Validate resulting quantity.
4. Update Inventory.
5. Create InventoryMovement.
6. Commit مع Transaction المتصل.

لا يوجد تعديل مباشر من UI.

---

# 13. Transaction Rules

Critical operations يجب أن تكون Atomic.

تشمل:

* Checkout
* Reservation
* Order confirmation
* Order cancellation
* Coupon usage
* Return creation
* Return approval
* Return completion
* Inventory adjustment
* Login session creation عند الحاجة
* Cart merge

لا يتم تقسيم عملية حرجة إلى Transactions مستقلة إذا كانت النتيجة تعتمد على نجاح جميع الخطوات.

---

# 14. Idempotency and Retry

أي endpoint حساس لإنشاء بيانات مالية أو Order يجب أن يدعم Idempotency عندما يكون مناسبًا.

خصوصًا:

```text
Create Order
Payment-related future operations
Refund-related future operations
```

Retries لا يجب أن تؤدي إلى:

* Duplicate Order
* Duplicate CouponUsage
* Duplicate Refund
* Duplicate Inventory movement

---

# 15. Historical Integrity

البيانات التاريخية لا تعتمد على الحالة الحالية للمنتج.

OrderItem يحتفظ:

```text
productName
variantName
sku
imageUrl
unitPrice
quantity
total
```

حتى إذا تغير:

* Product name
* Product image
* Variant price
* SKU

تبقى OrderItem صحيحة تاريخيًا.

---

# 16. Data Deletion

لا يجوز حذف البيانات التاريخية المهمة.

خصوصًا:

```text
Order
OrderItem
OrderStatusHistory
InventoryMovement
AuditLog
ReturnRequest
```

تبقى دائمًا.

---

# 17. Naming Conventions

Tables:

```text
PascalCase singular
```

Fields:

```text
camelCase
```

Enums:

```text
UPPER_SNAKE_CASE
```

Indexes:

```text
snake_case
```

Foreign Keys:

```text
xxxId
```

أمثلة:

```text
userId
productId
orderId
performedById
changedById
processedById
```

Timestamps:

```text
createdAt
updatedAt
deletedAt
```

كل timestamps:

```text
UTC
```

Timezone الخاص بالعميل يستخدم فقط في UI.

---

# 18. Slugs and SKUs

Slug:

```text
kebab-case
```

SKU:

```text
UPPERCASE
```

Order Number:

```text
ORD-YYYY-NNNNN
```

---

# 19. Variant Options Hash

لمنع Duplicate Variant combinations:

```text
optionsHash
```

يتم إنشاء Hash server-side.

الطريقة:

1. اجمع optionValueIds.
2. رتبها تصاعديًا.
3. اجمعها باستخدام comma.
4. SHA-256.
5. خزّن النتيجة.

مثال:

```text
[4, 9, 15]
```

تصبح:

```text
4,9,15
```

ثم:

```text
SHA-256("4,9,15")
```

Unique:

```text
(productId, optionsHash)
```

Product بدون Options:

```text
SHA-256("")
```

ولا يسمح إلا بـVariant واحد.

---

# 20. Order Financial Invariants

يجب أن تكون:

```text
subtotal > 0

discount >= 0

discount <= subtotal

taxAmount >= 0

shippingCost >= 0

total >= 0

refundedAmount >= 0

refundedAmount <= total
```

ويتم التحقق منها:

```text
Service Layer
+
Database CHECK
```

---

# 21. Order Total

في MVP:

```text
total =
subtotal
+
taxAmount
+
shippingCost
-
discount
```

مع:

```text
taxAmount = 0
```

لذلك:

```text
total =
subtotal
+
shippingCost
-
discount
```

---

# 22. Return Window

Return window:

```text
7 × 24 hours
```

من:

```text
Order.deliveredAt
```

لا يبدأ من تاريخ إنشاء الطلب.

إذا انتهت المدة:

```text
Return Request → rejected
```

ولا يجوز إنشاء Return جديد.

---

# 23. Return Quantity Integrity

لكل OrderItem:

```text
completedQuantity <= originalQuantity
```

وكذلك:

```text
pendingQuantity
+
approvedQuantity
+
completedQuantity
<= originalQuantity
```

Rejected quantities لا تدخل في الحساب.

هذه القاعدة يجب فرضها داخل Transaction مع Lock على OrderItem.

---

# 24. Return Refund Integrity

عند Partial Return:

```text
shipping refund = 0
```

عند Full Return:

```text
product refund
+
shipping refund
=
total
```

في MVP:

```text
taxAmount = 0
```

Refund calculation يجب أن يكون deterministic.

---

# 25. Full Return State Transition

إذا اكتملت جميع OrderItems:

```text
Order:
DELIVERED → RETURNED
```

ويجب أن يتم ذلك بواسطة:

```text
changeOrderStatus(tx, ...)
```

لا يجوز:

```text
UPDATE Order SET status = RETURNED
```

مباشرة داخل ReturnService.

---

# 26. changeOrderStatus Transaction Contract

`changeOrderStatus`:

```typescript
async function changeOrderStatus(
  tx: Prisma.TransactionClient,
  orderId: number,
  newStatus: OrderStatus,
  options: {
    changedBy: number
    note?: string
  }
): Promise<void>
```

Contract:

```text
tx must be supplied
```

Function لا تفتح Transaction.

كل العمليات التابعة تستخدم نفس:

```text
tx
```

بما فيها:

```text
Order
OrderStatusHistory
Notification
AuditLog
```

---

# 27. Notification Rules

Notifications تنشأ داخل نفس Transaction عندما تكون مرتبطة بعملية حرجة.

مثال:

Order status change:

```text
Order update
+
History
+
Notification
+
Audit
```

كلها في Transaction واحدة.

إذا فشلت Transaction:

```text
لا توجد Notification منفصلة
```

---

# 28. Audit Rules

AuditLog يجب أن يكون immutable.

لا يتم تحديث AuditLog بعد إنشائه.

Sensitive operations يجب أن تسجل:

```text
who
what
entity
old state
new state
when
ip
user agent
```

System actions:

```text
userId = NULL
```

---

# 29. Public Data Rules

الـPublic API لا يعرض:

* internal IDs غير الضرورية
* password hashes
* session tokens
* audit information
* internal financial control data
* private customer information

Public Product Query:

```text
Product ACTIVE
Product not deleted
Seller ACTIVE
```

---

# 30. Authentication Security

Authentication يجب أن يستخدم:

```text
DB Sessions
HttpOnly cookies
Secure cookies
SameSite=Lax
Token hashing
bcrypt
Rate limiting
Session revocation
```

لا يتم وضع session token في:

```text
localStorage
```

---

# 31. Authorization

كل Server Action وAPI Route حساس يجب أن يتحقق من:

```text
authentication
+
authorization
+
resource ownership
+
business rules
```

لا يكفي إخفاء Button في UI.

إخفاء UI ليس Authorization.

---

# 32. Customer Ownership

Customer لا يستطيع الوصول إلى Order أو Address أو Return أو Review ليس له.

كل Request يجب أن يتحقق من:

```text
resource.userId === currentUser.id
```

أو علاقة ملكية مكافئة.

---

# 33. Admin Authorization

Admin يستطيع تنفيذ العمليات الإدارية المسموح بها.

SUPER_ADMIN يستخدم للعمليات الأعلى صلاحية.

Role checks يجب أن تكون Server-side.

---

# 34. Seller Authorization

Seller entity مستقلة عن User Role.

Product ownership يجب أن يتحقق من:

```text
product.sellerId
```

Seller لا يستطيع تعديل Product لا يملكه.

في الإصدار الحالي لا يتم تفعيل Multi-Vendor الكامل، لكن النموذج يدعم التوسع إليه.

---

# 35. Product Lifecycle

Product statuses:

```text
DRAFT
ACTIVE
INACTIVE
```

Public:

```text
ACTIVE فقط
```

Seller suspended/closed:

```text
Products → INACTIVE
```

لا يتم حذف المنتجات التاريخية.

---

# 36. Inventory Lifecycle

Inventory states لا تحتاج Enum مستقل.

الحالة تستنتج من:

```text
quantity
reservedQuantity
```

أمثلة:

Available:

```text
quantity > reservedQuantity
```

Fully Reserved:

```text
quantity = reservedQuantity
```

Out of Stock:

```text
quantity = 0
```

لا يسمح:

```text
reservedQuantity > quantity
```

---

# 37. Checkout Rules

Checkout يجب أن:

1. يتحقق من Authentication عند الطلب.
2. يقرأ Cart من Server.
3. يقرأ Variants من DB.
4. يتحقق من Active Product.
5. يتحقق من Active Seller.
6. يتحقق من Inventory.
7. يتحقق من Coupon.
8. يحسب الأسعار.
9. يحسب Shipping.
10. ينشئ Order.
11. ينشئ OrderItems.
12. ينشئ Reservation.
13. يحجز Inventory.
14. يسجل Idempotency.
15. Commit.

Client prices لا تثق بها.

---

# 38. Guest Checkout

Guest يستطيع الاحتفاظ بـCart.

عند الشراء:

```text
authentication required
```

بعد تسجيل الدخول يتم Merge للGuest Cart مع User Cart.

---

# 39. Cart Quantity

Cart quantity يجب أن تكون:

```text
positive integer
```

Server يتحقق من:

```text
available inventory
variant active
product active
seller active
```

عند Checkout يتم إعادة التحقق دائمًا.

---

# 40. Coupon Concurrency

لا تعتمد Coupon على قراءة عادية ثم Update.

يجب Lock:

```text
Coupon FOR UPDATE
```

قبل تعديل:

```text
usedCount
```

لمنع تجاوز:

```text
maxUses
```

---

# 41. Shipping Calculation

Shipping يعتمد على:

```text
ShippingZone
+
subtotal
```

إذا:

```text
subtotal >= freeThreshold
```

يكون:

```text
shippingCost = 0
```

وإلا:

```text
shippingCost = ShippingZone.cost
```

---

# 42. Search

MVP يستخدم Database search/filtering.

External Search Engine مؤجل.

عند وصول عدد المنتجات إلى مستوى يحتاج محرك بحث مستقل، يمكن إضافة:

```text
Search Engine
```

كـTechnical Debt.

---

# 43. Notifications Future Scaling

MVP ينشئ Notifications داخل Transactions.

إذا وصل النظام إلى حجم كبير، يمكن إضافة Queue.

Trigger تقريبي للبحث في الموضوع:

```text
1000 notifications/day
```

---

# 44. Audit Scaling

عند وصول AuditLog إلى:

```text
10 million records
```

يتم دراسة:

* partitioning
* archival
* retention strategy

---

# 45. Technical Debt

| #  | Item                       | Phase      |
| -- | -------------------------- | ---------- |
| 1  | Multi-Vendor               | Phase 3    |
| 2  | Electronic Payments        | Phase 3    |
| 3  | Shipping API               | Phase 4    |
| 4  | Email/SMS                  | Phase 4    |
| 5  | Queue                      | عند الحاجة |
| 6  | External Search Engine     | عند الحاجة |
| 7  | Multi-Currency             | Future     |
| 8  | Advanced VAT               | Future     |
| 9  | CDN                        | Phase 2    |
| 10 | Analytics                  | Phase 4    |
| 11 | Redis                      | عند الحاجة |
| 12 | AuditLog partition/archive | عند 10M    |
| 13 | RefundAdjustment           | Phase 3    |
| 14 | Review Purchase Type enum  | عند الحاجة |

---

# 46. Prisma Rules

Prisma مسؤول عن:

* Models
* Relations
* Enums
* Standard indexes
* Unique constraints
* Data types

Prisma لا يعتمد عليه وحده في:

* Partial unique indexes
* Complex CHECK constraints
* Advanced PostgreSQL constraints

هذه تتم في SQL migrations.

---

# 47. Migration Safety

قبل كل Migration:

1. Verify current schema.
2. Verify DECISIONS.md.
3. Verify Prisma schema.
4. Review generated migration.
5. Check manual constraints.
6. Apply migration.
7. Run validation.
8. Run tests.

لا يتم تنفيذ Migration عمياء.

---

# 48. Seed Rules

Seed يجب أن يكون:

```text
deterministic
repeatable
safe
```

لا ينشئ بيانات عشوائية غير قابلة للتتبع.

Seed يجب أن يحتوي على بيانات تطوير فقط.

لا يتم وضع Production secrets داخل Seed.

---

# 49. Testing Strategy

قبل اعتبار Module مكتملًا يجب اختبار:

## Happy Path

العملية الطبيعية.

## Validation

مدخلات غير صحيحة.

## Authorization

محاولات الوصول غير المصرح بها.

## Concurrency

محاولات متزامنة.

## Transactions

Rollback عند الفشل.

## Idempotency

إعادة نفس Request.

## Boundary Conditions

مثل:

```text
quantity = 0
quantity = 1
last stock
last reservation
maximum coupon usage
return quantity = original quantity
return quantity > original quantity
```

## Financial Precision

اختبار:

```text
discount
shipping
refund
rounding
reconciliation
```

---

# 50. Definition of Done

لا يعتبر Feature مكتملًا بمجرد أن UI يظهر.

Feature مكتمل فقط إذا:

* UI يعمل.
* Server logic يعمل.
* Database schema صحيح.
* Validation موجود.
* Authorization موجود.
* Error handling موجود.
* Transaction boundary صحيحة.
* Concurrency مدروسة.
* Audit عند الحاجة.
* Notifications عند الحاجة.
* Tests موجودة.
* لا توجد dead buttons.
* لا توجد white screens.
* لا توجد fake data في Production flow.
* لا توجد business rules داخل UI فقط.
* لا توجد قيم مالية موثوقة من Client.

---

# 51. Error Handling

Errors يجب أن تكون:

* واضحة
* deterministic
* لا تكشف Secrets
* لا تكشف database internals للمستخدم

Server logs يمكن أن تحتوي تفاصيل تقنية أكثر.

Client يحصل على Error مناسب.

---

# 52. Fail Loud

لا يتم إخفاء أخطاء Business Logic.

مثلاً:

إذا حاول Service:

```text
Complete Return
```

وحالة Return:

```text
PENDING
```

يجب أن يفشل بوضوح.

لا يتم تحويل الخطأ تلقائيًا إلى:

```text
APPROVED
```

أو تجاهله.

---

# 53. No Silent Data Repair

لا يتم إصلاح البيانات تلقائيًا بطريقة غير موثقة.

أي Data Repair:

* Migration
* Script
* Admin operation

يجب أن يكون واضحًا وقابلًا للتدقيق.

---

# 54. System Operations

System operations يمكن أن تكون:

```text
performedById = NULL
userId = NULL
```

أمثلة:

* Reservation expiry
* Automatic product deactivation
* System migration
* Background maintenance

يجب تسجيلها في AuditLog عندما تكون العملية حساسة.

---

# 55. Refund Adjustment Tracking

`ReturnItem.isLastAdjustment`:

```text
false
```

افتراضيًا.

عند استخدامه في Reconciliation:

```text
true
```

ويجب أن يحدد بوضوح العنصر الذي حمل فرق التقريب.

لا يجوز وجود أكثر من Adjustment marker لنفس عملية Full Return النهائية إلا إذا كانت هناك عملية Reconciliation جديدة موثقة.

---

# 56. Refund Completion Invariants

بعد Full Return ناجح:

```text
all OrderItems COMPLETED
```

ويجب أن يكون:

```text
Σ ReturnItem.refundAmount
=
subtotal - discount + taxAmount
```

ثم:

```text
+ shippingCost
=
total
```

في MVP:

```text
taxAmount = 0
```

لذلك:

```text
Σ product refunds + shippingCost = total
```

ثم:

```text
Order.refundedAmount = Order.total
PaymentStatus = REFUNDED
Order.status = RETURNED
```

كل ذلك يجب أن يحدث داخل Transaction واحدة.

---

# 57. No Duplicate Refund

Complete Return لا يمكن تنفيذه إلا:

```text
APPROVED → COMPLETED
```

إذا تمت محاولة التنفيذ مرة ثانية:

```text
COMPLETED → error
```

ولا يتم:

* إعادة إضافة Inventory
* إعادة إضافة Refund
* إعادة Refund Shipping
* إعادة Notification
* إعادة Audit operation

---

# 58. No Duplicate Shipping Refund

قبل إضافة shipping refund:

```text
shippingRefunded = false
```

بعد الإضافة:

```text
shippingRefunded = true
```

يتم ذلك داخل نفس Transaction.

---

# 59. Order Return Status Integrity

لا يصبح Order:

```text
RETURNED
```

بسبب وجود:

```text
PENDING
```

أو:

```text
APPROVED
```

فقط.

يصبح:

```text
RETURNED
```

عندما تكون جميع OrderItems مكتملة:

```text
COMPLETED quantities == original quantities
```

---

# 60. Database Truth

أي Business Rule حرجة يجب أن يكون لها حماية على مستوى مناسب:

```text
Service Layer
+
Database
```

عندما يكون DB constraint ممكنًا، يستخدم.

عندما لا يكون ممكنًا، يجب أن يكون Service Transaction-safe.

---

# 61. Future Multi-Vendor

عند تفعيل Multi-Vendor:

Product already contains:

```text
sellerId
```

لذلك يمكن توسيع:

* Seller onboarding
* Seller dashboard
* Seller permissions
* Seller orders
* Seller payouts
* Seller shipping
* Seller commissions

دون إعادة تصميم Product الأساسي.

---

# 62. Future Electronic Payments

عند إضافة Electronic Payments:

لا يتم تغيير Order model بطريقة تكسر COD.

سيتم إضافة Payment domain مناسب يتعامل مع:

* Payment intent
* Provider
* Transaction ID
* Webhook
* Payment status
* Refund

ويجب الحفاظ على Idempotency وAudit.

---

# 63. Future Shipping API

ShippingZone يبقى قاعدة محلية.

Shipping API مستقبلًا يمكن أن يستخدم:

```text
ShippingZone
+
Order
+
Customer address
```

مع حفظ Tracking data في Domain مستقل عند الحاجة.

---

# 64. Future RefundAdjustment

عند الحاجة إلى Admin Refund Override:

يتم إنشاء:

```text
RefundAdjustment
```

ولا يتم تعديل:

```text
Order.refundedAmount
```

بشكل غير قابل للتتبع.

كل Adjustment يجب أن يحتوي:

```text
orderId
returnRequestId?
amount
reason
createdById
createdAt
```

مع AuditLog.

---

# 65. Security Principles

يجب اتباع:

```text
Least Privilege
Server-side Authorization
Input Validation
Output Sanitization
Secure Cookies
Password Hashing
Rate Limiting
Idempotency
Transactions
Auditability
No Sensitive Data Leakage
```

---

# 66. Client Trust Boundary

Client غير موثوق.

أي قيمة تأتي من Browser تعتبر:

```text
untrusted input
```

بما فيها:

* price
* quantity
* product status
* role
* userId
* coupon validity
* shipping cost
* total

Server يعيد التحقق من كل شيء حساس.

---

# 67. API / Server Action Rules

كل endpoint أو Server Action يجب أن يحدد:

```text
Authentication
Authorization
Validation
Business Logic
Transaction Boundary
Error Handling
Audit Requirement
```

---

# 68. No Dead Routes

كل Button أو Link أو Action يجب أن:

* يؤدي إلى Route موجود
* أو Action حقيقية
* أو يكون Disabled بشكل واضح إذا كانت الوظيفة غير متاحة

لا توجد أزرار تؤدي إلى:

```text
white screen
404
fake success
```

---

# 69. No Fake Completion

لا يجوز اعتبار Feature مكتملًا بسبب:

```text
static UI
mock response
local fake state
hardcoded data
```

إلا إذا كان ذلك صريحًا ضمن Prototype منفصل.

Production flow يجب أن يعمل من:

```text
UI
→ Server
→ Service
→ Database
```

---

# 70. Development Order

بعد اعتماد هذا الملف، ترتيب التنفيذ:

```text
1. Install Prisma
2. prisma init
3. Configure PostgreSQL / Neon
4. Create Prisma datasource
5. Add Enums
6. Add Models Group 1
7. Validate
8. Add Models Group 2
9. Validate
10. Add Models Group 3
11. Validate
12. Add Models Group 4
13. Validate
14. Add Models Group 5
15. Validate
16. Add Models Group 6
17. Validate
18. Generate Prisma Client
19. Create Migration
20. Add manual SQL constraints
21. Apply Migration
22. Verify Database
23. Create Seed
24. Run Seed
25. Test
```

لا يتم القفز مباشرة إلى بناء جميع Services قبل التأكد من Database integrity.

---

# 71. Database Verification

بعد Migration يجب التحقق من:

* جميع 31 tables
* جميع 13 enums
* جميع Relations
* جميع Unique constraints
* جميع Indexes
* جميع Manual CHECK constraints
* Partial indexes
* Foreign keys
* Cascade behavior
* Delete behavior
* Decimal types
* BigInt IDs
* Timestamps

---

# 72. Final Architecture Summary

## Identity

```text
User
Address
Session
Seller
```

## Catalog

```text
Category
Product
ProductImage
ProductOption
ProductOptionValue
ProductVariant
ProductVariantOptionValue
```

## Inventory

```text
Inventory
InventoryMovement
```

## Commerce

```text
Cart
CartItem
Order
OrderItem
OrderStatusHistory
Reservation
ReservationItem
IdempotencyKey
OrderSequence
```

## Shipping / Coupons

```text
ShippingZone
ShippingZoneCity
Coupon
CouponUsage
```

## Returns / Reviews

```text
ReturnRequest
ReturnItem
Review
```

## System

```text
Notification
AuditLog
```

---

# 73. Final Decisions

| Decision                       | Final Rule                               |
| ------------------------------ | ---------------------------------------- |
| Architecture                   | Next.js + Services + Prisma + PostgreSQL |
| Database                       | PostgreSQL / Neon                        |
| Currency                       | MAD                                      |
| Payment MVP                    | COD                                      |
| Authentication                 | DB Sessions                              |
| Password                       | bcrypt cost 12                           |
| Product price                  | ProductVariant                           |
| Stock source                   | Inventory                                |
| Guest Cart                     | UUID session                             |
| User Cart                      | DB persistent                            |
| Cart ownership                 | XOR userId/sessionId                     |
| Inventory mutation             | InventoryService فقط                     |
| Reservation                    | 30 minutes                               |
| Order Number                   | ORD-YYYY-NNNNN                           |
| Taxes MVP                      | 0                                        |
| Return Window                  | 7×24h                                    |
| Partial shipping refund        | No                                       |
| Full shipping refund           | Yes                                      |
| Shipping refund guard          | shippingRefunded                         |
| Refund precision               | Decimal                                  |
| Rounding                       | ROUND_HALF_UP                            |
| Refund reconciliation          | Deterministic cent allocation            |
| Return COMPLETE                | APPROVED فقط                             |
| Full Return                    | COMPLETED quantities فقط                 |
| Order RETURNED                 | Through changeOrderStatus(tx, ...)       |
| changeOrderStatus              | tx إلزامي                                |
| Refund Override                | Not in MVP                               |
| Review verification            | OrderItem relationship                   |
| isVerifiedPurchase             | Removed                                  |
| Order subtotal                 | > 0                                      |
| Order discount                 | 0 ≤ discount ≤ subtotal                  |
| Order refund                   | 0 ≤ refundedAmount ≤ total               |
| Seller public status           | ACTIVE فقط                               |
| Product public status          | ACTIVE + not deleted                     |
| Seller soft delete             | Not currently implemented                |
| Historical Orders              | Never soft deleted                       |
| AuditLog                       | Immutable                                |
| InventoryMovement system actor | performedById = NULL                     |
| Audit system actor             | userId = NULL                            |
| Product deletion               | Soft Delete                              |
| Address deletion               | Soft Delete                              |
| Category deletion              | Soft Delete                              |
| Review deletion                | Soft Delete                              |
| Coupon deletion                | Soft Delete                              |
| Cart deletion                  | Hard Delete                              |
| Session invalidation           | revokedAt                                |
| Multi-Vendor                   | Future Phase 3                           |
| Electronic Payments            | Future Phase 3                           |
| Shipping API                   | Future Phase 4                           |
| Email/SMS                      | Future Phase 4                           |

---

# 74. Final Status

```text
DECISIONS.md
Version: 2.2
Status: FINAL ARCHITECTURE REFERENCE
```

هذه الوثيقة هي الأساس الذي يجب أن يبنى عليه:

```text
Prisma Schema
↓
Database Migration
↓
Services
↓
Server Actions / APIs
↓
Admin
↓
Customer Store
↓
Tests
```

لا يجوز تغيير Business Rules الأساسية أثناء التنفيذ دون تحديث هذه الوثيقة أولًا.

---

# 75. Final Engineering Principle

الهدف ليس أن يعمل التطبيق في الحالة الطبيعية فقط.

الهدف أن يبقى صحيحًا عند:

```text
الطلبات المتزامنة
إعادة إرسال الطلبات
فشل Transaction
انقطاع الاتصال
تغير الأسعار
تغير المخزون
إلغاء الطلب
انتهاء Reservation
استعمال Coupon بالتزامن
الإرجاع الجزئي
الإرجاع المتعدد
الإرجاع الكامل
فروقات التقريب
تغيير بيانات المنتج
حذف البيانات
إعادة المحاولة
محاولات الوصول غير المصرح بها
```

أي Feature جديد يجب أن يحافظ على:

```text
Data Integrity
+
Financial Integrity
+
Authorization
+
Concurrency Safety
+
Auditability
+
Historical Integrity

---

## 76.28 Fix — Login Error Handling (v2.11)

آخر تحديث: 2026-09-25

هذا القسم يوثّق ما تم تنفيذه فعلاً في الكود، ولا يُلغي أي قرار معماري في الأقسام 1-75.

## 76.1 نظرة عامة

- **نسبة الإنجاز:** ~72%
- **المراحل 0-9:** مكتملة
- **المرحلة 10 (تنظيف):** جارية
- **المراحل 11+:** قيد التنفيذ

## 76.2 الـStack الفعلي

| الطبقة | التقنية | ملاحظة |
|--------|---------|--------|
| Framework | Next.js 16 App Router | ✅ |
| Language | TypeScript | ✅ |
| Styling | Tailwind CSS 4 | ✅ |
| Icons | lucide-react | ✅ |
| Animations | framer-motion | ✅ |
| Validation | Zod | ✅ |
| ORM | Prisma **7.10.0** (Stable) | رفضنا 8.0.0-rc |
| Prisma Client | `app/generated/prisma/` | مسار Prisma 7 |
| Prisma Config | `prisma7.config.ts` | ملف Prisma 7 |
| Database | PostgreSQL (Neon) | ✅ |
| Password Hash | **bcryptjs** (JS خالص) | لتفادي compilation على Windows |
| Sessions | DB Sessions (SHA-256) | Cookie: `nokhba_session` |
| Seed Runner | **tsx** | devDependency |
| File Upload | UploadThing | maxFileCount: 5 |

## 76.3 تفاصيل تقنية دقيقة

### Cookie Name

nokhba_session
موقعها: lib/validations/auth.ts → SESSION_COOKIE_NAME

### Prisma Client Import
import { PrismaClient } from "@/app/generated/prisma/client";
لا تستخدم @prisma/client

### Migration الأخيرة
20260923211141_add_product_metadata

### Seed
npm run seed
npm run recalc

## 76.4 نظام صور المنتج

### قاعدة حرجة
في app/admin/products/[id]/page.tsx استخدم:
images: { orderBy: { order: "asc" } }

لا تستخدم:
images: { where: { isMain: true }, take: 1 }
لأنها تمسح كل الصور عند الحفظ.

### PATCH
- يستقبل imageUrls (مصفوفة)
- حذف كل الصور + createMany
- يُنشئ variant لو غير موجود

## 76.5 CartDrawer Pattern

كل صفحة فيها useCart + زر أضف للسلة → تحتاج CartDrawer.

الصفحات:
- app/page.tsx
- app/product/[slug]/page.tsx

لا تحتاج: login, register, checkout

## 76.6 الصفحات والـAPIs

### Customer Routes
/ , /product/[slug] , /login , /register , /checkout , /orders , /orders/[id] , /profile

### Admin Routes
/admin , /admin/orders , /admin/products , /admin/reviews

### APIs جديدة (v2.3 - v2.4)
GET    /api/orders/[id]
GET    /api/user/profile
PATCH  /api/user/profile
POST   /api/reviews
GET    /api/reviews?productId=X   (عام)
GET    /api/reviews?orderId=X     (يحتاج auth)
GET    /api/admin/reviews
PATCH  /api/admin/reviews/[id]

## 76.7 نظام المراجعات (v2.4)

### الملفات
- services/review.service.ts
- components/reviews/ReviewModal.tsx
- app/admin/reviews/page.tsx

### القواعد
- التقييم فقط بعد DELIVERED
- مرة واحدة لكل (productId, userId)
- isApproved = false افتراضياً
- Admin يوافق من /admin/reviews

### Auto-Recalc
recalcProductStats(tx, productId) في review.service.ts
عند approve/reject → يحدّث Product.rating + reviewsCount

### Script يدوي
npm run recalc

## 76.8 Product.sold Auto-Increment (v2.4)

### القاعدة
عند الانتقال إلى DELIVERED → Product.sold += quantity تلقائياً

### التطبيق
في app/api/admin/orders/[id]/status/route.ts داخل نفس Transaction

## 76.9 Navigation (v2.4)

### BottomNav
1. الرئيسية → /
2. الفئات → /#categories
3. طلباتي → /orders
4. دخول → /login
5. السلة → CartDrawer

### AdminSidebar
لوحة التحكم , المنتجات , الطلبات , المراجعات , المستخدمون

### UserMenu
طلباتي → /orders
حسابي → /profile

## 76.10 المشاكل المحلولة (v2.4)

1. CartDrawer ناقص من صفحة المنتج
2. PATCH لا يحفظ الصور المتعددة
3. صفحة تعديل المنتج تجلب صورة واحدة
4. variantId: undefined في OrderItem
5. Seed يحذف Variants بدون إعادة إنشائها
6. PATCH يفشل عند غياب variant
7. Product.rating لا يتزامن مع Reviews

## 76.11 ما تزال مفتوحة

- Reservation System (Schema جاهز، منطق مفقود)
- Idempotency
- Coupons
- Returns
- Shipping Zones Admin
- Audit Log تلقائي
- Rate Limiting
- Password Reset
- Cron Job للـReservations

## 76.12 Git History (v2.4)

3724efd Docs: add Section 76
778afb9 Feat: review submission from order detail
...     Feat: admin reviews management page
...     Fix: PATCH creates variant when missing
...     Feat: auto-increment Product.sold on DELIVERED

## 76.13 When to Update

يُحدَّث عند:
- إضافة Feature
- إصلاح مشكلة من 76.11
- تغيير Stack / API / صفحة

End of Section 76 (v2.4)

## 76.14 نظام الكوبونات (v2.5)

### الملفات
- services/coupon.service.ts
- app/api/coupons/validate/route.ts
- app/api/admin/coupons/route.ts
- app/api/admin/coupons/[id]/route.ts
- app/admin/coupons/page.tsx

### الميزات
- نوعان: نسبة (%) أو مبلغ ثابت
- حد أدنى للطلب (اختياري)
- حد أقصى للاستخدامات (عام + لكل مستخدم)
- تاريخ بدء ونهاية
- تفعيل / تعطيل / حذف Soft
- تطبيق في Checkout مع معاينة مباشرة
- CouponUsage tracking تلقائي

### الحماية
- التحقق داخل CouponService.validate
- منع تجاوز maxUsesPerUser
- discount لا يتجاوز subtotal
- CouponUsage يُنشأ داخل نفس Transaction مع Order

End of Section 76 (v2.5)

## 76.15 نظام المفضلة (v2.6)

### الملفات
- lib/hooks/useFavorites.ts
- app/favorites/page.tsx
- components/products/ProductCard.tsx (زر القلب)
- app/product/[slug]/page.tsx (زر القلب)
- components/layout/Header.tsx (رابط + عداد)

### القواعد
- localStorage (key: nokhba-favorites)
- لا يحتاج تسجيل دخول
- Heart في ProductCard + صفحة المنتج
- stopPropagation لمنع فتح الرابط عند الضغط على القلب
- عداد في Header

### التوسع المستقبلي
عند الحاجة: مزامنة عبر DB (جدول Favorites) بدل localStorage.

## 76.16 صفحة التصنيفات (v2.6)

### الملف
- app/category/[slug]/page.tsx

### الميزات
- Breadcrumb (الرئيسية / اسم التصنيف)
- أيقونة التصنيف + عدّاد المنتجات
- ترتيب: الأحدث / الأكثر مبيعاً / الأعلى تقييماً / السعر
- حالة فارغة (تصنيف بلا منتجات)
- حالة خطأ (slug خاطئ)

### العلاقة مع الصفحة الرئيسية
- الصفحة الرئيسية تحتفظ بالفلترة inline (CategoryGrid + Navigation)
- `/category/[slug]` هي للروابط المباشرة + SEO

### ملاحظة
مستقبلاً: قد نُحدّث CategoryGrid + Navigation ليربطا بـ/category/[slug] بدل الفلترة inline.

## 76.17 Git History (v2.6)

بعد v2.5:
- Feat: coupon system complete (admin + checkout)
- Feat: favorites system (localStorage + page + header)
- Feat: add heart button to ProductCard
- Feat: category page with sorting

End of Section 76 (v2.6)

## 76.18 نظام الحجز (Reservation) (v2.7)

### الملفات
* services/inventory.service.ts  ← جديد
* services/order.service.ts  ← محدّث
* app/api/admin/orders/[id]/status/route.ts  ← محدّث
* app/api/cron/expire-reservations/route.ts  ← جديد

### InventoryService — البوابة الوحيدة
كل تعديل على Inventory يمر عبر هذه الخدمة:
* lockInventory (SELECT FOR UPDATE)
* reserve (حجز عند Checkout)
* unreserve (تحرير)
* commitSale (خصم عند PROCESSING)
* returnStock (إرجاع)
* stockIn (إضافة — Admin)
* adjust (تعديل يدوي — Admin)
* getStock (قراءة)

كل دالة:
* تسجّل InventoryMovement تلقائياً
* تتحقق من القيود
* تستخدم Locking لمنع Race Conditions

### دورة حياة Reservation
```

Checkout → Reservation ACTIVE (30 دقيقة) + reservedQuantity += qty
↓
Admin يؤكد (NEW → PROCESSING)
→ commitSale: quantity -= qty, reservedQuantity -= qty
→ Reservation = CONFIRMED
→ Movement = SALE

أو Admin يلغي (NEW → CANCELLED)
→ unreserve: reservedQuantity -= qty
→ Reservation = RELEASED
→ Movement = UNRESERVE

أو Admin يلغي بعد التأكيد (PROCESSING → CANCELLED)
→ returnStock: quantity += qty
→ Reservation = RELEASED (CANCELLED_AFTER_CONFIRM)
→ Movement = RETURN

أو 30 دقيقة تمر بدون تأكيد
→ Cron Job يحرّر تلقائياً
→ Reservation = EXPIRED
→ Order = CANCELLED
→ إشعار للعميل

```

### Cron Job
* المسار: /api/cron/expire-reservations
* يعمل كل 5 دقائق (Vercel Cron)
* يحمي بـCRON_SECRET
* معالجة كل 50 حجز منته في الدفعة
* يستخدم Lock Order → Lock Reservation → Lock Inventory (Lock Ordering)

### Constants
* RESERVATION_DURATION_MINUTES = 30
* Cron interval = 5 دقائق
* Batch size = 50

### اختبارات النجاح
* reserve/confirm/cancel/release/return/expire كلها تعمل
* Movement يُسجَّل في كل عملية
* الإشعارات تُنشأ

## 76.19 Git History (v2.7)

## 76.20 نظام الإرجاع (Return System) (v2.8)

### الملفات
- services/return.service.ts  ← جديد
- app/api/returns/route.ts  ← جديد
- app/api/orders/[id]/returnable/route.ts  ← جديد
- app/api/admin/returns/route.ts  ← جديد
- app/api/admin/returns/[id]/route.ts  ← جديد
- components/returns/ReturnModal.tsx  ← جديد
- app/orders/[id]/page.tsx  ← محدّث (زر طلب إرجاع)
- app/admin/returns/page.tsx  ← جديد
- app/admin/returns/[id]/page.tsx  ← جديد
- components/admin/AdminSidebar.tsx  ← محدّث (رابط الإرجاع)

### القواعد
- الإرجاع فقط بعد DELIVERED
- نافذة: 7 × 24 ساعة من deliveredAt
- مرة واحدة لكل OrderItem (تتعدد الطلبات لكن بحد الكمية)
- لا يمكن أن تتجاوز الكميات الأصلية

### دورة حياة ReturnRequest

PENDING → APPROVED → COMPLETED
PENDING → REJECTED (نهائي)

- PENDING → لا يمكن COMPLETE
- REJECTED → لا شيء
- COMPLETED → لا شيء

### Complete (الأهم)
داخل Transaction واحدة:
1. Lock ReturnRequest
2. تحقق من APPROVED
3. تحقق Order = DELIVERED
4. ReturnRequest = COMPLETED
5. InventoryService.returnStock لكل OrderItem
6. حساب Refund لكل item
7. إذا Full Return → reconcileRefunds (Largest Remainder)
8. تحديث Order.refundedAmount
9. إذا Full Return → shipping refund مرة واحدة
10. تحديد PaymentStatus
11. إذا Full Return → Order = RETURNED (عبر changeOrderStatus)
12. Movement = RETURN لكل item

### Refund Formula

refundRaw = unitPrice × quantity × (1 - discount / subtotal)

- جميع الحسابات بـDecimal
- ROUND_HALF_UP
- Reconciliation يضمن: Σ refunds = subtotal - discount

### Largest Remainder Method
1. حساب raw لكل item (سنتات)
2. floor + remainders
3. shortfall = target - sum(floors)
4. رتّب حسب أكبر remainder
5. وزّع shortfall سنتاً بسنت
6. علّم آخر معدّل بـisLastAdjustment=true

### Shipping Refund
- جزئي: 0
- كامل: Order.shippingCost مرة واحدة
- Guard: Order.shippingRefunded

### APIs
- POST /api/returns — إنشاء
- GET /api/returns?orderId=X — قائمة
- GET /api/orders/[id]/returnable — القابل للإرجاع
- GET /api/admin/returns?status=X — Admin قائمة
- GET /api/admin/returns/[id] — Admin تفاصيل
- PATCH /api/admin/returns/[id] — approve/reject/complete

### UI
- زر "طلب إرجاع منتجات" في /orders/[id] عند DELIVERED
- ReturnModal: اختيار المنتجات + الكميات + السبب
- عرض طلبات الإرجاع السابقة مع الحالة
- Admin: /admin/returns + /admin/returns/[id]

## 76.21 Git History (v2.8)

بعد v2.7:
- Feat: add ReturnService with refund reconciliation
- Feat: returns API (customer create + returnable items)
- Feat: admin returns APIs (approve/reject/complete)
- Feat: return request UI for customer
- Feat: admin returns UI (list + detail + actions)

End of Section 76 (v2.8)

## 76.22 Admin Users (v2.9)

### الملفات
- app/api/admin/users/route.ts
- app/admin/users/page.tsx

### الميزات
- قائمة كل المستخدمين (100 كحد أقصى)
- إحصائيات: الإجمالي / عملاء / مدراء / مدير عام
- فلترة حسب الدور
- بحث (name, email, phone)
- عرض: عدد الطلبات + تاريخ الانضمام

## 76.23 Admin Categories (v2.9)

### الملفات
- app/api/admin/categories/route.ts
- app/api/admin/categories/[id]/route.ts
- app/admin/categories/page.tsx

### الميزات
- إنشاء / تعديل / Soft Delete
- slug تلقائي (lowercase + replace spaces)
- منع slug مكرر
- منع حذف تصنيف فيه منتجات (يُظهر العدد)
- عرض عدد المنتجات لكل تصنيف
- تفعيل / تعطيل

End of Section 76 (v2.9)

## 76.24 Admin Users & Categories (v2.10)

انظر v2.9 — تم استكمالهما بـ:
- Admin Users page (قائمة + بحث + فلترة + إحصائيات)
- Admin Categories page (CRUD + منع حذف تصنيف فيه منتجات)

## 76.25 SEO (v2.10)

### الملفات
- app/sitemap.ts — Sitemap ديناميكي
- app/robots.ts — robots.txt
- app/layout.tsx — Metadata عامة + metadataBase
- app/product/[slug]/page.tsx — generateMetadata + JSON-LD Product
- app/category/[slug]/page.tsx — generateMetadata + JSON-LD Breadcrumb

### الميزات
- Sitemap يضم: كل المنتجات ACTIVE + كل التصنيفات + ثوابت
- robots.txt يحجب: /admin, /api/, /checkout, /orders, /profile
- كل منتج له: title, description, og:image, JSON-LD
- كل تصنيف له: title, description, breadcrumb
- canonical على كل صفحة
- env: NEXT_PUBLIC_SITE_URL

### نمط الفصل
عندما تحتاج صفحة Client Component أن يكون لها metadata:
1. صفحة `page.tsx` → Server Component (فيها generateMetadata + JSON-LD)
2. صفحة `XxxClient.tsx` → Client Component (نفس المحتوى مع "use client")

**End of Section 76 (v2.10)**

## 76.26 Password Reset (v2.11)

### الملفات
- prisma/schema.prisma — PasswordResetToken model
- services/password-reset.service.ts
- app/api/auth/forgot-password/route.ts
- app/api/auth/reset-password/route.ts
- app/api/auth/verify-reset-token/route.ts
- app/forgot-password/page.tsx
- app/reset-password/page.tsx
- app/login/page.tsx (رابط "نسيت كلمة المرور؟")

### الميزات
- Token عشوائي 32 bytes + SHA-256 في DB
- صلاحية ساعة واحدة
- استخدام مرة واحدة (usedAt)
- إلغاء كل الجلسات عند التعيين (أمان)
- التحقق من Token عند فتح الصفحة (verify-reset-token)
- لا نكشف ما إذا كان البريد موجوداً
- في التطوير: يعرض الرابط في الرد + Terminal
- في الإنتاج: يُرسَل عبر البريد (يحتاج مزود — مؤجل)

### الصفحات
- /forgot-password — إدخال البريد
- /reset-password?token=X — تعيين كلمة جديدة
- رسائل واضحة: صالح / مستخدم / منتهي

## 76.27 Rate Limiting (v2.11)

### الملف
- lib/rate-limit.ts (in-memory)

### الميزات
- 5 محاولات / 15 دقيقة → /api/auth/login
- 3 محاولات / ساعة → /api/auth/register
- 3 محاولات / 30 دقيقة → /api/auth/forgot-password
- header: Retry-After (بالثواني)
- resetRateLimit() عند النجاح
- getClientIp() — x-forwarded-for + x-real-ip

### ملاحظة مهمة
in-memory = يعمل محلياً. عند Vercel → كل instance له ذاكرته.
الحل عند النشر: Redis / Vercel KV.

## 76.28 Fix — Login Error Handling (v2.11)

`AuthService.login` يُطلق `throw` (لا يُرجع null).
تم إضافة `try/catch` مخصص حول الدعوة → يُعيد 401 بدل 500.

**End of Section 76 (v2.11)**

# Section 77 — Multi-Vendor Architecture (v3.0)

## 77.1 Overview

انتقال المشروع من **Single-Seller** إلى **Multi-Vendor Marketplace**.
- كل منتج مرتبط بـ`sellerId` إجباري
- كل طلب يرتبط بـ`sellerId` (Per-Seller Orders)
- كل تاجر له لوحة تحكم مستقلة
- الأدمن يدير كل شيء مركزيّاً

## 77.2 Models الجديدة

| الجدول | الوصف |
|--------|-------|
| `SellerBankAccount` | حسابات بنكية للتاجر (AES-256-GCM) |
| `SellerDocument` | وثائق التاجر (storageKey آمن) |
| `SystemPolicy` | سياسات النظام (قابلة للتغيير) |
| `CostRecord` | سجل التكاليف (شحن، COD، إرجاع) |
| `SellerPerformanceSnapshot` | لقطة شهرية للأداء |
| `SellerPayout` | المدفوعات اليدوية الشهرية |
| `MultiVendorTriggerMetrics` | مؤشرات التحول لـSubOrder |
| `ProductEditLog` | سجل كل تعديل على المنتجات |

## 77.3 التعديلات على Models موجودة

**UserRole:**

CUSTOMER, SELLER, ADMIN, SUPER_ADMIN

**Seller:**
- `commissionRateOverride Decimal?` (5,4)
- 9 حقول Performance (totalOrders, acceptanceRate, ...)
- isVerified, verifiedAt, verifiedById, isFeatured
- city, region, notificationPreferences
- termsAcceptedAt, termsVersion, deletedAt

**Product:**
- `@@unique([sellerId, slug])` — slug فريد لكل تاجر

**ProductVariant:**
- `sellerId Int` (denormalized من Product)
- `originalPrice Decimal?` — Anchor لا يتغير
- `@@unique([sellerId, sku])`

**Category:**
- `commissionRate Decimal?` (5,4)

**Order:**
- `sellerId Int?` (nullable)
- `commission Decimal?`
- `refundedCommission Decimal @default(0)`
- `sellerPayout Decimal?`
- `sellerNotes String?`
- @@index([sellerId, status]), @@index([sellerId, createdAt])

**Notification:**
- `metadata Json?`
- `category String?`
- `severity String?` (INFO / WARNING / CRITICAL)
- `readAt DateTime?`

**NotificationType enum:**
- 8 أنواع جديدة للتجار (SELLER_*)
- SELLER_PRODUCT_EDITED
- SELLER_PRODUCT_NEEDS_REVIEW

## 77.4 قواعد الأمان الجديدة

### Product.sellerId — Immutable
لا يمكن تغيير `sellerId` بعد أول OrderItem.

### ProductVariant.sellerId — لا يختلف عن Product
يُفرض في Service Layer + Cron دوري.

### Sales Flow — Per-Seller Orders
- كل طلب منفصل لكل تاجر في السلة
- Reservation منفصل لكل Order
- إشعار للعميل + إشعار للتاجر + إشعار للأدمن

### Slug Resolution
- قديماً: `/product/[slug]` — فريد عالمياً
- الآن: `@@unique([sellerId, slug])` — فريد لكل تاجر
- **التخطيط:** `/product/[sellerSlug]/[productSlug]` (قيد الإنشاء)

## 77.5 سياسة تعديل المنتج (Smart Edit Policy)

### الحقول الحساسة (تُعيد المنتج لـDRAFT)
- الاسم
- الرابط (slug)
- الوصف
- الماركة
- الشارة
- التصنيف
- الصور

### الحقول الآمنة (لا تُعيد)
- المخزون
- السعر القديم
- شحن مجاني

### السعر — Anchor ضد originalPrice
- `originalPrice` يُعبَّأ أول مرة عند الإنشاء
- لا يتغير أبداً
- حد أدنى: `originalPrice × 0.5`
- حد أقصى: `originalPrice × 2.0`
- أي تعديل خارج النطاق → DRAFT

### ProductEditLog — تسجيل كامل
كل تعديل (حتى الآمن) يُسجَّل:
- changedFields
- oldValues / newValues
- requiresReapproval
- reason (نصي)

## 77.6 Admin Notifications Center

### الميزات
- صفحة `/admin/notifications`
- 4 تصنيفات: PRODUCT, SELLER, ORDER, SYSTEM
- 3 مستويات: INFO, WARNING, CRITICAL
- Metadata كامل في كل إشعار
- Modal تفاصيل مع جدول التغييرات
- فلاتر: category, severity, unread/read
- بحث نصي
- "تحديد الكل كمقروء"

### إشعارات الأدمن التلقائية
- تعديل منتج (آمن) → SELLER_PRODUCT_EDITED
- تعديل منتج (حساس) → SELLER_PRODUCT_NEEDS_REVIEW
- تسجيل تاجر جديد → (قيد الإنشاء)
- طلب جديد → (قيد الإنشاء)

## 77.7 مسار التحول لـSubOrder

**لم نطبّقه بعد.** القرار عند تحقيق 5 مؤشرات:
1. 8-10 تجار فعّالين
2. 15%+ طلبات متعددة التجار
3. 5+ شكاوى عملاء شهرياً
4. تكلفة شحن عبء حقيقي
5. 3%+ إلغاءات بسبب تعدد الشحنات

**عند 4 من 5** → نبدأ التخطيط.

## 77.8 الـMigration Path (من Per-Seller إلى SubOrder)

**الإضافات المطلوبة:**
- جدول `SubOrder` جديد
- حقل `OrderItem.subOrderId Int?` (nullable)

**لا يوجد rework:**
- Order, Payment, Returns, Inventory تبقى كما هي
- فقط إضافة، لا تعديل كاسر

## 77.9 الحماية الإضافية

### SellerBankAccount
- AES-256-GCM encryption (SELLER_DATA_KEY في .env)
- ibanHash + ribHash للتحقق من التكرار
- لا يُعرض إلا في Admin
- AuditLog لكل قراءة

### SellerDocument
- storageKey وليس fileUrl عام
- signed URLs 15 دقيقة
- checksum (SHA-256)

### SystemPolicy
- قيم JSON قابلة للتغيير
- updatedById + updatedAt للتتبع

## 77.10 Git History (v3.0)

docs: DECISIONS v3.0 Multi-Vendor architecture
feat: multi-vendor foundation schema + migration
feat: seller registration flow + become-seller page
feat: seller dashboard + sidebar + layout
feat: seller products CRUD
feat: public store page with SEO
feat: admin sellers list + detail + actions
feat: admin product approval workflow
fix: original price anchor + product edit log
feat: admin notifications center with full

End of Section 77 (v3.0)

# Section 78 — Seller System (v3.1)

## 78.1 Overview

نظام كامل للبائع يغطي:
- التسجيل الذاتي (`/become-seller`)
- لوحة تحكم مستقلة (`/seller/*`)
- إدارة المنتجات والطلبات
- مركز إشعارات
- أداء + مدفوعات

## 78.2 Seller Registration Flow

### `/become-seller`
- صفحة تسويقية + نموذج مزدوج (بيانات شخصية + متجر)
- Rate Limit: 3 محاولات / ساعة / IP
- Slug تلقائي من اسم المتجر (lowercase + hyphens)

### `POST /api/seller/register`
داخل transaction واحدة:
1. إنشاء `User` بـ `role = SELLER`
2. إنشاء `Seller` بـ `status = PENDING`
3. إشعار للأدمن: `SELLER_NEW_REGISTRATION`
4. إنشاء `Session` تلقائياً (تسجيل دخول فوري)

### Authorization
- التاجر PENDING يستطيع: إعداد منتجاته، تعديل ملفه
- التاجر PENDING لا يستطيع: بيع (يحتاج ACTIVE)

## 78.3 Seller Dashboard Structure

├── layout.tsx              ← حماية + Sidebar
├── page.tsx                ← Dashboard
├── products/               ← CRUD
├── orders/                 ← قائمة + تفاصيل
├── notifications/          ← إشعارات
├── reviews/                ← تقييمات
├── performance/            ← أداء
├── payouts/                ← أرباح
├── profile/                ← ملف المتجر
├── bank-accounts/          ← (قيد الإنشاء)
└── documents/              ← (قيد الإنشاء)

### Authorization (SellerLayout)
1. لا جلسة → `/login`
2. ليس SELLER/ADMIN → `/`
3. لا Seller record → `/seller-onboarding`
4. Seller SUSPENDED/CLOSED → صفحة "حسابك معطّل"
5. ✅ يمر

## 78.4 Seller Products CRUD

### الحقول
- name, slug, description, brand, badge
- categoryId, price, oldPrice, stock
- freeShipping, imageUrls[]

### القواعد
- slug فريد لكل تاجر (`@@unique([sellerId, slug])`)
- عند الإنشاء: `status = DRAFT`
- عند الإنشاء: `originalPrice = price` (لا يتغير)
- الصور: `ProductImage[]` مع `order` + `isMain`

### Smart Edit Policy
انظر Section 77.5 — الحقول الحساسة تحتاج موافقة.

## 78.5 Seller Orders

### `GET /api/seller/orders`
- فلترة: `status`, `q` (orderNumber)
- إحصائيات: groupBy status
- يُرجع: 100 طلب + `_count.items`

### `GET /api/seller/orders/[id]`
- يتحقق من `sellerId === current.seller.id`
- يُرجع: order + items + statusHistory

### `PATCH /api/seller/orders/[id]/status`

**الانتقالات المسموحة للتاجر:**

NEW → PROCESSING   (commit sale + reservation CONFIRMED)
PROCESSING → SHIPPED
SHIPPED → DELIVERED (sold increment)

**لا يستطيع التاجر:**
- إلغاء طلب (فقط الأدمن)
- تحويل إلى RETURNED (فقط من ReturnService)
- تخطي مراحل

**داخل كل تغيير:**
- Lock Order
- تحديث status + StatusHistory
- NEW→PROCESSING: `InventoryService.commitSale`
- DELIVERED: `Product.sold += quantity`
- إشعار للعميل: `ORDER_STATUS_CHANGED`
- إشعار للأدمن: `ORDER_STATUS_CHANGED`

## 78.6 Seller Notifications Center

### `/seller/notifications`
- فلاتر: ALL / UNREAD / READ
- بحث نصي
- Modal تفاصيل
- "تحديد الكل كمقروء"

### APIs
- `GET /api/seller/notifications`
- `PATCH /api/seller/notifications/[id]`
- `POST /api/seller/notifications/read-all`

## 78.7 Seller Reviews

### `/seller/reviews`
- فلاتر: ALL / APPROVED / PENDING
- فلتر بالنجوم (1-5)
- إحصائيات: متوسط + رسم بياني
- عرض: المستخدم، المنتج، التقييم، التعليق

### API
- `GET /api/seller/reviews` — يفلتر بـ`sellerId` (عبر Product)

## 78.8 Seller Performance

### المؤشرات
- `totalOrders`, `totalRevenue`, `totalCommission`
- `acceptanceRate` = (NEW→PROCESSING) / total
- `cancellationRate` = CANCELLED / total
- `codRejectionRate` = CANCELLED بعد SHIPPED
- `returnRate` = COMPLETED returns / DELIVERED
- `avgRating` من Reviews معتمدة
- `avgProcessingHours` = (NEW→PROCESSING) متوسط بالوقت

### Script `recalc-sellers`
- `npm run recalc-sellers`
- يحسب كل المؤشرات من البيانات الفعلية
- يستخدم: `OrderStatusHistory` للأوقات

### Quality Score

qualityScore =
acceptance × 0.3 +
(100 - cancellation) × 0.2 +
(avgRating/5 × 100) × 0.3 +
(100 - returnRate) × 0.2

## 78.9 Seller Payouts

### `/seller/payouts`
- الرصيد المتاح = totalEarnings - totalPaidOut - pendingPayouts
- هذا الشهر + آخر 30 يوم
- سجل التحويلات (`SellerPayout`)
- الأرباح حسب الطلب

### مصادر الأرباح
- `Order.sellerPayout` (snapshot عند الإنشاء)
- إذا NULL → `Order.total` (للطلبات القديمة قبل Multi-Vendor)

### Payout Cycle (MVP)
- يدوي شهرياً
- الأدمن يُنشئ `SellerPayout` عند التحويل
- `status`: PENDING → PROCESSING → COMPLETED / FAILED

## 78.10 Seller Profile

### `/seller/profile`
- تعديل: storeName, description, logo, city, region
- **slug محمي** — لا يُعدَّل (يؤثر على روابط المنتجات)
- ImageUploader للشعار (صورة واحدة فقط)

### API
- `GET /api/seller/profile`
- `PATCH /api/seller/profile`

## 78.11 Seller Sidebar

10 روابط:
1. لوحة التحكم
2. الإشعارات
3. منتجاتي
4. طلباتي
5. التقييمات
6. أدائي
7. المدفوعات
8. حساباتي البنكية (قيد الإنشاء)
9. وثائقي (قيد الإنشاء)
10. ملف المتجر

+ عرض المتجر (رابط خارجي) + تسجيل الخروج

## 78.12 Admin Side

### `/admin/sellers`
- فلاتر: PENDING / ACTIVE / SUSPENDED / CLOSED / ALL
- بحث
- إحصائيات

### `/admin/sellers/[id]`
- معلومات كاملة
- Actions: approve, suspend, activate, close, verify
- إشعارات تلقائية للتاجر

### `/admin/products/pending`
- منتجات DRAFT جديدة ومعدّلة
- عرض الفروقات (جدول التغييرات)
- Approve / Reject

### `/admin/notifications`
- فلاتر: category (PRODUCT/SELLER/ORDER/SYSTEM)
- severity (INFO/WARNING/CRITICAL)
- Modal تفاصيل + جدول تغييرات

### `/admin/products`
- 3 شارات: 🆕 جديد / ✏️ مُعدَّل / ⚠️ سعر!
- عمود "التاجر"
- زر "المراجعة (N)"

## 78.13 Admin Notifications (Auto)

يُولَّد تلقائياً عند:
- تعديل منتج (أمن) → `SELLER_PRODUCT_EDITED`
- تعديل منتج (حساس) → `SELLER_PRODUCT_NEEDS_REVIEW`
- تسجيل تاجر → `SELLER_NEW_REGISTRATION`
- طلب جديد → `ORDER_CREATED`
- مراجعة جديدة → `REVIEW_SUBMITTED`
- إرجاع جديد → `RETURN_REQUESTED`
- تحديث حالة طلب (من التاجر) → `ORDER_STATUS_CHANGED`

كل إشعار يحمل `metadata` كامل + `category` + `severity`.

## 78.14 Public URLs Update

### قبل Multi-Vendor

/product/[slug]           ← عالمي
/store/[slug]             ← جديد

### بعد Multi-Vendor

/product/[sellerSlug]/[productSlug]   ← الجديد
/store/[sellerSlug]                    ← قائم

### Redirect Policy
- ❌ لا redirect حالياً (الموقع لم يُنشر)
- ✅ عند النشر: `middleware.ts` لتحويل الروابط القديمة
- ✅ 308 Permanent Redirect (يحفظ SEO)

## 78.15 Product Service — Public Query

Product.status = ACTIVE
Product.deletedAt = null
Seller.status = ACTIVE
Seller.deletedAt = null

**`getBySlugAndSeller(productSlug, sellerSlug)`** — الدالة الأساسية.

## 78.16 Git History (v3.1)

feat: seller registration + become-seller
feat: seller layout + sidebar
feat: seller products CRUD
feat: seller orders list + detail
feat: seller order status management
feat: seller notifications center
feat: seller reviews page
feat: seller performance dashboard
feat: seller payouts dashboard
feat: seller profile page
feat: admin sellers management
feat: admin product approval workflow
feat: admin notifications center
feat: new product URLs (Multi-Vendor)
feat: redirect policy documented

## 78.17 القادم (TODO)

### قيد البناء
- `/seller/bank-accounts` — تشفير AES-256-GCM
- `/seller/documents` — Signed URLs
- `middleware.ts` — Redirect

### مؤجل
- Cron: تحديث `SellerPerformanceSnapshot` شهرياً
- Cron: انتهاء Reservations
- Rate Limiting على `/seller/register` (موجود، لكن شدد النافذة)
- Seller Payouts Automation
- Rate Limits على Action متعددة

### Admin Pages ناقصة
- `/admin/audit-log`
- `/admin/system-policies`
- `/admin/cost-records`
- `/admin/trigger-metrics`

End of Section 78 (v3.1)

# Section 79 — Bank Accounts & Verification (v3.2)

## 79.1 Overview

نظام كامل لإدارة الحسابات البنكية للتجار:
- إضافة حساب مع تشفير AES-256-GCM
- مراجعة وتوثيق من الأدمن
- ربط مع المدفوعات (Payouts)

## 79.2 Encryption System

### الملف
`lib/encryption.ts`

### الخوارزمية
- **AES-256-GCM** (Authenticated Encryption)
- IV: 12 bytes (96 bits — GCM standard)
- AuthTag: 16 bytes (128 bits)
- Key: 32 bytes (256 bits) من `SELLER_DATA_KEY`

### تنسيق البيانات المشفّرة

[IV (12)][AuthTag (16)][Encrypted (variable)]


### المتغير البيئي

SELLER_DATA_KEY=<64 hex chars أو 44 base64 chars>

- يُولَّد بـ: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- **مفتاح منفصل للإنتاج** (لا يُستخدم نفسه في التطوير)
- **لا يُشارك أبداً** ولا يُرفع لـGitHub

### الدوال المتاحة
| الدالة | الوظيفة |
|--------|---------|
| `encrypt(plaintext)` | تشفير → `Uint8Array<ArrayBuffer>` |
| `decrypt(data)` | فك التشفير |
| `hashForLookup(value)` | SHA-256 للتحقق من التكرار |
| `maskIBAN(iban)` | `MA** **** **** 1234` |
| `maskRIB(rib)` | `**** **** **** 1234` |
| `maskName(name)` | `محمد ع.` |

### ملاحظة TypeScript 5.7+
Prisma 7 يطلب `Uint8Array<ArrayBuffer>` (ليس `Buffer<ArrayBufferLike>`).
الحل: `new ArrayBuffer(n)` + `new Uint8Array(arrayBuffer)`.

## 79.3 SellerBankAccount Model

### الحقول الكاملة
```prisma
model SellerBankAccount {
  id                  Int                     @id
  sellerId            Int
  bankName            String
  
  // ═══ مقنّعة للعرض ═══
  accountHolderMasked String
  ibanMasked          String
  ibanLast4           String
  ribMasked           String?
  
  // ═══ مشفّرة (AES-256-GCM) ═══
  accountHolderEnc    Bytes
  ibanEnc             Bytes
  ribEnc              Bytes?
  
  // ═══ للتحقق من التكرار ═══
  ibanHash            String   @unique
  ribHash             String?
  
  // ═══ الحقول الجديدة ═══
  businessName        String?
  accountType         BankAccountType         @default(PERSONAL)
  currency            String                  @default("MAD")
  
  // ═══ حالة التحقق ═══
  verificationStatus  BankAccountVerification @default(PENDING)
  verifiedAt          DateTime?
  verifiedById        Int?
  rejectionReason     String?
  
  // ═══ الحالة ═══
  isDefault           Boolean                 @default(false)
  isActive            Boolean                 @default(true)
  createdAt           DateTime                @default(now())
  updatedAt           DateTime                @updatedAt
  deletedAt           DateTime?
  
  seller Seller @relation(fields: [sellerId], references: [id], onDelete: Cascade)
  
  @@index([sellerId])
  @@index([sellerId, isDefault])
  @@index([sellerId, isActive])
  @@index([verificationStatus])
}

Enums الجديدة

enum BankAccountType {
  PERSONAL
  BUSINESS
}

enum BankAccountVerification {
  PENDING
  VERIFIED
  REJECTED
}

القواعد
• IBAN Hash فريد عالمياً — يمنع تكرار نفس الحساب
• الحساب الأول افتراضي تلقائياً
• لا يمكن حذف الحساب الافتراضي — يُعيَّن بديل أولاً
• Soft Delete (deletedAt)
• بالتعطيل: إذا كان افتراضياً → يُعيَّن بديل تلقائياً 
79.4 BankAccountService
 
الملف
 
services/bank-account.service.ts
 
الدوال

الدالة الوصف
list(sellerId) قائمة الحسابات (بدون تشفير)
create(sellerId, data) إضافة حساب (يُشفّر + hash + mask)
setDefault(sellerId, id) تعيين كافتراضي (Transaction)
deactivate(sellerId, id) تعطيل (مع بديل تلقائي)
remove(sellerId, id) Soft Delete

التحققات
• اسم البنك: 2-80 حرف
• صاحب الحساب: 3-120 حرف
• IBAN: 15-34 حرف، ^[A-Z0-9]+$
• RIB: 20-24 رقم، ^[0-9]+$ (اختياري) 
79.5 Seller APIs
 
/api/seller/bank-accounts
• GET — قائمة الحسابات
• POST — إضافة حساب جديد 
/api/seller/bank-accounts/[id]
• PATCH — set_default / deactivate
• DELETE — Soft Delete 
حماية
• ✅ Seller authentication
• ✅ Ownership check (لا يعدّل حساب تاجر آخر)
• ✅ Zod validation 
79.6 Admin APIs
 
/api/admin/bank-accounts
• GET — قائمة كل الحسابات (فلترة + إحصائيات)
• يُرجع stats: { PENDING, VERIFIED, REJECTED, total } 
/api/admin/bank-accounts/[id]
• GET — تفاصيل كاملة مع فك التشفير (IBAN + RIB + صاحب الحساب)
• PATCH — approve / reject (مع سبب الرفض) 
Approve Flow
 
داخل Transaction:
.1 تحديث verificationStatus = VERIFIED
.2 حفظ verifiedAt + verifiedById
.3 إشعار التاجر: SELLER_PAYOUT_READY 
Reject Flow
 
داخل Transaction:
.1 تحديث verificationStatus = REJECTED
.2 حفظ rejectionReason (إلزامي)
.3 إشعار التاجر: SELLER_PAYOUT_READY (بسبب الرفض) 
79.7 Pages
 
/seller/bank-accounts
• عرض بطاقات الحسابات
• إضافة حساب (Modal)
• تعيين افتراضي / تعطيل / حذف
• عرض حالة التحقق بألوان 
/admin/bank-accounts
• 4 بطاقات إحصائيات (PENDING / VERIFIED / REJECTED / ALL)
• قائمة الحسابات
• Modal "مراجعة" يعرض:
	• معلومات المتجر
	• IBAN الكامل (مفكوك)
	• RIB الكامل (مفكوك)
	• صاحب الحساب الكامل
	• أزرار نسخ
• Approve / Reject 
79.8 Security Rules

القاعدة التطبيق
تشفير البيانات الحساسة AES-256-GCM
فك التشفير للأدمن فقط في /api/admin/* فقط
لا تُسجَّل القيم في Console ❌ لا console.log للبيانات الكاملة
Mask في القوائم ibanMasked فقط
فك التشفير في Modal Admin + AuditLog
مفتاح الإنتاج منفصل مفتاح مختلف لكل بيئة
Hash للتحقق ibanHash @unique

79.9 Seller Complete System — Status
 
✅ مكتمل
• تسجيل تاجر (become-seller)
• Onboarding
• لوحة البائع (Dashboard)
• إدارة المنتجات (CRUD)
• إدارة الطلبات (List + Detail + Status)
• الإشعارات
• التقييمات
• الأداء (Performance)
• المدفوعات (Payouts)
• ملف المتجر (Profile)
• الحسابات البنكية (Bank Accounts) ⭐ v3.2
• Admin: إدارة التجار
• Admin: موافقة المنتجات
• Admin: مركز الإشعارات
• Admin: مراجعة الحسابات البنكية ⭐ v3.2 
🟡 قيد البناء
• /seller/documents — رفع الوثائق (CIN, ICE, RC, IF) 
❌ مؤجل
• Cron: تحديث SellerPerformanceSnapshot شهرياً
• Cron: انتهاء Reservations
• Seller Payouts Automation
• Admin Audit Log Viewer
• Admin System Policies 
79.10 Environment Variables

المتغير الوصف البيئة
DATABASE_URL Neon connection كل البيئات
NEXT_PUBLIC_SITE_URL URL الأساسي كل البيئات
SELLER_DATA_KEY تشفير الحسابات البنكية (32 bytes) منفصل لكل بيئة
UPLOADTHING_TOKEN رفع الصور كل البيئات
CRON_SECRET حماية Cron إنتاج فقط

79.11 Git History (v3.2)

feat: bank accounts encryption (AES-256-GCM)
feat: seller bank accounts API + page
feat: admin bank accounts verification
feat: bank account status notifications
fix: Buffer vs Uint8Array for TypeScript 5.7+
docs: DECISIONS v3.2 bank accounts + verification

End of Section 79 (v3.2)

## Section 81 — COD = Sale مباشر (قرار مُحدَّث)

### القرار

**جميع طلبات الدفع عند الاستلام (COD) تخصم المخزون مباشرة عند إنشاء الطلب.**

لا تستخدم نظام Reservation أو انتهاء الحجز.

### السبب

- COD لا يحتاج خطوة "دفع معلّقة" (لا يوجد Stripe/PayPal بعد)
- عند تأكيد العميل → الطلب = التزام نهائي
- الحجز المؤقت (30 دقيقة) كان يُلغي طلبات مؤكَّدة → سلوك خاطئ

### البنية

```

العميل يؤكد الطلب
↓
Order = NEW + خصم المخزون مباشرة (InventoryService.saleDirect)
↓
Inventory Movement = SALE

إذا أُلغي:
CANCELLED → InventoryService.cancelReturn → RETURN

إذا سُلّم:
DELIVERED → sold++ + منح نقاط ولاء

```

### Idempotency

- عند CANCELLED: فحص `InventoryMovement` بـ`reason: "إلغاء الطلب — إرجاع للمخزون"` قبل الإرجاع
- يمنع إرجاع المخزون مرتين

### Reservation — مستقبلاً

- الجداول `Reservation` و `ReservationItem` تبقى في Schema
- تُستخدم **فقط** عند إضافة دفع إلكتروني معلّق
- `InventoryService.reserve()` و `unreserve()` و `commitSale()` محفوظة للاستقبال
- تم حذف `app/api/cron/expire-reservations/` (لم يعد مطلوباً)

### مسؤوليات الملفات

| العملية | الملف | الدالة |
|---------|-------|--------|
| إنشاء + خصم | `services/order.service.ts` | `saleDirect()` |
| إلغاء (عميل) | `app/api/orders/[id]/cancel/route.ts` | `cancelReturn()` |
| إلغاء (أدمن) | `app/api/admin/orders/[id]/status/route.ts` | `cancelReturn()` |
| تسليم | نفس الملفات أعلاه | `sold++` + ولاء |

# Section 82 — P0 Fixes (v3.3)

## 82.1 Overview

حزمة من 12 إصلاحًا أمنيًا وهندسيًا لسد فجوات في:
* Idempotency
* بيانات العميل (PII)
* تسليم جزئي
* Refunds
* Rate Limiting
* Reset tokens

## 82.2 Schema Constraints الجديدة

```prisma
model InventoryMovement {
  @@unique([referenceType, referenceId, type, inventoryId])
}

model FulfillmentItem {
  @@unique([orderItemId])
}

model ShipmentItem {
  @@unique([fulfillmentItemId])
}

enum OrderStatus {
  PARTIALLY_DELIVERED
}

enum PaymentStatus {
  PARTIALLY_REFUNDED
}
```

82.3 منع IDOR للبائع

البائع لا يرى customerSnapshot أو shippingAddressSnapshot إلا إذا:

```typescript
order.source === "IN_STORE" && order.sellerId === current.seller.id
```

يُطبَّق عبر AccessPolicyService.filterOrderData.

82.4 تسليم جزئي

· Delivery Action يُحدّث FulfillmentItems فقط
· syncOrderFulfillmentStatus تُحدّث:
  · fulfillmentStatus دائمًا
  · status = DELIVERED فقط عند اكتمال كل العناصر
  · status = PARTIALLY_DELIVERED عند جزئي
· sold من عناصر الشحنة فقط
· Loyalty بعد اكتمال الطلب

82.5 Return Idempotency

3 طبقات:

1. Row Lock: SELECT id FROM "ReturnRequest" WHERE id = X FOR UPDATE
2. Atomic updateMany بشرط status
3. Guard: marked.count === 0 → throw

Refund guard:

```typescript
if (newRefundedAmount > Number(ret.order.total)) {
  throw new Error("مجموع الاسترداد يتجاوز إجمالي الطلب");
}
```

82.6 Reset Token Security

· لا console.log(resetUrl) في Production
· فقط عند NODE_ENV !== "production"
· bcrypt.hash خارج Transaction
· updateMany مع usedAt: null

82.7 Document Security

· storageKey يُعاد كـرابط redirect لا URL خام
· endpoints جديدة:
  · GET /api/seller/documents/[id]/download
  · GET /api/admin/documents/[id]/download
· لا console.log(file.url)

82.8 POS Seller Status

البائع يستطيع POS فقط إذا seller.status === "ACTIVE".
PENDING / SUSPENDED / CLOSED → 403.
Audit Log لكل طلب IN_STORE.

82.9 Migration

```bash
npx prisma migrate dev --name add_p0_constraints
```

82.10 Git Commit

```
5b185c6 fix(P0): close critical security and data integrity gaps
```

19 files changed, 514 insertions(+), 439 deletions(-)

---

Section 83 — P1 Fixes (v3.3)

83.1 QR Actions

الواجهة ترسل postponed / refused بدل deferred / rejected.
الملف: app/delivery/scan/page.tsx

83.2 Product URL

/product/${sellerSlug}/${product.slug}
الملف: app/seller/products/page.tsx

83.3 Rate Limiting موزّع

```typescript
const hasKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
const redis = hasKV ? new Redis({ url, token }) : null;

export async function rateLimit(key, limit, windowMs) {
  if (redis) { /* Redis */ }
  else { /* In-memory fallback */ }
}
```

· rateLimit أصبحت async
· resetRateLimit أصبحت async
· 5 API Routes تحتاج await

KV: Upstash Redis / us-east-1 / Free.

83.4 ESLint Rules

```javascript
"@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
"@typescript-eslint/no-explicit-any": "warn",
"react-hooks/exhaustive-deps": "warn",
```

warn لا error → Build لا يكسر. ~300 تحذير حالي.

83.5 Git Commits

```
f29b8a2 feat(security): distributed rate limiting via Upstash Redis
27541cb fix(seller): correct product URL to use sellerSlug/productSlug
```

---

Section 84 — Final Decisions Table (v3.3)

القرار القاعدة النهائية v3.3
Architecture Next.js 16 + Services + Prisma + PostgreSQL
Database Neon PostgreSQL
Currency MAD
Payment MVP COD
Authentication DB Sessions
Password bcrypt cost 12
Rate Limiting Upstash Redis + in-memory fallback
Idempotency (Inventory) @@unique([referenceType, referenceId, type, inventoryId])
Idempotency (Return) Row Lock + Atomic updateMany
Order Status NEW → PROCESSING → SHIPPED → PARTIALLY_DELIVERED → DELIVERED
Payment Status PENDING → PAID → PARTIALLY_REFUNDED → REFUNDED
Partial Shipment Order لا يُصبح DELIVERED إلا باكتمال كل العناصر
FulfillmentItem واحد لكل OrderItem
ShipmentItem واحد لكل FulfillmentItem
PII للبائع فقط لـIN_STORE، عبر AccessPolicyService
POS Seller status === "ACTIVE" فقط
Reset Token Logs فقط في Dev
Document Download Redirect endpoint، لا URL خام
ESLint no-unused-vars, no-explicit-any, exhaustive-deps = warn
Reservation Deprecated (يبقى في Schema للـStripe مستقبلًا)
Refund precision Decimal + ROUND_HALF_UP
Refund reconciliation Largest Remainder Method
Return COMPLETE من APPROVED فقط
Full Return COMPLETED quantities فقط
Order RETURNED عبر changeOrderStatus(tx, ...)
Multi-Vendor مُفعَّل
SubOrder مؤجل (5 مؤشرات)
Email/SMS مؤجل
Stripe مؤجل
AuditLog UI 🟠 مطلوب قبل الإطلاق
Admin Reports 🟠 مطلوب قبل الإطلاق
Shipping Zones UI 🟠 مطلوب قبل الإطلاق
Address CRUD 🟠 مطلوب قبل الإطلاق
إجمالي الإصلاحات 12 P0 + 4 P1 = 16

---

Section 85 — Roadmap (v3.3)

P0 — مكتمل ✅

12 إصلاحًا (Section 82)

P1 — مكتمل ✅

4 إصلاحات (Section 83)

P2 — قيد التنفيذ

# المهمة الأولوية
1 Shipping Zones (فعليًا + UI) 🔴
2 Address CRUD 🔴
3 Admin Reports (أساسي) 🔴
4 Audit Log UI 🟠
5 Cart server-side + merge 🟠
6 Pagination لـProducts/Orders 🟠
7 إصلاح seed.ts 🟠
8 حذف lib/data/* 🟠
9 Privacy + Terms 🔴
10 Backup strategy 🔴

P3 — قبل الإطلاق

· اختبارات E2E
· اختبار Concurrency
· اختبار Security
· Cron Jobs
· README + Postman Collection
· Monitoring + Logging

نقطة الاكتمال الفعلي

✅ 9 من 10 شروط إطلاق متحققة
✅ 0 P0 مفتوحة
✅ 0 P1 مفتوحة
✅ 0 ESLint errors
✅ Build ينجح
✅ اختبار حقيقي لعملية شراء كاملة

End of Section 85 (v3.3)

**End of DECISIONS.md v3.3**