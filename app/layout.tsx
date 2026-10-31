import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Discovery OS — De preguntas a oportunidades",
  description: "Tu espacio de discovery, investigación y diagnóstico.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
