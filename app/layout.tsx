import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "متجر نخبة",
  description: "متجر نخبة - تسوق بأسلوب راقٍ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}