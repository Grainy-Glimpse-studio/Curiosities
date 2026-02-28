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

## 备注

- 项目来源：Google AI Studio 导出
- 当前优先级：验证 iframe 技术路线
