export default function Loading() {
  return (
    <div role="status" aria-label="頁面載入中">
      <div className="skeleton" />
      <span className="sr-only">頁面載入中</span>
    </div>
  );
}
