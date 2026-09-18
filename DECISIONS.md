# DECISIONS.md

# متجر نخبة — Engineering Decisions

**Version:** 2.2
**Status:** Final Architecture Reference
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
```

**End of DECISIONS.md v2.2**
