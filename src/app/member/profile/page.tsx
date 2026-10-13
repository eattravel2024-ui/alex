import { requireUser } from "@/lib/server/access";
import { db } from "@/lib/server/db";
import { ProfileForm } from "@/components/member/profile-form";
export default async function Page() {
  const user = await requireUser();
  const profile = await db.memberProfile.findUnique({
    where: { userId: user.id },
  });
  return (
    <>
      <h2>個人資料與隱私偏好</h2>
      <p className="section-description">
        只蒐集服務所需資料，電話可留空。信箱變更須另行驗證，目前不開放。
      </p>
      <ProfileForm
        name={user.name}
        phone={profile?.phone ?? ""}
        emailNotifications={profile?.emailNotifications ?? true}
      />
    </>
  );
}
