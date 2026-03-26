import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ShiftAware",
  description: "Privacy-first shift management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased bg-gray-50 text-gray-900"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
