import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Viníssimo SOI",
  description: "Sistema Operacional Inteligente da Viníssimo",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
