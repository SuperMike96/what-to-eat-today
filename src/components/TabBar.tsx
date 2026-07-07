import type { AppStep } from "../types";

export function TabBar({ active, onChange, badge }: { active: AppStep; onChange: (tab: AppStep) => void; badge: number }) {
  const tabs: Array<{ key: AppStep; icon: string; label: string }> = [
    { key: "swipe", icon: "🍳", label: "挑选" },
    { key: "menu", icon: "📋", label: "菜单" },
    { key: "shopping", icon: "🛒", label: "清单" },
    { key: "recipes", icon: "📖", label: "菜谱" },
  ];
  return (
    <nav className="tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`tab-item ${active === tab.key ? "active" : ""}`}
          onClick={() => onChange(tab.key)}
          type="button"
        >
          <span className="tab-icon">{tab.icon}</span>
          <span className="tab-label">{tab.label}</span>
          {tab.key === "menu" && badge > 0 ? <span className="tab-badge">{badge}</span> : null}
        </button>
      ))}
    </nav>
  );
}
