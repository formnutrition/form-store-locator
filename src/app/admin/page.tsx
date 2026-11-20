import AdminHeader from "@/components/AdminHeader";
import AdminList from "@/components/AdminList";
import { listStores } from "@/lib/store-repository";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const params = await searchParams;
  const { stores, source } = await listStores();
  return (
    <>
      <AdminHeader signedIn />
      <AdminList stores={stores} source={source} saved={params.saved === "1"} />
    </>
  );
}
