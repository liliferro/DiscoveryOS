import Session from "@/components/session";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return <Session slug={(await params).slug} />;
}
