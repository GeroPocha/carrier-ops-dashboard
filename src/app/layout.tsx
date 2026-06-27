import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Carrier Ops Dashboard",
  description: "Inbound carrier sales — live call analytics & actions",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
