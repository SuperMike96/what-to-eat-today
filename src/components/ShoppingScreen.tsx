import type { ShoppingListItem } from "../types";
import { categoryLabels, categoryOrder, formatQuantity } from "../utils/shopping";

export function ShoppingScreen({
  list,
  toggle,
  onCopy,
  copied,
}: {
  list: ShoppingListItem[];
  toggle: (key: string) => void;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <main className="flow-page">
      <header className="flow-header">
        <div>
          <h1>采购清单</h1>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {list.length > 0 && onCopy && (
            <button className="secondary-button small" onClick={onCopy} type="button">
              {copied ? "已复制 ✓" : "复制清单"}
            </button>
          )}
        </div>
      </header>
      {list.length ? (
        <div className="shopping-groups">
          {categoryOrder.map((category) => {
            const items = list.filter((item) => item.category === category);
            if (!items.length) return null;
            return (
              <section className="shopping-group" key={category}>
                <h2>{categoryLabels[category]}</h2>
                <div className="shopping-items">
                  {items.map((item) => (
                    <label className={`shopping-item ${item.checked ? "checked" : ""}`} key={item.key}>
                      <input checked={item.checked} onChange={() => toggle(item.key)} type="checkbox" />
                      <span>{item.name}</span>
                      <strong>{formatQuantity(item.quantity)}{item.unit}</strong>
                    </label>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <h3>清单暂时为空</h3>
          <p>至少选择一道菜后，系统会自动汇总食材。</p>
        </div>
      )}
    </main>
  );
}
