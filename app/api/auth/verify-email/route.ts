import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function escapeHtml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}

// GET: يقرأ فقط، يعرض صفحة تأكيد بزر POST. لا يغيّر الحالة.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(new URL("/login?error=invalid_token", request.url));
    }

    const user = await prisma.user.findFirst({
      where: {
  emailVerificationToken: token,
  emailVerificationExpiresAt: { gt: new Date() },
},
      select: { id: true },
    });

    if (!user) {
      return NextResponse.redirect(new URL("/login?error=invalid_token", request.url));
    }

    const safeToken = escapeHtml(token);
    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>تأكيد البريد - متجر نخبة</title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f5f5f5}
    .card{background:#fff;padding:2rem;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.1);text-align:center;max-width:400px}
    h2{margin:0 0 1rem;color:#111}
    p{color:#555;margin:0 0 1.5rem}
    button{background:#16a34a;color:#fff;border:none;padding:.75rem 2rem;border-radius:8px;font-size:1rem;cursor:pointer;font-weight:600}
    button:hover{background:#15803d}
  </style>
</head>
<body>
  <div class="card">
    <h2>تأكيد البريد الإلكتروني</h2>
    <p>اضغط الزر أدناه لتأكيد بريدك الإلكتروني</p>
    <form method="POST" action="/api/auth/verify-email">
      <input type="hidden" name="token" value="${safeToken}">
      <button type="submit">تأكيد البريد</button>
    </form>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    console.error("Verify email GET error:", error);
    return NextResponse.redirect(new URL("/login?error=server_error", request.url));
  }
}

// POST: ينفذ التأكيد. يدعم form-data (من الزر) و JSON (من fetch).
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let token: string | null = null;

    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => null);
      token = typeof body?.token === "string" ? body.token : null;
    } else {
      const formData = await request.formData().catch(() => null);
      const t = formData?.get("token");
      token = typeof t === "string" ? t : null;
    }

    if (!token) {
      return NextResponse.redirect(new URL("/login?error=invalid_token", request.url));
    }

    const user = await prisma.user.findFirst({
      where: {
  emailVerificationToken: token,
  emailVerificationExpiresAt: { gt: new Date() },
},
      select: { id: true },
    });

    if (!user) {
      return NextResponse.redirect(new URL("/login?error=invalid_token", request.url));
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerificationToken: null },
    });

    return NextResponse.redirect(new URL("/login?verified=true", request.url));
  } catch (error) {
    console.error("Verify email POST error:", error);
    return NextResponse.redirect(new URL("/login?error=server_error", request.url));
  }
}