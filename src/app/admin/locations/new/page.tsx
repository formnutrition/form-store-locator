import AdminHeader from "@/components/AdminHeader";
import LocationForm from "@/components/LocationForm";

export const dynamic = "force-dynamic";

export default function NewLocationPage() {
  return (
    <>
      <AdminHeader signedIn />
      <LocationForm store={null} />
    </>
  );
}
