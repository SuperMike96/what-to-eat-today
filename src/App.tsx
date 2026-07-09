import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { AppStep } from "./types";
import { dishes } from "./data/dishes";
import {
  MAX_SERVINGS,
  MIN_SERVINGS,
  initialState,
  usePersistentState,
  type PersistedState,
} from "./hooks/usePersistentState";
import { useSwipeSession } from "./hooks/useSwipeSession";
import { addUnique, difficultyLabel, getDishes, remove } from "./lib/dishActions";
import { buildShoppingList, categoryLabels, categoryOrder, formatQuantity } from "./utils/shopping";
import { TabBar } from "./components/TabBar";
import { CompactHeader } from "./components/CompactHeader";
import { SwipeDishCard } from "./components/SwipeDishCard";

// Code-split the two heavier tab screens so the initial bundle stays small (R12).
const ShoppingScreen = lazy(() =>
  import("./components/ShoppingScreen").then((m) => ({ default: m.ShoppingScreen })),
);
const RecipeScreen = lazy(() =>
  import("./components/RecipeScreen").then((m) => ({ default: m.RecipeScreen })),
);

export function App() {
  const [state, setState] = usePersistentState();
  const selectedDishes = useMemo(() => getDishes(state.selectedDishIds), [state.selectedDishIds]);
  const pendingDishes = useMemo(() => getDishes(state.pendingDishIds), [state.pendingDishIds]);
  const skippedDishes = useMemo(() => getDishes(state.skippedDishIds), [state.skippedDishIds]);
  const remainingDishes = useMemo(
    () =>
      dishes.filter(
        (dish) =>
          !state.selectedDishIds.includes(dish.id) &&
          !state.pendingDishIds.includes(dish.id) &&
          !state.skippedDishIds.includes(dish.id),
      ),
    [state.selectedDishIds, state.pendingDishIds, state.skippedDishIds],
  );
  const activeDish = remainingDishes[0];
  const shoppingList = useMemo(
    () => buildShoppingList(selectedDishes, state.servings, state.checkedMap),
    [selectedDishes, state.servings, state.checkedMap],
  );

  // Swipe session: applySwipe, undoLast, sweep, preview, intro, keyboard shortcuts
  const session = useSwipeSession({ state, setState, activeDish });

  const patch = (partial: Partial<PersistedState>) => setState((current) => ({ ...current, ...partial }));
  const setStep = (step: AppStep) => patch({ step });
  const setTab = (tab: AppStep) => setStep(tab);

  const resetAll = () => setState(() => structuredClone(initialState));

  // Batch pending actions
  const addAllPending = () => {
    patch({
      selectedDishIds: [...state.selectedDishIds, ...state.pendingDishIds.filter((id) => !state.selectedDishIds.includes(id))],
      pendingDishIds: [],
    });
  };
  const removeAllPending = () => patch({ pendingDishIds: [] });

  // Restore skipped dish
  const restoreDish = (dishId: string) => patch({ skippedDishIds: remove(state.skippedDishIds, dishId) });

  // Reorder selected dishes — both menu and recipe tabs follow this order
  const moveDish = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || to >= state.selectedDishIds.length) return;
    const newIds = [...state.selectedDishIds];
    const [moved] = newIds.splice(from, 1);
    newIds.splice(to, 0, moved);
    patch({ selectedDishIds: newIds });
  };

  // Drag-to-reorder state (HTML5 DnD for desktop)
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Copy shopping list to clipboard
  const [copied, setCopied] = useState(false);
  const copyShoppingList = async () => {
    const lines = categoryOrder
      .map((cat) => {
        const items = shoppingList.filter((i) => i.category === cat);
        if (!items.length) return "";
        return `${categoryLabels[cat]}\n${items.map((i) => `  ${i.checked ? "[x]" : "[ ]"} ${i.name} ${formatQuantity(i.quantity)}${i.unit}`).join("\n")}`;
      })
      .filter(Boolean);
    const text = `采购清单 (${selectedDishes.length} 道菜, ${state.servings} 人份)\n\n${lines.join("\n\n")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  };

  // Skipped section toggle
  const [showSkipped, setShowSkipped] = useState(false);

  // Prune checkedMap
  useEffect(() => {
    const validKeys = new Set(shoppingList.map((item) => item.key));
    const hasStale = Object.keys(state.checkedMap).some((key) => !validKeys.has(key));
    if (!hasStale) return;
    setState((current) => ({
      ...current,
      checkedMap: Object.fromEntries(Object.entries(current.checkedMap).filter(([key]) => validKeys.has(key))),
    }));
  }, [shoppingList, state.checkedMap, setState]);

  const tabBadge = state.selectedDishIds.length + state.pendingDishIds.length;

  return (
    <div className="app-shell">
      {/* ===== 紧凑顶栏 ===== */}
      {state.step === "swipe" && (
        <CompactHeader
          selectedCount={state.selectedDishIds.length}
          pendingCount={state.pendingDishIds.length}
          onReset={resetAll}
        />
      )}

      {/* ===== 刷卡首页 ===== */}
      {state.step === "swipe" ? (
        <main className="swipe-screen-v2">
          <section className="deck-panel" aria-label="菜品卡片">
            <div className="deck-shell">
              {remainingDishes.slice(1, 3).map((dish, index) => (
                <div
                  aria-hidden="true"
                  className="dish-card ghost"
                  key={dish.id}
                  style={{ transform: `translateY(${(index + 1) * 12}px) scale(${1 - (index + 1) * 0.04})` }}
                >
                  <img className="dish-card-image" src={dish.imageUrl} alt="" draggable={false} />
                </div>
              ))}
              {activeDish ? (
                <SwipeDishCard
                  key={activeDish.id}
                  dish={activeDish}
                  preview={session.preview}
                  showIntro={!session.introDismissed && state.history.length === 0}
                  onIntroDismiss={session.dismissIntro}
                  onSwipe={(action) => session.applySwipe(activeDish.id, action)}
                />
              ) : (
                <div className="deck-complete">
                  <div className="deck-complete-emoji" aria-hidden="true">🎉</div>
                  <h2>今日菜单已生成</h2>
                  <p>
                    右滑的 {state.selectedDishIds.length} 道菜已进入菜单，待定 {state.pendingDishIds.length} 道。
                  </p>
                  <div className="deck-complete-actions">
                    <button className="primary-button" type="button" onClick={() => setStep("menu")}>
                      查看菜单
                    </button>
                    <button className="secondary-button" type="button" onClick={resetAll}>
                      再滑一轮
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>
      ) : null}

      {/* ===== 菜单 Tab ===== */}
      {state.step === "menu" ? (
        <main className="flow-page">
          <header className="flow-header">
            <div>
              <h1>已选菜单</h1>
            </div>
            <div className="serving-control">
              <button onClick={() => patch({ servings: Math.max(MIN_SERVINGS, state.servings - 1) })} type="button">−</button>
              <span>{state.servings} 人份</span>
              <button onClick={() => patch({ servings: Math.min(MAX_SERVINGS, state.servings + 1) })} type="button">+</button>
            </div>
          </header>
          {selectedDishes.length ? (
            <div className="dish-list">
              {selectedDishes.map((dish, index) => (
                <article
                  className={`list-card ${dragIndex === index ? "dragging" : ""} ${dragOverIndex === index && dragIndex !== index ? "drag-over" : ""}`}
                  key={dish.id}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverIndex(index); }}
                  onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex !== null) moveDish(dragIndex, index);
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                >
                  <img src={dish.imageUrl} alt={dish.name} draggable={false} />
                  <div>
                    <h3>{dish.name}</h3>
                    <p>{dish.description}</p>
                    <span>{dish.cookTimeMinutes} 分钟 · {difficultyLabel(dish.difficulty)}</span>
                  </div>
                  <div className="list-card-actions">
                    <div className="reorder-buttons">
                      <button className="icon-button small" disabled={index === 0} onClick={() => moveDish(index, index - 1)} type="button" aria-label="上移">↑</button>
                      <button className="icon-button small" disabled={index === selectedDishes.length - 1} onClick={() => moveDish(index, index + 1)} type="button" aria-label="下移">↓</button>
                    </div>
                    <button className="icon-button" onClick={() => patch({ selectedDishIds: remove(state.selectedDishIds, dish.id) })} type="button">删除</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>还没有选中菜品</h3>
              <p>回到首页继续滑卡片，右滑就能把菜加入菜单。</p>
            </div>
          )}

          {/* ===== 待定区域 + 批量操作 ===== */}
          {pendingDishes.length > 0 && (
            <section className="pending-section">
              <div className="pending-header">
                <h2>待定 ({pendingDishes.length})</h2>
                <div className="pending-batch-actions">
                  <button className="primary-button small" onClick={addAllPending} type="button">全部加入</button>
                  <button className="text-button" onClick={removeAllPending} type="button">全部移除</button>
                </div>
              </div>
              <div className="dish-list">
                {pendingDishes.map((dish) => (
                  <article className="list-card" key={dish.id}>
                    <img src={dish.imageUrl} alt={dish.name} draggable={false} />
                    <div>
                      <h3>{dish.name}</h3>
                      <p>{dish.description}</p>
                      <span>{dish.cookTimeMinutes} 分钟 · {difficultyLabel(dish.difficulty)}</span>
                    </div>
                    <div className="pending-inline-actions">
                      <button className="text-button" onClick={() => patch({ pendingDishIds: remove(state.pendingDishIds, dish.id) })} type="button">移除</button>
                      <button className="primary-button small" onClick={() => patch({ pendingDishIds: remove(state.pendingDishIds, dish.id), selectedDishIds: addUnique(state.selectedDishIds, dish.id) })} type="button">加入</button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* ===== 已跳过区域（可恢复） ===== */}
          {skippedDishes.length > 0 && (
            <section className="skipped-section">
              <button className="skipped-toggle" onClick={() => setShowSkipped(!showSkipped)} type="button">
                已跳过 ({skippedDishes.length}) {showSkipped ? "▲" : "▼"}
              </button>
              {showSkipped && (
                <div className="dish-list skipped-grid">
                  {skippedDishes.map((dish) => (
                    <article className="list-card" key={dish.id}>
                      <img src={dish.imageUrl} alt={dish.name} draggable={false} />
                      <div>
                        <h3>{dish.name}</h3>
                        <p>{dish.description}</p>
                        <span>{dish.cookTimeMinutes} 分钟</span>
                      </div>
                      <button className="primary-button small" onClick={() => restoreDish(dish.id)} type="button">恢复</button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
      ) : null}

      {/* ===== 清单 Tab ===== */}
      {state.step === "shopping" ? (
        <Suspense fallback={<div className="loading-state">加载中…</div>}>
          <ShoppingScreen
            list={shoppingList}
            toggle={(key) => patch({ checkedMap: { ...state.checkedMap, [key]: !state.checkedMap[key] } })}
            onCopy={copyShoppingList}
            copied={copied}
          />
        </Suspense>
      ) : null}

      {/* ===== 菜谱 Tab ===== */}
      {state.step === "recipes" ? (
        <Suspense fallback={<div className="loading-state">加载中…</div>}>
          <RecipeScreen dishes={selectedDishes} recipeIndex={state.recipeIndex} patch={patch} />
        </Suspense>
      ) : null}

      {/* ===== 底部 Tab 栏 ===== */}
      <TabBar active={state.step} onChange={setTab} badge={tabBadge} />
    </div>
  );
}
