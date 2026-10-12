import { EventList } from "@/components/content/event-list";
import type { SearchQuery } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";
export const metadata = pageMetadata(
  "活動與課程",
  "探索示範講座、工作坊與交流活動，支援活動列表及月曆。",
  "/events",
);
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchQuery>;
}) {
  return <EventList query={await searchParams} />;
}
