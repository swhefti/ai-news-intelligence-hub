import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The AI News Intelligence Hub",
  description: "A retrieval-augmented record of the global AI landscape",
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
