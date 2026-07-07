import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { dishes } from "./data/dishes";
import type { AppStep, Dish, RecipeMedia, ShoppingListItem, SwipeAction, SwipeActionKind, UserSelection } from "./types";
import { buildShoppingList, categoryLabels, categoryOrder, formatQuantity } from "./utils/shopping";

type PersistedState = UserSelection & {
  step: AppStep;
  checkedMap: Record<string, boolean>;
  recipeIndex: number;
};

const initialState: PersistedState = {
  step: "swipe",
  selectedDishIds: [],
  pendingDishIds: [],
  skippedDishIds: [],
  history: [],
  servings: 2,
  checkedMap: {},
  recipeIndex: 0,
};

const storageKey = "what-to-eat-web-mvp-v1";
const STEP_VALUES: AppStep[] = ["swipe", "menu", "shopping", "recipes"];

const SWIPE_THRESHOLD = 110;
const STAMP_THRESHOLD = 44;
const HISTORY_LIMIT = 50;
const MIN_SERVINGS = 1;
const MAX_SERVINGS = 12;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((v) => typeof v === "string");

function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      step: STEP_VALUES.includes(parsed.step as AppStep) ? (parsed.step as AppStep) : initialState.step,
      selectedDishIds: isStringArray(parsed.selectedDishIds) ? parsed.selectedDishIds : [],
      pendingDishIds: isStringArray(parsed.pendingDishIds) ? parsed.pendingDishIds : [],
      skippedDishIds: isStringArray(parsed.skippedDishIds) ? parsed.skippedDishIds : [],
      history: Array.isArray(parsed.history)
        ? parsed.history
            .filter(
              (h): h is SwipeAction =>
                !!h && typeof h.dishId === "string" && (["like", "pending", "skip"] as const).includes(h.action),
            )
            .slice(-HISTORY_LIMIT)
        : [],
      servings:
        typeof parsed.servings === "number" && parsed.servings >= MIN_SERVINGS && parsed.servings <= MAX_SERVINGS
          ? Math.round(parsed.servings)
          : initialState.servings,
      checkedMap:
        parsed.checkedMap && typeof parsed.checkedMap === "object" ? (parsed.checkedMap as Record<string, boolean>) : {},
      recipeIndex: typeof parsed.recipeIndex === "number" && parsed.recipeIndex >= 0 ? Math.floor(parsed.recipeIndex) : 0,
    };
  } catch {
    return initialState;
  }
}

