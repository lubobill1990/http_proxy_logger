import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HTTP Proxy Log Viewer",
  description: "View and analyze HTTP proxy logs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
