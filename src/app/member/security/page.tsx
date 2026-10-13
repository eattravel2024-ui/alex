import { requireUser } from "@/lib/server/access";
import { db } from "@/lib/server/db";
import { AuthForm } from "@/components/member/auth-form";
import { SessionsList } from "@/components/member/member-actions";
export default async function Page() {
  const user = await requireUser();
  const sessions = await db.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    select: { id: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <>
      <h2>修改密碼</h2>
      <AuthForm mode="change" />
      <SessionsList
        sessions={sessions.map((s) => ({
          ...s,
          createdAt: s.createdAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
        }))}
      />
    </>
  );
}
