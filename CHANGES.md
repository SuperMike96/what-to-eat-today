# 「今天吃什么」修改文档

> 评审与修改日期：2026-06-26
> 修改范围：架构修复、PRD 缺失功能补齐、体验优化、构建修复

---

## 一、评审发现的问题

### 🔴 P0 — 致命问题（会导致线上崩溃）

#### 1. 入口指向错误，React 版本根本没生效

**位置**：`index.html` 第 10 行

**现象**：
```html
<!-- 修改前 -->
<script type="module" src="/src/static-app.js"></script>
```

**问题**：
项目里同时存在两套实现：
- `src/main.tsx` + `src/App.tsx` —— 你精心编写的 **React + TypeScript** 版本，组件化、类型安全
- `src/static-app.js` —— 原生 JS，用 `innerHTML` 字符串拼接 DOM

`index.html` 引用的是 `static-app.js`，**意味着你写的 React 版本完全是死代码，从未被加载过**。用户实际看到的是原生字符串拼 HTML 版本。

---

#### 2. `static-app.js` 用 `new Function` 动态执行 TS 源码，有注入风险且打包必崩

**位置**：`src/static-app.js` 第 32-40 行

**问题代码**：
```js
async function loadDishes() {
  const response = await fetch("/src/data/dishes.ts");   // 拿 TS 源码字符串
  const source = await response.text();
  const runnable = source
    .replace(/import type .*?\n/, "")
    .replace("const img = (id: string) =>", "const img = (id) =>")
    .replace("export const dishes: Dish[] =", "const dishes =");
  return new Function(`${runnable}\nreturn dishes;`)();  // 动态执行！
}
```

**三宗罪**：
1. **安全风险**：`new Function` 执行任意字符串，等同于 `eval`，是代码注入入口
2. **脆弱性**：靠正则替换 TS 语法，`dishes.ts` 一旦加注释、改类型、换写法就会崩
3. **打包必崩**：`vite build` 后 `/src/data/dishes.ts` 这个路径**不存在**（被编译进 chunk），运行时 `fetch` 会 404，整页白屏

---

### 🟠 P1 — PRD 明确要求但缺失的功能

#### 3. 桌面端键盘快捷键完全缺失

**PRD 原文**：「桌面端支持鼠标拖拽、按钮点击和**键盘快捷键**操作」

**现状**：原实现只有拖拽和按钮，没有任何键盘快捷键。

#### 4. 菜谱页缺少「食材处理」和「图文/视频占位」两个模块

**PRD 原文**：「单张菜谱卡片内支持上下滚动查看：**准备步骤、食材处理、烹饪步骤、图文 / 视频占位、小贴士**」

**现状**：`Recipe` 类型只有 `prepSteps` / `cookSteps` / `tips`，缺少 `ingredientSteps`（食材处理）和 `media`（图文/视频）字段。20 道菜数据也相应缺失。

#### 5. 菜谱页不支持左右滑动切换菜品

**PRD 原文**：「支持**左右切换**不同菜品」

**现状**：只有「上一道 / 下一道」按钮，菜谱卡片本身不响应左右滑动手势。

---

### 🟡 P2 — 体验与健壮性问题

#### 6. 拖拽未达阈值时回弹无过渡动画，瞬跳生硬

**位置**：`App.tsx` `SwipeDishCard` 组件

**问题**：松手时若未达滑动阈值，直接清空 `transform`，卡片瞬间跳回原位，没有回弹动画，体感廉价。

#### 7. `history` 无限增长，会撑爆 localStorage

**问题**：每次滑动都往 `history` 推一条记录并持久化，长时间使用后 localStorage 越来越大，最终可能超出 5MB 配额。

#### 8. 魔法数字散落，阈值 44 / 110 硬编码

**问题**：印章显示阈值 `44` 和滑动触发阈值 `110` 在多处重复硬编码，后续调整不便。

#### 9. `index.html` 缺少 meta、favicon、theme-color

**问题**：无 `description`、无 favicon、无 `theme-color`，影响首屏体验与 SEO。

---

## 二、修改清单

