import type { Prisma } from "@/generated/prisma/client";

// Page and export must apply exactly the same search and account-state filters.
export function memberFilters(
  params: Record<string, string | string[] | undefined>,
) {
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const state =
    params.state === "disabled"
      ? "disabled"
      : params.state === "enabled"
        ? "enabled"
        : "all";
  const where: Prisma.UserWhereInput = {
    ...(state !== "all" ? { disabled: state === "disabled" } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  return { q, state, where };
}
