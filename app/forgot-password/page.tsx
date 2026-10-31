import { ForgotPassword } from "@/components/password-recovery";
export const metadata = {
  title: "Recuperar acceso · Discovery OS",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <ForgotPassword />;
}
