import type { Metadata } from "next";
import { Lato } from "next/font/google";
import "./globals.css";

const lato = Lato({
  weight: ["300", "400", "700", "900"],
  subsets: ["latin"],
  variable: "--font-lato",
});

export const metadata: Metadata = {
  title: "App B - SSO Client",
  description: "Relying Application B - Single Sign-On Client",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${lato.variable} h-full antialiased font-sans`}
    >
      <body className="min-h-full flex flex-col bg-black text-zinc-100 font-sans">{children}</body>
    </html>
  );
}
