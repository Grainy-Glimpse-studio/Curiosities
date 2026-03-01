# Twin Peaks Recorder - Design Specifications (2026-02-28)

## Key Features Implemented

### 1. Cassette Tape Card (CassetteTape.tsx)
- **Black container**: `bg-[#1a1a1a]` with plastic texture
- **Title hover color**: Changes to theme red `#903e4f` on hover (NOT white)
  - Class: `group-hover:text-[#903e4f]`
- **Sound on CLICK only** - NOT on hover
  - `playClickSound()` called in `handleCardClick()`
- **Draggable cards**: Using framer-motion `drag` prop in TapeDrawer

### 2. Archive Drawer (TapeDrawer.tsx)
- **Video background**: `/video/background.mp4` with feathered edges
- **ARCHIVE text**: Vertical glowing text on right side
  - Proximity-based glow effect
  - **Easter egg**: Hover all letters to cross-dissolve into "TWINPEAKS"
    - State: `bgWord`, `hoveredLetters`, `wordTransition`
- **Hidden scattered text**: Twin Peaks quotes revealed by mouse proximity
  - "THE OWLS ARE NOT WHAT THEY SEEM", "FIRE WALK WITH ME", etc.

### 3. Floating Controls (NO backgrounds, NO borders)
- All dropdowns are **transparent** - no `bg-black/80`
- Text is white, no special colors
- Dropdowns:
  - **Date**: Sort order + date range picker
  - **Tag**: Single dropdown with all tags merged (NOT separate buttons)
  - **Style**: Title Font + Text Font options

### 4. Drag & Tidy
- Cards can be dragged using framer-motion
- "Tidy" button appears when cards are out of grid
- `handleTidy()` resets all positions

## Theme Colors
- Primary red: `#903e4f`
- Lighter red: `#b85a6a`
- Dark background: `#1a1a1a`

## Fonts
- **HuiWen** (明朝): Chinese font `汇文筑地五号明朝体1.0.otf` - available for both Title and Text
- **Permanent Marker**: English handwriting
- **LORE**: Title font
- **Consulate**: Typewriter/monospace
- **Journal Ultra**: Body text
- **Kawaiitegakimoji**: Cute Japanese handwriting

## Editable Transcript Title
- The "Transcript" header in the modal is editable (contentEditable)
- State: `customTitle` in CassetteTape.tsx

## Language Toggle & Font Switching
- **UI Toggle**: Click to switch between EN → 中文 → AUTO during recording
- Located next to HIDE and FOCUS MODE buttons (top-left when recording)
- **Tab 顺序**: EN → 中文 → AUTO（Auto 消耗双倍配额，放最后）
- **EN**: Forces English (en-US) + Consulate (typewriter) font
- **中文**: Forces Traditional Chinese (zh-TW) + HuiWen (明朝) font
- **AUTO**: 双路并行识别（中英自动切换）
- Can switch language while recording without stopping

## HD Mode Speech Recognition (2026-03-01 Updated)
- **Two modes**: Standard (Web Speech API) and HD (Deepgram cloud API)

### HD Mode Language Strategy
| 模式 | 实现方式 | 配额消耗 |
|-----|---------|---------|
| **EN** | Deepgram 单路 `language=en` | 1x |
| **中文** | Deepgram 单路 `language=zh-TW` | 1x |
| **AUTO** | Deepgram 双路并行 `zh-TW` + `en` | 2x |

### AUTO 模式双路并行原理
- 同时开两路 WebSocket 连接到 Deepgram
- 一路设 `language=zh-TW`，一路设 `language=en`
- 同一个麦克风音频流同时发给两路
- 每次收到结果时，比较两路的 `confidence` 值
- 取 confidence 高的显示到屏幕上
- 实现用户说中文显示中文、说英文显示英文的实时自动切换

**注意**：
- 不使用 `language=multi`（只支持西班牙语+英语，不支持中文）
- 不使用 `detect_language`（不支持 streaming，延迟太高）

### 游客配额限制
- **每人每周 10 分钟**（使用浏览器指纹追踪）
- AUTO 模式消耗双倍（因为两路连接）
- 数据每周自动清理

### HD Service Files
- `services/hdService.ts` - 统一 HD 服务入口
- `services/deepgramService.ts` - Deepgram 单路转写（中文/英文模式）
- `services/deepgramDualService.ts` - Deepgram 双路并行转写（AUTO 模式）
- `services/aliyunService.ts` - 阿里云转写（已弃用，免费版只有2路并发太少）
- `api/deepgram-key.ts` - 后端：分发 Deepgram key，追踪游客用量

