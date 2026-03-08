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

| Color | Hex | Usage |
|-------|-----|-------|
| **Theme Red** | `#903e4f` | Title hover, Play button hover, Delete buttons, action highlights |
| **Theme Purple** | `#b69fbb` | Selected states, accents, Login/HD indicator, AI features |
| Lighter Red | `#b85a6a` | Secondary red accents |
| Dark Background | `#1a1a1a` | Card backgrounds, containers |

**Usage Guidelines:**
- **Theme Red (#903e4f)**: For interactive elements, hover states, destructive actions
- **Theme Purple (#b69fbb)**: For selection states, non-destructive highlights, branding accents

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

---

## 📋 TODO List（2026-03-01 晚间整理）

### 🎨 UI/UX 改进

#### 1. 磁带卡片容器适配
- [ ] 卡片大小需要做响应式/容器适配
- [ ] 当前尺寸在不同屏幕上显示不理想

#### 2. ARCHIVE 文字样式
- [x] 一开始可见，鼠标划过时发光更亮
- [x] 调整 opacity 到合适程度（当前 0.08）

#### 3. Ephemera 页面重做
- [ ] 当前页面不好看，需要重新设计

### 🔧 工作模式（Work Mode / Focus Mode 扩展）

#### 4. 双主题模式
- [ ] **Bright 模式**：白色为主，极简风格
- [ ] **Dark 模式**：黑底白字，极简风格
- [ ] 两种模式都是为了提高工作效率

#### 5. 工作模式卡片功能
- [ ] 卡片可以**放大缩小**
- [ ] 没有立体效果，就是平面卡片
- [ ] 整体像**白板/黑板**，可以自由放置卡片
- [ ] 卡片**底图颜色可换**（用户自选）

#### 6. 创建空白文档
- [ ] 可以创建**空白浮动窗口**
- [ ] 方便用户在空白处写东西（文本编辑器功能）

### 🏷️ 标签与颜色系统

#### 7. 磁带标签换颜色
- [ ] 标签可以选择不同颜色

#### 8. 标题可编辑
- [ ] 每个文件的标题名字可以修改

#### 9. 标题颜色可选
- [ ] 给一个默认颜色
- [ ] 用户可以自己选颜色
- [ ] **Color Palette**：预设好看的颜色 + 自定义选色器

### 📂 归档与合并

#### 10. 归档/文件夹功能
- [ ] 某种方式把多个卡片归档到一起
- [ ] 具体方案还没想清楚（文件夹？分组？）

#### 11. 拖拽合并功能
- [ ] 把一个卡片拖到另一个上面
- [ ] **按住不放**一段时间后提示是否合并
- [ ] 合并后：
  - 两条录音都保留，可以一起下载
  - 文档按时间顺序前后合并

### 🎤 音频/视频处理

#### 12. 拖拽文件识别
- [ ] 在 Archive 界面支持**拖拽上传音频/视频**
- [ ] 视频 → 转成音频（P3？）
- [ ] 音频 → 调用 API 转成文字

#### 13. 文本处理 API
- [ ] 调用 API 对转写文字进行整理
- [ ] 润色、摘要、标签、翻译等功能

### 🌟 其他

#### 14. 星号/标记功能
- [ ] 可以给卡片打星号或标记
- [ ] 全局模式都统一（Archive 界面、工作模式都支持）

---

### 优先级建议

**高优先级**（影响基本使用）：
1. 磁带卡片容器适配
2. 标题可编辑
3. 文本处理 API

**中优先级**（增强体验）：
4. 工作模式双主题
5. 拖拽文件识别
6. 标签换颜色

**低优先级**（锦上添花）：
7. 拖拽合并
8. 归档/文件夹
9. Ephemera 页面重做

---

## 2026-03-07 AI 文字处理功能设计

### 🎯 功能列表

#### 1. Cleanup（基础版）
- 去掉口癖词（嗯、啊、呀等）
- 去掉重复词句（"那个什么那个什么"）
- **可选开关**

#### 2. Summary（摘要）
- 自动生成一段摘要放在文本最前面
- 概括这段录音在说什么
- **可选开关**

#### 3. 划线 → 小标题
- 把用户画横线的文字变成 markdown 小标题（##）
- 取消横线，另起一行变成标题
- **一键操作**

#### 4. 重新转录
- 用原始录音（本地保存的）
- 用更好的 AI 重新转写一遍
- 替换掉原来转写不好的文本

#### 5. Cleanup（定制版）
- 用户自己写 prompt 或上传模板
- 按照用户的定制需求整理文字
- 与基础 Cleanup 分开，让用户自己选

### 🎨 UI 设计

#### AI 按钮位置
- 在浮动窗口的工具栏（B I U H1 H2...）旁边
- 添加一个 "AI" 或 "✨" 按钮
- 点击弹出面板（不是下拉菜单）

#### AI 面板设计
```
┌─────────────────────────────┐
│  AI Processing              │
├─────────────────────────────┤
│  Cleanup                    │  ← 白色（未选）
│  ✦ Summary                  │  ← 淡紫色（已选）
│  ✦ 划线 → 小标题             │  ← 淡紫色（已选）
│  定制 Cleanup               │  ← 白色（未选）
│    └─ [prompt 输入框...]     │  ← 选中后展开
│                             │
│  重新转录                    │  ← 单独区域（用原始音频）
├─────────────────────────────┤
│           [ Apply ✨ ]       │
└─────────────────────────────┘
```

#### 交互方式
- **点击文字切换选中状态**（不用 checkbox）
- 未选中：白色文字
- 选中：淡紫色（violet-400）+ 前面加 ✦
- 可以**多选**，一次 API 调用处理所有勾选项
- "定制 Cleanup" 选中后展开 prompt 输入框
- "重新转录" 单独区域（逻辑不同，用原始音频）

---

## 📤 上传卡带设计

### 功能
- 在 Archive 页面添加一个**固定的上传卡带**
- 用于上传音频/视频文件转文字
- 支持 MP3、MP4 等格式
- 视频自动剥离音频（使用 ffmpeg.wasm）

### 卡带外观（收起状态）
- 和现有录音卡带一样的黑色容器样式
- 里面是空的，显示虚线边框 + 上传图标
- 文字提示："Drop audio/video here" 或 "Upload"

### 浮动窗口（点开后）
- 和现有编辑窗口一样的样式
- 内容区域是一个大的**拖拽区域**
- 拖拽 MP3/MP4 进去
- 显示转录进度
- 完成后自动保存为新的录音卡带

### 技术方案
- 视频转音频：ffmpeg.wasm（纯前端，不花钱）
- 音频转文字：调用用户配置的语音识别 API

---

## ☁️ Cloud Sync 云同步架构 (2026-03-07)

### 当前实现（Phase 1）
- **只同步文字**：transcription, tags, metadata, highlighted_words
- **不同步音频/图片**：Supabase 免费版带宽限制（2GB/月）
- **表结构**：`user_memos`（见 `services/memoSync.ts`）

### 未来升级路径（Phase 2 - 付费版）

#### UI 设计（已规划）
点击 Sync 按钮弹出多选菜单：
```
┌─────────────────────┐
│  ☑ Text (文档)       │
│  ☐ Audio (录音)      │
│  ☐ Visuals (图片)    │
├─────────────────────┤
│      [ Sync ]       │
└─────────────────────┘
```

#### 技术方案
- **文字**：存 Supabase Database（当前方案）
- **音频/图片**：存 Supabase Storage（需升级）
  ```
  storage/user-files/{user_id}/
  ├── audio/memo-xxx.webm
  ├── visuals/img-xxx.jpg
  └── documents/memo-xxx.md
  ```
- **数据库**：只存元数据 + 文件路径（不存 base64）

#### 配额设计
- 免费版：只同步文字
- 付费版：每用户 100MB Storage + 音频/图片同步
- 需要 `user_storage_usage` 表追踪用量

#### 升级触发点
- 用户量 > 100
- 有付费意愿的用户需求

---

## 🐛 待修复问题

### Supabase 邮件确认 redirect 到 localhost
- **状态**：待修复（需等 rate limit 过后测试）
- **已尝试**：
  1. 设置了 Site URL 和 Redirect URLs
  2. 添加了 `emailRedirectTo: window.location.origin`
- **下一步**：等 1 小时后重新测试
