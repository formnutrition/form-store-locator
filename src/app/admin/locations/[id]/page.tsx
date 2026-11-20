import { notFound } from "next/navigation";
import AdminHeader from "@/components/AdminHeader";
import LocationForm from "@/components/LocationForm";
import { getStore } from "@/lib/store-repository";

export const dynamic = "force-dynamic";

export default async function EditLocationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { store } = await getStore(id);
  if (!store) notFound();
  return (
    <>
      <AdminHeader signedIn />
      {query.saved === "1" ? (
        <p className="mx-auto max-w-2xl px-4 pt-6 text-sm">Saved. The store locator will catch up within a minute.</p>
      ) : null}
      <LocationForm store={store} />
    </>
  );
}
