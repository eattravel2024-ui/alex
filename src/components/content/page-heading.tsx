import Link from "next/link";
export function Breadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav className="breadcrumb" aria-label="麵包屑">
      <ol>
        <li>
          <Link href="/">首頁</Link>
        </li>
        {items.map((item, i) => (
          <li key={i}>
            {item.href ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
export function PageHeading({
  title,
  description,
  eyebrow,
  items,
}: {
  title: string;
  description: string;
  eyebrow: string;
  items: { label: string; href?: string }[];
}) {
  return (
    <section className="page-hero">
      <div className="container">
        <Breadcrumb items={items} />
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-intro">{description}</p>
        <p className="demo-label">開發示範內容 · 尚非協會正式資訊</p>
      </div>
    </section>
  );
}
