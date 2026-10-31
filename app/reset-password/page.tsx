import { ResetPassword } from "@/components/password-recovery";
export const metadata = {
  title: "Nueva contraseña · Discovery OS",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <ResetPassword />;
}