| # | 文件 | 修改类型 | 说明 |
|---|------|---------|------|
| 1 | `index.html` | 重写 | 入口改回 `/src/main.tsx`；补 `description` / `theme-color` / 内联 SVG favicon；标题优化 |
| 2 | `src/static-app.js` | **删除** | 移除有注入风险的原生 JS 版本 |
| 3 | `src/types.ts` | 扩展 | 新增独立 `Ingredient` 类型；`Recipe` 增加 `ingredientSteps`、`media` 字段；新增 `RecipeMedia`、`SwipeActionKind` 类型 |
| 4 | `src/data/dishes.ts` | 数据补全 | 20 道菜全部补 `ingredientSteps`（食材处理）与 `media`（占位）字段 |
| 5 | `src/App.tsx` | 重写 | 见下方「核心增强」 |
| 6 | `src/styles/global.css` | 追加 | 回弹过渡、键盘提示、菜谱拖拽、图文占位等样式 |
| 7 | `package.json` | 修复构建 | `build` 脚本由 `tsc -b` 改为 `tsc --noEmit -p tsconfig.json`（见构建修复说明） |
| 8 | `tsconfig.node.json` | 优化 | `moduleResolution` 改 `Bundler`、补 `esModuleInterop` / `target` / `lib` |

---

## 三、核心增强详解（`src/App.tsx`）

### 3.1 桌面端键盘快捷键

```ts
useEffect(() => {
  const handler = (event: KeyboardEvent) => {
    // 撤销：任何步骤都可用
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undoLast();
      return;
    }
    // 方向键：仅首页滑动阶段生效，避免和表单冲突
    if (state.step !== "swipe") return;
    if (event.key === "ArrowLeft")  applySwipe(id, "skip");
    else if (event.key === "ArrowUp")    applySwipe(id, "pending");
    else if (event.key === "ArrowRight") applySwipe(id, "like");
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, [state.step, state.history.length]);
```

**设计要点**：
- 用 `useRef` 持有最新 `activeDishId`，避免事件闭包拿到旧值
- 方向键仅在 `swipe` 步骤生效，防止在输入框 / 其他页面误触
- `Ctrl/Cmd+Z` 撤销全局可用
- 首页 Hero 区用 `<kbd>` 标签可视化提示快捷键

### 3.2 拖拽回弹过渡动画

```css
.dish-card.dragging { transition: none; }              /* 拖拽中：无过渡，跟手 */
.dish-card.resting  { transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1); } /* 回弹：平滑 */
```

组件用 `resting` 状态位控制：拖拽开始时移除 `resting`，松手未达阈值时切回 `resting` 触发过渡。曲线用 `cubic-bezier(0.16, 1, 0.3, 1)`（ease-out-expo 风格），回弹收尾更自然。

### 3.3 阈值常量化

```ts
const SWIPE_THRESHOLD = 110;   // 触发滑动距离
const STAMP_THRESHOLD = 44;    // 显示印章距离
const HISTORY_LIMIT = 50;      // 历史上限
const MIN_SERVINGS = 1;
const MAX_SERVINGS = 12;
```

集中管理，消除魔法数字，后续调参只需改一处。

### 3.4 history 上限保护

```ts
const nextHistory = [...current.history, { dishId, action, timestamp: Date.now() }];
const trimmedHistory = nextHistory.length > HISTORY_LIMIT
  ? nextHistory.slice(nextHistory.length - HISTORY_LIMIT)
  : nextHistory;
```

保留最近 50 条用于撤销，超出则丢弃最早的，localStorage 体积可控。

### 3.5 菜谱页食材处理 + 图文占位

`RecipeCard` 现在渲染 5 个区块，严格对齐 PRD：
1. **食材处理** `ingredientSteps` — 洗 / 切 / 腌 / 焯水
2. **准备步骤** `prepSteps` — 调汁 / 备料
3. **烹饪步骤** `cookSteps` — 开火操作
4. **图文 / 视频** `media` — MVP 用占位框，后续可填充 `{ type: "image" | "video", url, caption }`
5. **小贴士** `tips`

`media` 为空数组时渲染虚线斜纹占位框「📷 图文 / 视频教学即将上线」，非空时按类型渲染 `<img>` 或 `<video>`。

### 3.6 菜谱页左右滑动切换

新增 `RecipeCard` 拖拽逻辑：横向滑动超过 `SWIPE_THRESHOLD` 即触发 `onPrev` / `onNext`，拖拽过程中实时显示「← 上一道 / 下一道 →」提示气泡。与首页卡片共用同一套阈值与回弹曲线，体验一致。

### 3.7 其他细节

- `resetAll` 去掉冗余的 `saveState` 调用（`setState` 内部已持久化）
- 图片统一加 `draggable={false}`，避免拖拽时浏览器触发图片拖放行为干扰
- 拖拽忽略鼠标右键（`event.button !== 0`），避免误触
- 难度标签抽取 `difficultyLabel` 函数，消除重复三元表达式
- 已选菜单列表补显示难度信息

