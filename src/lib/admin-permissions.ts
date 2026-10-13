export type Capability = "dashboard" | "review" | "members" | "audit";
const grants: Record<Capability, readonly string[]> = {
  dashboard: ["SUPER_ADMIN", "ADMIN", "STAFF", "EDITOR"],
  review: ["SUPER_ADMIN", "ADMIN", "STAFF"],
  members: ["SUPER_ADMIN", "ADMIN"],
  audit: ["SUPER_ADMIN"],
};
export function canAdmin(role: string, capability: Capability) {
  return grants[capability].includes(role);
}
export const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "最高管理員",
  ADMIN: "管理員",
  STAFF: "工作人員",
  EDITOR: "編輯",
  MEMBER: "會員",
};
export const statusLabels = {
  PENDING: "待審核",
  RETURNED: "退回補件",
  APPROVED: "核准",
  REJECTED: "拒絕",
};
export function taipeiDate(value: Date) {
  return value.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour12: false,
  });
}
