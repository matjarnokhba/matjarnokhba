import type { Metadata, Viewport } from "next";
import "./globals.css";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://matjarnokhba.com";

// ═══════ Viewport — إجباري لتفادي مشاكل الهاتف ═══════
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#ff5c00",
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "متجر نخبة | Matjar Nokhba",
    template: "%s | متجر نخبة",
  },
  description:
    "متجر نخبة — وجهتك الأولى للتسوق في المغرب. ملابس، إلكترونيات، منزل، جمال، وأكثر. شحن سريع 24-48 ساعة ودفع عند الاستلام.",
  keywords: [
    "متجر نخبة",
    "متجر",
    "نخبة",
    "تسوق",
    "المغرب",
    "ملابس",
    "إلكترونيات",
    "منزل",
    "جمال",
    "عطور",
    "ساعات",
    "أحذية",
    "شحن",
    "دفع عند الاستلام",
  ],
  authors: [{ name: "متجر نخبة" }],
  creator: "متجر نخبة",
  publisher: "متجر نخبة",
  openGraph: {
    type: "website",
    locale: "ar_MA",
    url: BASE_URL,
    siteName: "متجر نخبة",
    title: "متجر نخبة — تسوق أونلاين في المغرب",
    description:
      "تسوق أونلاين بأفضل الأسعار. شحن سريع 24-48 ساعة، دفع عند الاستلام، منتجات أصلية 100%.",
  },
  twitter: {
    card: "summary_large_image",
    title: "متجر نخبة — تسوق أونلاين في المغرب",
    description:
      "شحن سريع، دفع عند الاستلام، منتجات أصلية. تسوّق الآن!",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: BASE_URL,
  },
  category: "shopping",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}