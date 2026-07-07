import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { AppStep, SwipeActionKind } from "./types";
import { dishes } from "./data/dishes";
import {
  HISTORY_LIMIT,
  MAX_SERVINGS,
  MIN_SERVINGS,
  initialState,
  usePersistentState,
  type PersistedState,
} from "./hooks/usePersistentState";
import { addUnique, difficultyLabel, getDishes, remove, updateListsByAction } from "./lib/dishActions";
import { buildShoppingList } from "./utils/shopping";
import { TabBar } from "./components/TabBar";
import { CompactHeader } from "./components/CompactHeader";
import { SwipeDishCard } from "./components/SwipeDishCard";
import { ThemeToggle } from "./components/ThemeToggle";

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

  const activeDishIdRef = useRef<string | undefined>(activeDish?.id);
  activeDishIdRef.current = activeDish?.id;

  const patch = (partial: Partial<PersistedState>) => setState((current) => ({ ...current, ...partial }));
  const setStep = (step: AppStep) => patch({ step });
  const setTab = (tab: AppStep) => setStep(tab);

  const applySwipe = (dishId: string, action: SwipeActionKind) => {
    setState((current) => {
      const lists = updateListsByAction(current, dishId, action);
      const nextHistory = [...current.history, { dishId, action, timestamp: Date.now() }];
      const trimmedHistory = nextHistory.length > HISTORY_LIMIT ? nextHistory.slice(-HISTORY_LIMIT) : nextHistory;
      return { ...current, ...lists, history: trimmedHistory };
    });
  };

  const undoLast = () => {
    setState((current) => {
      const last = current.history[current.history.length - 1];
      if (!last) return current;
      const lists = updateListsByAction(current, last.dishId, null);
      return { ...current, ...lists, history: current.history.slice(0, -1) };
    });
  };

  const resetAll = () => setState(() => structuredClone(initialState));

  // Prune checkedMap so it never accumulates stale keys for dishes removed from
  // the menu (R7).
  useEffect(() => {
    const validKeys = new Set(shoppingList.map((item) => item.key));
    const hasStale = Object.keys(state.checkedMap).some((key) => !validKeys.has(key));
    if (!hasStale) return;
    setState((current) => ({
      ...current,
      checkedMap: Object.fromEntries(Object.entries(current.checkedMap).filter(([key]) => validKeys.has(key))),
    }));
  }, [shoppingList, state.checkedMap, setState]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // Ignore OS key auto-repeat so a held arrow key doesn't fire dozens of swipes (R6).
      if (event.repeat) return;
      // Undo is only meaningful while swiping; limit its scope so Ctrl+Z on the
      // menu/shopping/recipes tabs doesn't silently remove a dish selection (R3).
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        if (state.step !== "swipe") return;
        event.preventDefault();
        undoLast();
        return;
      }
      if (state.step !== "swipe") return;
      const id = activeDishIdRef.current;
      if (!id) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); applySwipe(id, "skip"); }
      else if (event.key === "ArrowUp") { event.preventDefault(); applySwipe(id, "pending"); }
      else if (event.key === "ArrowRight") { event.preventDefault(); applySwipe(id, "like"); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step, state.history.length]);

  const tabBadge = state.selectedDishIds.length + state.pendingDishIds.length;

  return (
    <div className="app-shell">
      <ThemeToggle />

      {/* ===== 紧凑顶栏 ===== */}
      {state.step === "swipe" && (
        <CompactHeader
          selectedCount={state.selectedDishIds.length}
          pendingCount={state.pendingDishIds.length}
          remainingCount={remainingDishes.length}
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
                <SwipeDishCard dish={activeDish} onSwipe={(action) => applySwipe(activeDish.id, action)} />
              ) : (
                <div className="deck-complete">
                  <h2>菜品看完啦</h2>
                  <p>可以进入菜单确认，也可以重置后再来一轮。</p>
                </div>
              )}
            </div>
            <div className="action-dock">
              <button className="round-action skip" onClick={() => activeDish && applySwipe(activeDish.id, "skip")} type="button" disabled={!activeDish}>
                <span>跳过</span>
              </button>
              <button className="round-action pending" onClick={() => activeDish && applySwipe(activeDish.id, "pending")} type="button" disabled={!activeDish}>
                <span>待定</span>
              </button>
              <button className="round-action like" onClick={() => activeDish && applySwipe(activeDish.id, "like")} type="button" disabled={!activeDish}>
                <span>想吃</span>
              </button>
            </div>
            <div className="deck-secondary-actions">
              <button className="text-button" onClick={undoLast} type="button" disabled={!state.history.length}>撤销</button>
              <button className="text-button" onClick={resetAll} type="button">重置</button>
            </div>
            <div className="swipe-shortcut-hint" aria-hidden="true">
              <kbd>←</kbd>跳过 <kbd>↑</kbd>待定 <kbd>→</kbd>想吃 <kbd>Ctrl+Z</kbd>撤销
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
              {selectedDishes.map((dish) => (
                <article className="list-card" key={dish.id}>
                  <img src={dish.imageUrl} alt={dish.name} draggable={false} />
                  <div>
                    <h3>{dish.name}</h3>
                    <p>{dish.description}</p>
                    <span>{dish.cookTimeMinutes} 分钟 · {difficultyLabel(dish.difficulty)}</span>
                  </div>
                  <button className="icon-button" onClick={() => patch({ selectedDishIds: remove(state.selectedDishIds, dish.id) })} type="button">删除</button>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>还没有选中菜品</h3>
              <p>回到首页继续滑卡片，右滑就能把菜加入菜单。</p>
            </div>
          )}

          {/* ===== 待定区域（合并进菜单） ===== */}
          {pendingDishes.length > 0 && (
            <section className="pending-section">
              <h2>待定 ({pendingDishes.length})</h2>
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
        </main>
      ) : null}

      {/* ===== 清单 Tab ===== */}
      {state.step === "shopping" ? (
        <Suspense fallback={<div className="loading-state">加载中…</div>}>
          <ShoppingScreen
            list={shoppingList}
            toggle={(key) => patch({ checkedMap: { ...state.checkedMap, [key]: !state.checkedMap[key] } })}
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
