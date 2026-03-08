# Curiosities - 个人项目展示网站 PRD

## 项目概述

一个用于展示个人 side projects 的小型网站，使用 Next.js + Tailwind CSS 构建。

## 核心目标

1. **展示个人项目** - 集中展示使用 Google AI Studio 等工具制作的小项目
2. **支持 iframe 嵌入** - 作为个人主站的一部分，项目页面需要能被 iframe 引用
3. **快速上线** - 先做 MVP 版本，UI 美化后续迭代

## 功能需求

### P0 - MVP（当前阶段）

- [ ] 项目可独立访问（每个项目有独立 URL）
- [ ] 支持被 iframe 嵌入（正确的 CORS 和 frame 策略）
- [ ] 基础的项目列表页面
- [ ] 部署上线

### P1 - 后续迭代

- [ ] 项目展示 UI 设计
- [ ] 项目分类/标签
- [ ] 项目详情页
- [ ] 响应式设计

## 技术栈

- **框架**: Next.js
- **样式**: Tailwind CSS
- **部署**: Vercel（推荐，对 Next.js 支持最好）

## 项目结构

```
Curiosities/
├── projects/          # 存放下载的项目文件（HTML/JS 等）
├── docs/              # 文档
│   └── PRD.md
├── src/               # Next.js 源码（待创建）
├── public/            # 静态资源（项目文件可能放这里）
└── CLAUDE.md          # 架构说明
```

## iframe 嵌入方案

为了让个人主站能够通过 iframe 引用项目：

1. 每个项目部署后有独立 URL，如 `https://curiosities.xxx.com/projects/project-name`
2. 需要配置正确的 `X-Frame-Options` 或 CSP 头，允许特定域名嵌入
3. 可能需要处理跨域问题

## 部署计划

1. 本地开发验证 iframe 方案可行性
2. 部署到 Vercel
3. 在个人主站测试 iframe 嵌入

## Catching a Shooting Star 新功能

### 吹散文字交互

用嘴"吹"让屏幕上的文字被吹散消失，回到星空。

**技术方案：**
- 使用 MediaPipe Face Mesh 检测嘴唇关键点
- 检测"吹气"的 O 型嘴：嘴唇撅起，嘴角距离近
- O 型嘴保持 0.5-1 秒触发"吹散"效果
- 复用现有摄像头权限，不需要麦克风

**交互流程：**
1. 抓到星星 → 显示文字
2. 用户做出"吹"的嘴型并保持
3. 文字被吹散消失（动画效果）
4. 回到星空，不显示下一张

**状态：** 实验中

---

## 未来项目想法

### Flashcard 背单词应用

基于 "Catching a shooting star" 框架扩展，复用现有的动画和交互效果。

**核心功能：**
- 用户自建单词本（可添加/管理单词）
- 记忆曲线复习系统（间隔重复）
- 卡片翻面动画（鼠标滑过触发，已有动画效果代码）
- 单词库管理（未记住的单词自动收集）

**资源：**
- 已有翻面动画效果代码（待整合）
- 之前做过一个背单词 app（未上线，UI 不满意），可结合复用

**优先级：** 低，框架完成后再做

---

---

## Diane 录音机 (Twin Peaks Recorder)

### 项目概述

一款模拟物理磁带录音机的网页应用，支持实时语音转文字。

### 核心功能

- 录音 + 实时转写（Deepgram API）
- 多段音频录制（Resume 功能）
- 卡拉OK 式文字高亮播放（Flow 效果）
- 导出：SRT 字幕、BWF 音频、WAV

### 录音逻辑（物理录音机行为）

**按钮行为**：
- **REC**：开始录音 / 从 PAUSED 继续录音（追加模式）
- **PAUSE**：暂停并保存当前段，保持可继续状态
- **STOP**：结束录音，保存所有内容

**状态机**：
```
IDLE ──REC──→ RECORDING
              │
              PAUSE
              ↓
           PAUSED ──REC──→ RECORDING（追加模式）
              │
              STOP
              ↓
           IDLE
```

**多段录音数据结构**：
```typescript
interface Memo {
  audioUrls: string[];           // 多段音频 URL
  segmentDurations: number[];    // 每段时长
  duration: number;              // 总时长
  wordTimestamps: WordTimestamp[]; // 词级时间戳（用于 Flow）
}
```

### 播放逻辑

**两个播放入口**：
1. 主页录音机：只播放第一段
2. 浮动窗口：递归播放所有段，支持进度跳转

**多段播放原理**：
```
段 1 (0-30s) → ended → 段 2 (30-75s) → ended → 段 3 (75-95s) → 结束
```

**全局时间计算**（用于 Flow 效果）：
```
globalTime = startTimes[currentSegment] + audio.currentTime
```

### 详细文档

完整的代码逻辑分析见：`projects/twin-peaks-recorder/CLAUDE.local.md`

---

## 备注

- 项目来源：Google AI Studio 导出
- 当前优先级：验证 iframe 技术路线
