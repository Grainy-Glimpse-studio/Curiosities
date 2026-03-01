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

## 2026-03-01 Session Summary（会话总结）

### ✅ 已完成的功能

#### 1. HD 语音识别 - Deepgram 集成
- **单路模式**：EN 用 `language=en`，中文用 `language=zh-TW`
- **双路并行 AUTO 模式**：同时开中英两路连接，比较 confidence 取高的
- **文件**：
  - `services/hdService.ts` - 统一入口
  - `services/deepgramService.ts` - 单路转写
  - `services/deepgramDualService.ts` - 双路并行转写
  - `api/deepgram-key.ts` - 后端 API key 分发

#### 2. 游客配额系统
- **Upstash Redis** 追踪每个用户的使用时长
- **每人每周 10 分钟**免费 HD 额度
- **配额 key 格式**：`visitor:{fingerprint}`
- **清空配额**：去 Upstash Console → Data Browser → 删除 `visitor:xxx` 的 key

#### 3. 语言切换
- **顺序**：EN → 中文 → AUTO（点击循环）
- **默认**：EN（因为 Auto 消耗双倍配额）
- **录音中切换**：调用 `switchLanguage()` 方法重启连接

#### 4. 中文浮动文字竖排
- 检测文本 >30% 中文字符 → 使用 `flex-col` 竖排显示
- 文件：`components/FloatingWords.tsx`

### ⏳ 待完成的功能

#### 1. 文本处理 API（免费版）
- **服务**：阿里云 Qwen 3.5-flash（100万 tokens 免费，3个月）
- **功能**：润色、摘要、标签、翻译、提取要点、生成标题
- **模式**：游客用开发者 API，注册用户填自己的 key

#### 2. 录音转文字 Refine（仅注册用户）
- 用户自己填 API key（Groq / OpenAI）
- 用于重新处理识别不好的录音

#### 3. 首页 UX 改动
- [ ] 移除 API Settings 入口
- [ ] 改成**登录/注册**按钮
- [ ] 显示游客说明（每周10分钟免费）

#### 4. 默认 HD 模式（简化流程）
- [ ] 所有人默认 HD 模式
- [ ] 移除 HD / Standard 切换按钮
- [ ] 额度用完 → 静默切换到 Standard（不弹窗）

### 🐛 已知问题

#### Bug 1: 录音中切换语言
- **状态**：✅ 已修复（`switchLanguage` 方法）
- **验证**：需要测试确认

#### Bug 2: Deepgram 中文识别偶尔不稳定
- **现象**：有时中文能识别，有时不能
- **原因**：Deepgram `zh-TW` 支持可能不稳定
- **备选方案**：
  1. 换成 Gladia（10小时/月免费，支持100+语言）
  2. 换成 Soniox（支持中英混合自动检测）
  3. 用阿里云（需要完成配置）

### 🔧 Environment Variables（环境变量）

在 Vercel Dashboard 配置：
```
UPSTASH_REDIS_REST_URL      # Redis URL
UPSTASH_REDIS_REST_TOKEN    # Redis Token
DEEPGRAM_API_KEY            # Deepgram API Key
```

阿里云相关（暂时不用）：
```
ALIYUN_ACCESS_KEY_ID
ALIYUN_ACCESS_KEY_SECRET
ALIYUN_APP_KEY
```

### 📁 关键文件

| 文件 | 作用 |
|-----|-----|
| `pages/HomePage.tsx` | 主页面，录音逻辑 |
| `services/hdService.ts` | HD 模式统一入口 |
| `services/deepgramService.ts` | Deepgram 单路转写 |
| `services/deepgramDualService.ts` | Deepgram 双路并行（AUTO） |
| `api/deepgram-key.ts` | 后端：分发 key，追踪配额 |
| `components/FloatingWords.tsx` | 浮动文字（含竖排中文） |
| `components/ApiSettings.tsx` | API 设置弹窗 |

### 🔍 调试技巧

Console 会显示：
```
[HomePage] Starting HD with speechLang: zh
[HDService] Language mode: zh, Selected service: deepgram
[HDService] Creating DeepgramTranscriber with language: zh-TW
[HomePage] Language toggle: en → zh
[HDService] Switching language from en to zh
```

如果语言不对，检查这些 log。
