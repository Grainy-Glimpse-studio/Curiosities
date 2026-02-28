# Curiosities 项目架构

## 项目定位

个人 side projects 展示网站，会被嵌入到个人主站中（通过 iframe）。

## 技术架构

- **框架**: Monorepo (npm workspaces) + Vite
- **样式**: Tailwind CSS
- **部署**: Vercel

## 目录结构

```
Curiosities/
├── projects/                    # 所有项目（npm workspaces）
│   └── twin-peaks-recorder/     # 第一个项目
├── docs/
│   └── PRD.md                   # 产品需求文档
├── package.json                 # 根 package，管理 workspaces
├── vercel.json                  # 部署配置，含 iframe headers
└── CLAUDE.md                    # 本文件
```

## 关键配置

### iframe 嵌入支持

在 `vercel.json` 中配置 headers 允许 iframe 嵌入：

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "ALLOWALL" },
        { "key": "Content-Security-Policy", "value": "frame-ancestors *" }
      ]
    }
  ]
}
```

## 开发命令

```bash
npm run dev:twin-peaks    # 启动 twin-peaks-recorder
npm run build:twin-peaks  # 构建 twin-peaks-recorder
npm run build:all         # 构建所有项目
```

## 添加新项目流程

1. 将项目文件夹放入 `projects/` 目录
2. 确保项目有 `package.json` 和 `build` 脚本
3. 项目直接可用，无需修改

## 语音转写方案

使用 **Web Speech API**（浏览器原生，免费）替代 Gemini API：
- 文件：`projects/twin-peaks-recorder/services/speechService.ts`
- 支持中英文实时转写
- 标签功能简化为基于文本长度的自动标签

## 当前状态

- [x] 项目结构创建
- [x] Monorepo 配置 (npm workspaces)
- [x] twin-peaks-recorder 改用 Web Speech API
- [x] Vercel 配置 (iframe 支持)
- [x] 本地运行验证
- [ ] Vercel 部署
- [ ] iframe 嵌入测试