function saveState(state: PersistedState) {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function usePersistentState() {
  const [state, setState] = useState<PersistedState>(() => loadState());

  // Persist as a side effect of state changes (debounced). This keeps the
  // updater pure — writing to localStorage inside a setState updater is an
  // anti-pattern that breaks under React StrictMode double-invocation and
  // blocks the main thread on every keystroke/swipe.
  useEffect(() => {
    const timer = setTimeout(() => saveState(state), 150);
    return () => clearTimeout(timer);
  }, [state]);

  return [state, setState] as const;
}

const remove = (items: string[], item: string) => items.filter((id) => id !== item);
const addUnique = (items: string[], item: string) => (items.includes(item) ? items : [...items, item]);

type DishLists = Pick<PersistedState, "selectedDishIds" | "pendingDishIds" | "skippedDishIds">;

// Single source of truth for moving a dish between the selected / pending / skipped
// lists. `action === null` removes the dish from every list (used by undo).
function updateListsByAction(lists: DishLists, dishId: string, action: SwipeActionKind | null): DishLists {
  const next: DishLists = {
    selectedDishIds: remove(lists.selectedDishIds, dishId),
    pendingDishIds: remove(lists.pendingDishIds, dishId),
    skippedDishIds: remove(lists.skippedDishIds, dishId),
  };
  if (action === "like") next.selectedDishIds = addUnique(next.selectedDishIds, dishId);
  else if (action === "pending") next.pendingDishIds = addUnique(next.pendingDishIds, dishId);
  else if (action === "skip") next.skippedDishIds = addUnique(next.skippedDishIds, dishId);
  return next;
}

function getDishes(ids: string[]) {
  return ids.map((id) => dishes.find((dish) => dish.id === id)).filter((dish): dish is Dish => Boolean(dish));
}

const difficultyLabel = (level: Dish["difficulty"]) =>
  level === "easy" ? "简单" : level === "medium" ? "适中" : "进阶";

function TabBar({ active, onChange, badge }: { active: AppStep; onChange: (tab: AppStep) => void; badge: number }) {
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

function CompactHeader({ selectedCount, pendingCount, remainingCount }: { selectedCount: number; pendingCount: number; remainingCount: number }) {
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

function SwipeDishCard({ dish, onSwipe }: { dish: Dish; onSwipe: (action: SwipeActionKind) => void }) {
  const [drag, setDrag] = useState({ active: false, startX: 0, startY: 0, x: 0, y: 0 });
  const [resting, setResting] = useState(true);

  const absX = Math.abs(drag.x);
  const absY = Math.abs(drag.y);
  const label =
    absX > absY && drag.x > STAMP_THRESHOLD
      ? "想吃"
      : absX > absY && drag.x < -STAMP_THRESHOLD
        ? "跳过"
        : drag.y < -STAMP_THRESHOLD
          ? "待定"
          : "";
  const labelClass = label === "想吃" ? "like" : label === "跳过" ? "skip" : label === "待定" ? "pending" : "";

  const style = drag.active
    ? { transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 18}deg)` }
    : { transform: `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 18}deg)` };

  const finishDrag = () => {
    if (!drag.active) return;
    if (absX > absY && drag.x > SWIPE_THRESHOLD) { onSwipe("like"); return; }
    if (absX > absY && drag.x < -SWIPE_THRESHOLD) { onSwipe("skip"); return; }
    if (drag.y < -SWIPE_THRESHOLD) { onSwipe("pending"); return; }
    setResting(true);
    setDrag({ active: false, startX: 0, startY: 0, x: 0, y: 0 });
  };

  return (
    <article
      className={`dish-card ${drag.active ? "dragging" : resting ? "resting" : ""}`}
      onPointerDown={(event: PointerEvent<HTMLElement>) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setResting(false);
        setDrag({ active: true, startX: event.clientX, startY: event.clientY, x: 0, y: 0 });
      }}
      onPointerMove={(event: PointerEvent<HTMLElement>) => {
        if (!drag.active) return;
        setDrag((current) => ({ ...current, x: event.clientX - current.startX, y: event.clientY - current.startY }));
      }}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      style={style}
    >
      <img className="dish-card-image" src={dish.imageUrl} alt={dish.name} loading="lazy" draggable={false} />
      {label ? <div className={`swipe-stamp ${labelClass}`}>{label}</div> : null}
      <div className="dish-card-content">
        <div className="dish-tags">
          {dish.tags.map((tag) => (<span key={tag}>{tag}</span>))}
        </div>
        <h2>{dish.name}</h2>
        <p>{dish.description}</p>
        <div className="dish-meta">
          <span>{dish.cookTimeMinutes} 分钟</span>
          <span>{difficultyLabel(dish.difficulty)}</span>
        </div>
      </div>
    </article>
  );
}

function RecipeCard({ dish, index, total, onPrev, onNext }: { dish: Dish; index: number; total: number; onPrev: () => void; onNext: () => void }) {
  const [drag, setDrag] = useState({ active: false, startX: 0, x: 0 });
  const [resting, setResting] = useState(true);

  const finishDrag = () => {
    if (!drag.active) return;
    const delta = drag.x;
    setResting(true);
    setDrag({ active: false, startX: 0, x: 0 });
    if (delta < -SWIPE_THRESHOLD) onNext();
    else if (delta > SWIPE_THRESHOLD) onPrev();
  };

  const dragHint =
    drag.active && Math.abs(drag.x) > STAMP_THRESHOLD
      ? drag.x < 0 ? "下一道 →" : "← 上一道"
      : "";

  return (
    <article
      className={`recipe-card ${drag.active ? "dragging" : resting ? "resting" : ""}`}
      onPointerDown={(event: PointerEvent<HTMLElement>) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setResting(false);
        setDrag({ active: true, startX: event.clientX, x: 0 });
      }}
      onPointerMove={(event: PointerEvent<HTMLElement>) => {
        if (!drag.active) return;
        setDrag((current) => ({ ...current, x: event.clientX - current.startX }));
      }}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      <img src={dish.imageUrl} alt={dish.name} draggable={false} />
      <div className="recipe-content">
        <div className="recipe-title-row">
          <div>
            <h2>{dish.name}</h2>
            <p>{dish.description}</p>
          </div>
          <div className="recipe-index-chip">{index + 1} / {total}</div>
        </div>
        <RecipeSection title="食材处理">
          <ol>{dish.recipe.ingredientSteps.map((step) => <li key={step}>{step}</li>)}</ol>
        </RecipeSection>
        <RecipeSection title="准备步骤">
          <ol>{dish.recipe.prepSteps.map((step) => <li key={step}>{step}</li>)}</ol>
        </RecipeSection>
        <RecipeSection title="烹饪步骤">
          <ol>{dish.recipe.cookSteps.map((step) => <li key={step}>{step}</li>)}</ol>
        </RecipeSection>
        <RecipeSection title="图文 / 视频">
          <RecipeMediaBlock media={dish.recipe.media} />
        </RecipeSection>
        <RecipeSection title="小贴士">
          <ul>{dish.recipe.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
        </RecipeSection>
      </div>
      {dragHint ? <div className={`recipe-swipe-hint ${drag.x < 0 ? "next" : "prev"}`}>{dragHint}</div> : null}
    </article>
  );
}

function RecipeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function RecipeMediaBlock({ media }: { media: RecipeMedia[] }) {
  if (!media.length) {
    return (
      <div className="recipe-media-placeholder" role="img" aria-label="图文视频占位">
        <span>📷 图文 / 视频教学即将上线</span>
      </div>
    );
  }
  return (
    <div className="recipe-media-list">
      {media.map((item, idx) =>
        item.type === "image" ? (
          <figure key={idx}>
            <img src={item.url} alt={item.caption ?? ""} loading="lazy" />
            {item.caption ? <figcaption>{item.caption}</figcaption> : null}
          </figure>
        ) : (
          <video key={idx} src={item.url} controls preload="metadata">
            {item.caption ? <p>{item.caption}</p> : null}
          </video>
        ),
      )}
    </div>
  );
}

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

  // Prune checkedMap so it never accumulates stale keys for dishes removed from
  // the menu (R7). Otherwise it grows unbounded and keeps checkbox state for
  // items no longer present in the shopping list.
  useEffect(() => {
    const validKeys = new Set(shoppingList.map((item) => item.key));
    const hasStale = Object.keys(state.checkedMap).some((key) => !validKeys.has(key));
    if (!hasStale) return;
    setState((current) => ({
      ...current,
      checkedMap: Object.fromEntries(Object.entries(current.checkedMap).filter(([key]) => validKeys.has(key))),
    }));
  }, [shoppingList, state.checkedMap, setState]);

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

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // Ignore OS key auto-repeat so a held arrow key doesn't fire dozens of swipes.
      if (event.repeat) return;
      // Undo is only meaningful while swiping; limit its scope so Ctrl+Z on the
      // menu/shopping/recipes tabs doesn't silently remove a dish selection.
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
        <ShoppingScreen
          list={shoppingList}
          toggle={(key) => patch({ checkedMap: { ...state.checkedMap, [key]: !state.checkedMap[key] } })}
          selectedCount={selectedDishes.length}
        />
      ) : null}

      {/* ===== 菜谱 Tab ===== */}
      {state.step === "recipes" ? (
        <RecipeScreen dishes={selectedDishes} recipeIndex={state.recipeIndex} patch={patch} />
      ) : null}

      {/* ===== 底部 Tab 栏 ===== */}
      <TabBar active={state.step} onChange={setTab} badge={tabBadge} />
    </div>
  );
}

/* ===== 子页面组件 ===== */

function ShoppingScreen({ list, toggle, selectedCount }: { list: ShoppingListItem[]; toggle: (key: string) => void; selectedCount: number }) {
  const totalChecked = list.filter((item) => item.checked).length;
  return (
    <main className="flow-page">
      <header className="flow-header">
        <div>
          <h1>采购清单</h1>
        </div>
        {list.length > 0 && <div className="summary-chip">{totalChecked}/{list.length}</div>}
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

function RecipeScreen({ dishes: selectedDishes, recipeIndex, patch }: { dishes: Dish[]; recipeIndex: number; patch: (partial: Partial<PersistedState>) => void }) {
  const safeIndex = Math.min(recipeIndex, Math.max(selectedDishes.length - 1, 0));
  const dish = selectedDishes[safeIndex];
  const move = (delta: number) => {
    if (!selectedDishes.length) return;
    patch({ recipeIndex: (safeIndex + delta + selectedDishes.length) % selectedDishes.length });
  };

  return (
    <main className="flow-page recipe-page">
      <header className="flow-header">
        <div>
          <h1>菜谱教学</h1>
        </div>
        {selectedDishes.length ? <div className="summary-chip">{safeIndex + 1}/{selectedDishes.length}</div> : null}
      </header>
      {dish ? (
        <RecipeCard dish={dish} index={safeIndex} total={selectedDishes.length} onPrev={() => move(-1)} onNext={() => move(1)} />
      ) : (
        <div className="empty-state">
          <h3>还没有可查看的菜谱</h3>
          <p>先选中几道想吃的菜，再回来查看做法。</p>
        </div>
      )}
      <div className="flow-actions">
        <button className="secondary-button" onClick={() => move(-1)} type="button" disabled={selectedDishes.length < 2}>上一道</button>
        <button className="primary-button" onClick={() => move(1)} type="button" disabled={selectedDishes.length < 2}>下一道</button>
      </div>
      {selectedDishes.length >= 2 && (
        <p className="recipe-swipe-tip" aria-hidden="true">提示：在卡片上左右滑动可快速切换菜品</p>
      )}
    </main>
  );
}
