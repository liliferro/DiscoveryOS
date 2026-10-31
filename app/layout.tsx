import type { Metadata } from "next";
import "./globals.css";
import RecoveryRedirect from "@/components/recovery-redirect";
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
      <body>
        <RecoveryRedirect />
        {children}
      </body>
    </html>
  );
}
