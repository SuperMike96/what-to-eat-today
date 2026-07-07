import { useTheme } from "../hooks/useTheme";

const OPTIONS: Array<{ value: "light" | "dark" | "system"; icon: string; label: string }> = [
  { value: "light", icon: "☀️", label: "浅色" },
  { value: "dark", icon: "🌙", label: "深色" },
  { value: "system", icon: "🖥️", label: "跟随系统" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="theme-toggle" role="group" aria-label="主题切换">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={theme === option.value ? "active" : ""}
          aria-pressed={theme === option.value}
          title={option.label}
          onClick={() => setTheme(option.value)}
        >
          <span aria-hidden="true">{option.icon}</span>
        </button>
      ))}
    </div>
  );
}
