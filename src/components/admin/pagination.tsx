import Link from "next/link";
export const adminPageSize = 10;
export function pageNumber(value: string | string[] | undefined) {
  const n = Number(typeof value === "string" ? value : 1);
  return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 10000) : 1;
}
export function Pagination({
  path,
  page,
  total,
  query,
}: {
  path: string;
  page: number;
  total: number;
  query: Record<string, string>;
}) {
  const pages = Math.max(1, Math.ceil(total / adminPageSize));
  function href(p: number) {
    return `${path}?${new URLSearchParams({ ...query, page: String(p) })}`;
  }
  return (
    <nav className="admin-pagination" aria-label="後台分頁">
      <span>
        共 {total} 筆 · 第 {page} / {pages} 頁
      </span>
      {page > 1 && <Link href={href(page - 1)}>上一頁</Link>}
      {page < pages && <Link href={href(page + 1)}>下一頁</Link>}
    </nav>
  );
}
