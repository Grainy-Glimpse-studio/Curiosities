# Catch A Shooting Star - PRD

## 项目概述

一个互动式网页应用，用户通过捕捉流星来获取内容（文字、图片、留言）。支持键盘和手势两种交互模式。

**线上地址**: https://catch-a-shooting-star.vercel.app

---

## 技术架构

### 前端
- **框架**: React + TypeScript + Vite
- **动画**: Framer Motion
- **样式**: Tailwind CSS
- **手势**: MediaPipe Hands (CDN 加载)

### 后端
- **部署**: Vercel Serverless Functions
- **数据库**: Upstash Redis
- **API**: `/api/messages` (GET/POST)

### 项目结构
```
src/
├── core/                    # 核心组件
│   ├── StarCatcher.tsx      # 主控制器，管理内容显示
│   ├── ShootingStar.tsx     # 流星动画和捕捉逻辑
│   ├── Starfield.tsx        # 背景星空
│   └── HandTracker.tsx      # 手势识别 (MediaPipe)
├── modes/                   # 显示模式
│   ├── SingleView.tsx       # 单内容显示（文字/图片/输入）
│   └── GalleryView.tsx      # 画廊模式（多卡片）
├── components/
│   └── ModeSelector.tsx     # 首页模式选择
├── features/guestbook/      # 留言功能
│   ├── useGuestbook.ts      # 留言逻辑 Hook
│   ├── guestbookService.ts  # API 调用
│   └── types.ts             # 类型定义
├── types.ts                 # 全局类型
└── App.tsx                  # 应用入口

api/
└── messages.ts              # 留言 API (Vercel Serverless)
```

---

## 已完成功能

### 2024-03-02 Session 完成

#### 1. 浮动动画效果
- [x] 首页所有元素浮动（标题、按钮、图标、文字）
- [x] 内容文字每个字符独立浮动
- [x] "space to catch" 提示浮动
- [x] 输入确认信息浮动

#### 2. 输入框改进
- [x] 输入框全透明（无卡片背景）
- [x] UI 字体改为 Tango
- [x] 添加 "← back" 关闭按钮
- [x] 打字时空格键不会触发抓流星

#### 3. 回复功能
- [x] 文字内容显示 "reply ↩" 按钮
- [x] 回复时显示引用内容
- [x] 引用超过 80 字符自动截断
- [x] 提交时格式化为 Markdown 引用

#### 4. 动画优化
- [x] AnimatePresence mode="sync" 同时进出
- [x] 内容保护时间（短文本 100-500ms，长文本 500-1500ms，图片 500ms）

#### 5. 手势模式修复
- [x] MediaPipe 改用 CDN 加载（解决生产构建问题）
- [x] 实时计算流星位置
- [x] 抓取距离阈值 400px

---

## 待修复问题

### 1. 每日留言限制失效
**问题**: `maxDailyMessages: 3` 没有生效，用户可以无限发送

**位置**: `src/features/guestbook/useGuestbook.ts`

**原因分析**:
- localStorage 计数逻辑在 `incrementTodayMessageCount()`
- 但检查逻辑 `canShowInput` 只控制是否显示输入框
- 没有在 `onInputSubmit` 中阻止超限提交

**修复方案**:
```typescript
// 在 onInputSubmit 中添加检查
const onInputSubmit = useCallback(async (content: string) => {
  if (isSubmitting) return;
  if (todayMessageCount >= maxDailyMessages) return; // 添加这行
  // ...
}, [...]);
```

### 2. 时间戳和地点不显示
**问题**: 消息的 `createdAt` 和 `location` 已存储但未在 UI 显示

**位置**:
- 存储: `api/messages.ts` (已正确保存)
- 显示: `src/modes/SingleView.tsx` (需要添加)

**数据结构**:
```typescript
interface GuestMessage {
  id: string;
  content: string;
  createdAt: number;  // Unix timestamp
  location?: string;  // e.g. "Los Angeles", "Shanghai"
}
```

**修复方案**:
- 在 `SingleView.tsx` 的文字内容下方显示时间和地点
- 时间格式化为相对时间（如 "3 hours ago"）
- 地点显示为小字

---

## 待开发功能

### 1. 富文本输入
**需求**: 支持 Markdown 格式化

**当前状态**:
- 支持输入 Markdown 语法
- 但没有实时预览或格式化提示

**设计挑战**:
- 透明输入框如何显示格式化工具栏？
- 如何在不破坏美观的情况下提供格式提示？

**可能方案**:
1. 悬浮工具栏（选中文字时出现）
2. 键盘快捷键提示（在某处显示）
3. 实时预览（双栏或切换）

### 2. 内容渲染 Markdown
**需求**: 显示留言时渲染 Markdown

**实现方案**:
- 使用 `react-markdown` 或 `marked`
- 在 `SingleView.tsx` 中渲染时解析

### 3. 显示元信息
**需求**: 展示留言的时间和地点

**设计考虑**:
- 保持界面简洁
- 信息足够淡，不抢内容
- 可能用浮动小字显示

---

## 配置说明

### 字体配置
位置: `src/App.tsx`

```typescript
// 英文字体 (11种)
const ENGLISH_FONT_CONFIG = [
  { name: 'Courier', file: null, size: 18 },
  { name: 'Tango', file: 'Tango.woff', size: 32 },
  // ...
];

// 中文字体 (3种)
const CHINESE_FONT_CONFIG = [
  { name: '匯文明朝體', file: '汇文明朝体.otf', size: 22 },
  // ...
];

// UI字体 (6种，15分钟轮换)
const UI_FONT_CONFIG = [
  { name: 'Brainrot', file: 'BrainrotTMRegular.ttf', size: 24 },
  // ...
];
```

### 留言配置
位置: `src/App.tsx`

```typescript
const { onBeforeCatch, onInputSubmit } = useGuestbook({
  apiUrl: '/api/messages',
  placeholder: 'Let your words drift among the stars...',
  maxDailyMessages: 3,        // 每人每天最多3条 (目前失效)
  firstInputRange: [3, 7],    // 首次输入在第3-7次抓取后出现
  nextInputRange: [5, 15],    // 后续输入间隔5-15次抓取
});
```

### 内容保护时间
位置: `src/core/StarCatcher.tsx`

```typescript
const getProtectionTime = (item: ContentItem) => {
  if (item.type === 'image') return 500;  // 图片固定500ms
  if (item.type === 'text' && item.content) {
    if (item.content.length < 30) return 100 + Math.random() * 400;  // 短文本
    return 500 + Math.random() * 1000;  // 长文本
  }
  return 0;  // 输入框无保护
};
```

---

## 环境变量

```bash
# Upstash Redis
UPSTASH_REDIS_REST_URL=xxx
UPSTASH_REDIS_REST_TOKEN=xxx
```

---

## 开发命令

```bash
npm run dev      # 本地开发 (http://localhost:5173)
npm run build    # 构建
vercel --prod    # 部署到生产
```

---

## 交互说明

### 键盘模式
- **Space**: 捕捉流星（打字时禁用）
- **Cmd/Ctrl + Enter**: 发送留言

### 手势模式
- **抓取手势**: 捕捉流星（距离 < 400px）

### 通用
- **← back**: 关闭输入框
- **点击内容**: 触发 onItemClick
- **双击内容**: 触发 onItemDoubleClick

---

## 下一步优先级

1. **高** - 修复每日留言限制
2. **高** - 显示时间戳和地点
3. **中** - 渲染 Markdown 内容
4. **中** - 富文本输入设计
5. **低** - UI 字体/布局微调
