import { currentUser } from "@/lib/server/access";
import { canAdmin } from "@/lib/admin-permissions";
import { AccessDenied } from "@/components/admin/access-denied";
import { EventEditor } from "@/components/admin/event-editor";
import { emptyEvent } from "@/lib/event-validation";
export default async function Page() {
  const actor = await currentUser();
  if (!actor || !canAdmin(actor.role, "events")) return <AccessDenied />;
  return (
    <>
      <h2>新增活動</h2>
      <EventEditor initial={emptyEvent} />
    </>
  );
}
