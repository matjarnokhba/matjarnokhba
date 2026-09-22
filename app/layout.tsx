import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "متجر نخبة | Matjar Nokhba",
  description:
    "متجر نخبة — وجهتك الأولى للتسوق في المغرب. ملابس، إلكترونيات، منزل، جمال، وأكثر. شحن سريع ودفع عند الاستلام.",
  keywords: [
    "متجر",
    "نخبة",
    "تسوق",
    "المغرب",
    "ملابس",
    "إلكترونيات",
    "شحن",
    "دفع عند الاستلام",
  ],
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