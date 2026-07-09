export function CompactHeader({
  selectedCount,
  pendingCount,
  onReset,
}: {
  selectedCount: number;
  pendingCount: number;
  onReset?: () => void;
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
        {onReset && (
          <button className="header-reset" type="button" onClick={onReset}>
            重置
          </button>
        )}
      </div>
    </header>
  );
}
