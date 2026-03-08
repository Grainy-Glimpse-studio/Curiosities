# Catch A Shooting Star - Claude Instructions

## 规则

### 可以做
- 修改 src/ 目录下的代码
- 创建新组件和功能
- 调整动画参数和样式
- 更新 PRD.md 文档
- 在 public/ 下创建测试/调试页面

### 不要做
- 不要删除或大幅修改 api/ 目录（后端 API）
- 不要修改 Vercel 配置（vercel.json）除非明确要求
- 不要擅自添加新的 npm 依赖，先询问
- 不要修改字体文件（public/fonts/）

### 代码风格
- React 函数组件 + TypeScript
- 使用 Tailwind CSS
- 动画优先用 Framer Motion，复杂动画可用 CSS keyframes
- 组件放 src/components/，核心逻辑放 src/core/，页面模式放 src/modes/

---

## 项目背景

一个互动式网页应用，用户通过捕捉流星来获取内容（文字、图片、留言）。

**核心体验**: 在星空中抓住流星，看到一段文字或图片，然后吹走它。

**线上地址**: https://catch-a-shooting-star.vercel.app

---

## 项目架构

### 技术栈
- **框架**: React + TypeScript + Vite
- **动画**: Framer Motion + CSS Keyframes
- **样式**: Tailwind CSS
- **手势**: MediaPipe Holistic (CDN)
- **后端**: Vercel Serverless + Upstash Redis

### 目录结构
```
src/
├── core/                    # 核心组件
│   ├── StarCatcher.tsx      # 主控制器
│   ├── ShootingStar.tsx     # 流星动画
│   ├── Starfield.tsx        # 背景星空
│   ├── HolisticTracker.tsx  # 手势+人脸识别
│   └── HandTracker.tsx      # 纯手势识别
├── modes/                   # 显示模式
│   ├── SingleView.tsx       # 单内容显示
│   └── GalleryView.tsx      # 画廊模式
├── components/              # UI 组件
│   ├── ScrambleText.tsx     # 乱码翻转动画
│   ├── ModeSelector.tsx     # 首页选择
│   └── ...
├── features/guestbook/      # 留言功能
├── utils/                   # 工具函数
│   └── fonts.ts             # 字体配置
├── types.ts                 # 类型定义
└── App.tsx                  # 入口

api/                         # Vercel Serverless
└── messages.ts              # 留言 API

public/
├── fonts/                   # 字体文件
└── *.html                   # 测试页面
```

### 交互模式
| 模式 | 触发方式 | 说明 |
|------|----------|------|
| Keyboard | 空格键 | 捕捉流星 |
| Gesture | 手势抓取 | 需要摄像头 |

### 手势识别
- **抓取**: 四指弯曲 → 捕捉流星
- **手掌张开**: 跟踪手掌位置 → 文字发光效果
- **手掌翻转**: 手掌正反面切换 → 触发翻译动画
- **吹气**: 嘴型检测 → 吹走当前内容

### 动画组件
| 组件 | 效果 | 触发 |
|------|------|------|
| ScrambleText | 乱码解码 + 模糊渐变 | 手掌翻转 / Tab键 |
| BlowAwayText | 飘散消失 | 吹气 / 空格 |
| FloatingText | 字符浮动 | 静止状态 |

---

## 当前 TODO

### 高优先级
- [ ] Palm flip 手势优化（响应感不够强）
- [ ] Keyboard: "press space" → "press space to catch"
- [ ] Keyboard: 空格后内容 blow away + 自动超时 blow away
- [ ] Gesture: 添加提示语 "catch with your hand"
- [ ] Text 格式：地点/时间戳显示

### 中优先级
- [ ] DeepL API 接入（翻译功能）
- [ ] 修复每日留言限制
- [ ] 文字浮动动画（charFloat）

---

## 开发命令

```bash
npm run dev      # 本地开发 http://localhost:5173
npm run build    # 构建
```
