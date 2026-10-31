import Session from "@/components/session";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <Session runId={(await params).id} />;
}
export const metadata = { robots: { index: false, follow: false } };
