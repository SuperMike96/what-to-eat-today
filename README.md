# 🍳 今晚吃什么 · What to eat tonight

> 不知道今晚吃什么？滑动卡片决定吧！  右滑想吃、左滑不吃，自动生成采购清单和菜谱教学。

一个基于 **Tinder 式滑动交互** 的烹饪 / 食谱 Web 应用，包含 41 道精选家常菜，支持拖拽滑动、触觉反馈、自适应缩放、键盘快捷键和 PWA 离线访问。

---

## ✨ 功能一览

| 功能 | 说明 |
|------|------|
| 🃏 滑动决策 | 手指 / 鼠标拖拽卡片 —— 右滑「想吃」、左滑「不吃」、上滑「待定」；卡片底部也有快捷按钮点击操作 |
| 🖼️ 飞走动画 | 每次滑动都带有跟手拖拽、印章渐显、飞出动画和振动反馈（移动端） |
| 📋 采购清单 | 按食材分类自动汇总，支持勾选完成、一键复制到剪贴板 |
| 🥘 菜谱教学 | 每道菜都有食材处理、预处理、烹饪步骤和小贴士，支持左右翻页 |
| 📊 状态追踪 | 已选 / 待定 / 已跳过 分别管理，可恢复已跳过的菜、可调整用餐人数 |
| 🔄 响应式缩放 | 卡片尺寸、字体、按钮大小随浏览器窗口大小连续缩放（`clamp()` 实现） |
| ⌨️ 键盘快捷键 | `← →` 不吃/想吃，`Ctrl+Z` 撤销上一步操作 |
| 🌗 跟随系统主题 | 自动跟随系统亮/暗模式切换，CSS 变量驱动，过渡平滑 |
| 📱 PWA 支持 | 配备 `manifest.json` 与 `sw.js`，可安装到桌面，支持离线访问 |
| 🍲 41 道家常菜 | 炒菜、炖菜、蒸菜、凉菜、汤品，覆盖川味、粤式、鲁菜、西餐等 |

---

## 🛠 技术栈

| 类别 | 技术 |
|------|------|
| 构建工具 | [Vite 6](https://vitejs.dev/) |
| 前端框架 | [React 18](https://react.dev/) |
| 语言 | TypeScript 5.7 |
| 样式方案 | CSS Variables + 自定义 CSS（按组件域拆分） |
| 测试工具 | [Vitest 4](https://vitest.dev/) |
| 代码规范 | [ESLint 10](https://eslint.org/)（flat config） |
| 图片资源 | 本地精选 `.jpg` 替代外链，离线可用 |

**第三方依赖**：仅 React、ReactDOM、Vite 及其配套插件，无其他运行时依赖。

---

## 🚀 快速开始

### 环境要求

- Node.js ≥ 18（推荐 20+）
- npm ≥ 9

### 安装与运行

```bash
# 1. 克隆仓库
git clone https://github.com/SuperMike96/what-to-eat-today.git
cd what-to-eat-today

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev
```

浏览器打开 `http://127.0.0.1:5173` 即可体验。

### 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器（HMR 热更新） |
| `npm run build` | TypeScript 类型检查 + Vite 生产构建 |
| `npm run preview` | 预览生产构建结果 |
| `npm test` | 运行 Vitest 单元测试 |
| `npm run lint` | 运行 ESLint 检查 |

---

## 📁 项目结构

```
what-to-eat-today/
├── public/
│   ├── dishes/                 # 🖼️ 41 张菜品本地图片 (<id>.jpg)
│   ├── manifest.json           # PWA 清单
│   └── sw.js                   # PWA Service Worker
├── src/
│   ├── components/             # React 组件
│   │   ├── CompactHeader.tsx   # 顶部统计栏 + 重置按钮
│   │   ├── SwipeDishCard.tsx   # 核心滑动卡片（拖拽、动画、按钮）
│   │   ├── TabBar.tsx          # 底部 Tab 导航栏
│   │   ├── ShoppingScreen.tsx  # 采购清单页
│   │   ├── RecipeScreen.tsx    # 菜谱教学页
│   │   └── ...
│   ├── data/
│   │   └── dishes.ts           # 🍲 41 道菜的数据定义
│   ├── hooks/                  # 自定义 Hooks
│   │   ├── useDragGesture.ts   # 指针拖拽手势（跟手 + 阈值判断）
│   │   ├── useSwipeSession.ts  # 滑动状态管理（历史、撤销、预览）
│   │   ├── usePersistentState.ts # localStorage 持久化状态
│   │   └── useTheme.ts         # 跟随系统主题
│   ├── lib/                    # 工具函数
│   │   ├── dishActions.ts      # 菜品列表操作（添加/移除/撤销）
│   │   ├── constants.ts        # 滑动阈值常量
│   │   ├── haptics.ts          # 移动端触觉反馈
│   │   └── image.ts            # 图片加载失败兜底 SVG
│   ├── styles/                 # CSS 样式（按组件域拆分）
│   │   ├── base.css            # 主题变量、重置、布局、头部
│   │   ├── swipe.css           # 卡片、滑动、动画、操作按钮
│   │   ├── menu.css            # 菜单列表页
│   │   ├── recipe.css          # 菜谱页
│   │   ├── shopping.css        # 采购清单页
│   │   ├── shared.css          # Tab 栏、通用按钮、响应式
│   │   └── global.css          # 全局兜底
│   ├── types.ts                # TypeScript 类型定义
│   ├── main.tsx                # 应用入口
│   └── App.tsx                 # 根组件（路由/状态协调）
├── index.html                  # HTML 入口
├── package.json
├── tsconfig.json
├── eslint.config.mjs           # ESLint flat config
└── README.md
```

---

## 📝 最近更新摘要

| 提交 | 内容 |
|------|------|
| `004230d` | **🔝 顶部增加重置按钮** —— 在挑选页「待看」统计右侧新增珊瑚色重置按钮，方便一键清空所有选择重新开始。 |
| `1dc1fae` | **🤲 按钮移入卡片内** —— 将「不吃」「想吃」两个主操作按钮从页面底部移入卡片内部，覆盖在菜品图片底部渐变上；同时移除底部的撤销、重置按钮和快捷键提示，让页面更简洁。 |
| `cb143d0` | **📐 响应式卡片缩放** —— 卡片宽度、高度、标题、标签、按钮等全部改用 `clamp()` 响应式变量，随浏览器窗口大小平滑缩放，替代了原有的硬编码媒体查询。 |
| `fcdeb60` | **🧹 架构重构** —— 提取 `useSwipeSession` Hook、接入 PWA（`manifest.json` + `sw.js`）、CSS 按组件域拆分成 7 个独立文件。 |
| `61b9f72` | **🎨 主题 + 菜品扩展** —— 删除 ThemeToggle，改为纯跟随系统主题；菜品从 20 道扩展到 41 道家常菜；菜品图片全部下载到本地 `/public/dishes/`，不再依赖外链。 |
| 更早 | R1–R19 代码审查修复（结构拆分、安全性、边界处理、性能优化等 19 项）；Tinder 式滑动交互实现（跟手拖动、印章渐显、边缘染色、触觉反馈）。 |

---

## 🧪 测试

```bash
npm test          # 运行单元测试
npm run lint      # 运行 ESLint 检查
```

---

## 📄 许可

MIT

---

*Made with ❤️  for those who never know what to eat.*
