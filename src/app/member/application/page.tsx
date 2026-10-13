import { requireUser } from "@/lib/server/access";
import { db } from "@/lib/server/db";
import { ApplicationForm } from "@/components/member/application-form";
const labels = {
  PENDING: "待審核",
  RETURNED: "退回補件",
  APPROVED: "核准",
  REJECTED: "拒絕",
};
export default async function Page() {
  const user = await requireUser();
  const [applications, types, membership] = await Promise.all([
    db.membershipApplication.findMany({
      where: { userId: user.id },
      include: { type: true, history: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    }),
    db.membershipType.findMany({
      where: { active: true },
      select: { id: true, name: true, description: true },
    }),
    db.membership.findUnique({ where: { userId: user.id } }),
  ]);
  return (
    <>
      <h2>入會申請</h2>
      {process.env.MEMBERSHIP_APPLICATIONS_ENABLED === "true" ? (
        <ApplicationForm
          types={types}
          canSubmit={
            !membership && !applications.some((a) => a.status === "PENDING")
          }
        />
      ) : (
        <p className="demo-warning">申請目前尚未開放。</p>
      )}
      <h2 className="subsection-title">我的申請進度</h2>
      {applications.length ? (
        applications.map((application) => (
          <article key={application.id} className="application-record">
            <h3>
              {application.type.name} · {labels[application.status]}
            </h3>
            <p>{application.motivation}</p>
            {application.reviewNote && (
              <p>審核回覆：{application.reviewNote}</p>
            )}
            <ol>
              {application.history.map((h) => (
                <li key={h.id}>
                  {labels[h.toStatus]} ·{" "}
                  {h.createdAt.toLocaleString("zh-TW", {
                    timeZone: "Asia/Taipei",
                  })}
                  {h.note && ` · ${h.note}`}
                </li>
              ))}
            </ol>
          </article>
        ))
      ) : (
        <p className="section-description">尚未送出申請。</p>
      )}
    </>
  );
}