### Environment Variables (Vercel Dashboard)
```
UPSTASH_REDIS_REST_URL      # Redis for visitor quota tracking
UPSTASH_REDIS_REST_TOKEN
DEEPGRAM_API_KEY            # Deepgram API key
```

### API Settings Component
- `components/ApiSettings.tsx` - Modal for configuring API keys
- Two tabs: Speech Recognition, Text Processing
- Speech mode toggle: Standard / HD
- Supports Deepgram API key input

## FloatingWords Animation Settings
- **Enter/Exit duration**: 2.0 seconds (darkroom developing effect)
- **Display duration**: 4-6 seconds (based on text length)
- **Max words on screen**: 5
- Animation: blur(12px) → blur(0px), opacity fade, scale 0.95 → 1

## Backup Location
- `.backups/2026-02-28/TapeDrawer.tsx`
- `.backups/2026-02-28/CassetteTape.tsx`

## Recovery Notes
If features are lost, check the conversation log at:
`~/.claude/projects/-Users-yuxiwang-Documents-2026-Curiosities/1f6804c7-bb3c-426c-811e-08301f4a5aa1.jsonl`

Key line numbers in log:
- Cassette hover red: Line 3677
- Tags dropdown transparent: Line 3572
- ARCHIVE morph effect: Line 4400

---

## TODO List (2026-03-01)

### 1. 文本处理 API（免费版）
- **服务**：阿里云 Qwen 3.5-flash
- **额度**：100万 tokens 免费，3个月有效
- **模式**：
  - 游客模式：用开发者的 API（有额度限制）
  - 用户模式：用户填自己的 API key
- **功能**：
  - ✨ 润色文本 - 修正语法、让转写更通顺
  - 📝 生成摘要 - 长录音总结成几句话
  - 🏷️ 自动标签 - 根据内容生成标签
  - 🌐 翻译 - 中英互译
  - 💡 提取要点 - 列出关键信息
  - 📌 生成标题 - 自动起名

### 2. 录音转文字（仅注册用户）
- 用户自己填 API key（Groq / OpenAI）
- 我们只部署 API portal
- 暂不做免费版

### 3. 首页 UX 改动
- ❌ 移除 API Settings 入口
- ✅ 改成 **登录/注册** 按钮
- ✅ 显示游客说明（每周10分钟免费）

### 4. 默认 HD 模式（简化流程）
- ✅ **所有人默认 HD 模式**（不分游客/登录用户）
- ❌ 移除 HD / Standard 切换按钮
- ✅ 每人每周 10 分钟免费额度
- ✅ **额度用完 → 静默切换到 Standard**（不弹窗）
- 流程：`打开网页 → 自动 HD 模式 → 用完额度 → 静默降级到 Standard`

### 5. 中文浮动文字竖排
- ✅ 已实现：检测中文 → flex-col 竖排显示
- 文件：`components/FloatingWords.tsx`

---

## Bug List (2026-03-01)

### Bug 1: 录音中切换语言 → 乱码
- **复现**：录音中说中文 → 切换到英文按钮 → 说英文 → 显示乱码
- **原因**：切换语言时没有重新创建 Deepgram 连接，还在用中文识别英文
- **修复**：切换语言时关闭旧连接 → 用新语言重新连接

### Bug 2: 新录音继承上一次的语言
- **复现**：录完中文 → 停止 → 不刷新 → 开始新录音 → 切换语言 → 还是用上次的语言
- **原因**：语言状态没有正确重置/更新
- **修复**：新录音开始时重置语言状态，用当前选择的语言

### Bug 3: HD 中文识别不稳定 ⚠️ 高优先级
- **现象**：中文有时能显示，有时不能，刷新后也不稳定
- **严重程度**：高 - 核心功能不可用
- **可能原因**：
  - Deepgram 中文支持本身不稳定（官方文档说 zh-CN 有 bug，zh-TW 也不稳定）
  - 双路连接管理有问题（Auto 模式）
  - WebSocket 连接没有正确关闭/重建
- **建议方案**：
  1. **短期**：中文模式暂时用 Standard（Web Speech API），稳定
  2. **长期**：换成 Gladia（10小时/月免费，支持100+语言）或 Soniox
  3. **备选**：修好阿里云配置，用阿里云做中文
