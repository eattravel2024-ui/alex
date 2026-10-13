import "server-only";
export function contactEnabled() {
  return process.env.CONTACT_SUBMISSIONS_ENABLED === "true";
}
