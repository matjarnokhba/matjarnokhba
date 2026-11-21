# متجر نخبة — Matjar Nokhba

منصة تجارة إلكترونية مغربية متعددة البائعين: تجزئة، جملة، مستودع، توصيل، محافظ.

## الحالة الحالية

- 142 model + 74 enum في schema.prisma
- 44 migration مطبقة على Neon
- 333 API route + 180 صفحة
- tsc=0، build=0، lint=0 errors (1007 warnings documented)

## Stack

Next.js 16.3.5 (Turbopack) + React 19.2.8 + TypeScript 5.9.3 + Prisma 7.10.0 + Neon + Tailwind 4.3.3 + UploadThing 7.7.4 + Upstash Redis (اختياري).

## بدء التشغيل السريع

1. git clone https://github.com/matjarnokhba/matjarnokhba.git
2. cd matjarnokhba
3. npm install
4. cp .env.example .env  (ثم املأ القيم)
5. npx prisma migrate deploy --config prisma7.config.ts
6. npm run dev

## متغيرات البيئة

| المتغير | إلزامي | الوصف |
|---|---|---|
| DATABASE_URL | نعم | Neon connection string |
| NEXT_PUBLIC_SITE_URL | نعم | http://localhost:3000 في dev |
| GOOGLE_CLIENT_ID / SECRET | اختياري | Google login |
| SMTP_EMAIL / PASSWORD | اختياري | Gmail App Password |
| KV_REST_API_URL / TOKEN | اختياري | Upstash rate limit |
| SELLER_DATA_KEY | اختياري | 32-byte base64 (IBAN encryption) |
| CRON_SECRET | اختياري | Bearer token للـcron |
| UPLOADTHING_TOKEN | اختياري | UploadThing API key |

## هيكل المشروع

- app/ — 180 صفحة + 333 API route (admin, seller, warehouse, wholesale, delivery, collector, cron)
- services/ — 47 خدمة (order, auth, session, inventory, document)
- lib/ — 34 ملف (prisma, seller-guards, page-guards, url-safety)
- prisma/ — schema + 44 migration
- scripts/ — 22 سكربت (كلها محمية)
- components/ — 132 مكوّن

## الترحيلات

npx prisma migrate status --config prisma7.config.ts
npx prisma migrate deploy --config prisma7.config.ts

Neon pooler: استخدم migrate diff + migrate deploy (لا migrate dev).

## الفحوص

npx tsc --noEmit
npm run build
npm run lint
npx prisma validate --config prisma7.config.ts

## السكربتات التشغيلية

كل السكربتات في scripts/ محمية (prod guard +/or confirm flag): reset-everything, reset-warehouse, reset-assemblies, smoke-test-pages, test-phase2, test-workflows, fix-stuck-orders, merge-warehouse-wallets, m12-mark-existing-users-verified.

## الاختبارات

لا إطار آلي حاليًا. خطة M13: vitest + اختبارات وحدة للخدمات الحرجة.

## روابط

- DECISIONS.md — قرارات معمارية
- docs/SCHEMA_FULL.md — مرجع schema (114/63 إلى 142/74، يُحدّث في M12.5)
- .env.example — قالب env

## الترخيص

خاص — متجر نخبة