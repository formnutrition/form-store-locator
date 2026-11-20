import { revalidatePath, revalidateTag } from "next/cache";

/** Drop the public store cache so a save shows up on the next page load. */
export function refreshPublicStores(): void {
  revalidateTag("stores");
  revalidatePath("/api/stores");
}
