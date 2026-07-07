export function CompactHeader({
  selectedCount,
  pendingCount,
  remainingCount,
}: {
  selectedCount: number;
  pendingCount: number;
  remainingCount: number;
}) {
  return (
    <header className="compact-header">
      <div className="brand-row">
        <span className="brand-icon">食</span>
        <span>今天吃什么</span>
      </div>
      <div className="header-stats">
        <span>{selectedCount} 已选</span>
        {pendingCount > 0 && <span>{pendingCount} 待定</span>}
        <span>{remainingCount} 待看</span>
      </div>
    </header>
  );
}