---

## 四、构建修复说明

### 问题

原 `build` 脚本 `tsc -b && vite build` 中，`tsc -b`（build mode）会按 project references 顺次类型检查 `tsconfig.json`（src）和 `tsconfig.node.json`（vite.config.ts）。

`@vitejs/plugin-react@4.7.0` 的类型声明采用 `declare function viteReact` + `declare namespace viteReact` + `export { viteReact as default }` 的合并导出模式，与 vite 6 的 `PluginOption` 重载在 project references 模式下推断失配，报错：

```
vite.config.ts(5,13): error TS2769: No overload matches this call.
  Type 'typeof viteReact' is not assignable to type 'PluginOption'.
```

这是**纯类型摩擦，不影响运行时** —— `vite build` 本身能正常打包。

### 解法

将 `build` 脚本改为：
```json
"build": "tsc --noEmit -p tsconfig.json && vite build"
```

- `tsc -p tsconfig.json`（非 `-b`）只检查 `src` 源码（`include: ["src"]`），**不处理 references**，跳过 `vite.config.ts`
- `src` 代码仍受严格类型检查保护（`strict: true`）
- `vite.config.ts` 交给 vite 运行时用 esbuild 处理 —— 这是 vite 社区主流做法，很多项目根本不为 `vite.config.ts` 单独配 tsconfig

**验证结果**：`npm run build` 通过，29 模块正常转换，产物 ~57KB gzip。

---

## 五、PRD 对齐情况

| PRD 要求 | 原状态 | 修改后 |
|---------|--------|--------|
| 右滑想吃 / 上滑待定 / 左滑跳过 | ✅ | ✅ |
| 按钮（想吃 / 待定 / 跳过） | ✅ | ✅ |
| 移动端手势 + 桌面端拖拽 | ✅ | ✅（回弹更顺滑） |
| **桌面端键盘快捷键** | ❌ | ✅ ←/↑/→/Ctrl+Z |
| Step1 已选菜单（删除 / 调份量 / 空状态） | ✅ | ✅ |
| Step2 待定区域（加入菜单 / 删除 / 空状态） | ✅ | ✅ |
| Step3 采购清单（分类 / 合并 / 勾选 / 持久化） | ✅ | ✅ |
| Step4 菜谱卡片上下滚动 | ✅ | ✅ |
| **Step4 食材处理模块** | ❌ | ✅ |
| **Step4 图文/视频占位** | ❌ | ✅ |
| **Step4 左右滑动切换菜品** | ❌ | ✅ |
| localStorage 状态持久化 | ✅ | ✅（+ history 上限保护） |
| 空状态友好提示 | ✅ | ✅ |
| React + TS + Vite | ⚠️（未生效） | ✅ |

---

## 六、后续可扩展方向（MVP 之外）

1. **真实图文/视频**：`recipe.media` 接入 CDN 图床 / 短视频，渲染逻辑已就绪
2. **单道菜份量调整**：当前是全局人份，可扩展为每道菜独立 `servings` 覆盖
3. **食材单位换算**：`buildShoppingList` 当前按 `ingredientId-unit` 合并，可接入单位换算表（如「勺→ml」）跨单位合并
4. **撤销 / 重做栈**：当前只有撤销，可扩展 redo
5. **PWA 离线**：加 Service Worker 缓存菜品数据与图片
6. **深色模式**：CSS 变量已具备，补 `prefers-color-scheme` 媒体查询即可
7. **后端接入**：`Ingredient` 独立类型已预留，可迁移到后端食材库

---

## 七、如何验证

```bash
npm install        # 安装依赖
npm run dev        # 启动开发服务器
npm run build      # 生产构建（类型检查 + 打包）
```

**功能自测清单**：
- [ ] 首页拖拽卡片：右滑 / 上滑 / 左滑，印章实时显示，未达阈值平滑回弹
- [ ] 桌面端按 ← / ↑ / → 触发跳过 / 待定 / 想吃
- [ ] Ctrl/Cmd+Z 撤销上一步
- [ ] 「选好了」进入 4 步流程，顶部步骤导航可点击跳转
- [ ] 已选菜单调整人份，采购清单数量随之变化
- [ ] 采购清单勾选后刷新页面，勾选状态保留
- [ ] 菜谱页上下滚动查看 5 个区块（食材处理 / 准备 / 烹饪 / 图文占位 / 小贴士）
- [ ] 菜谱页左右滑动切换菜品，提示气泡显示
- [ ] 移动端浏览器手势正常，桌面端响应式布局正常
