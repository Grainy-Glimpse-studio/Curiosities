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

---

## 2026-03-08 暂停/继续录音功能（Resume）

### ✅ 已完成

#### 1. 数据结构修改 (types.ts)
- [x] 添加 `audioUrls: string[]` - 多段音频 URL
- [x] 添加 `blobs?: Blob[]` - 多段音频 Blob
- [x] 添加 `segmentDurations?: number[]` - 每段时长
- [x] 保留 `audioUrl` 和 `blob` 向后兼容

#### 2. 存储层修改 (HomePage.tsx)
- [x] `loadMemosFromStorage()` 支持新旧格式
- [x] `saveMemosToStorage()` 支持多段 base64
- [x] 数据迁移：旧格式自动转新格式
- [x] 垃圾桶存储也支持多段

#### 3. 录音逻辑修改 (HomePage.tsx)
- [x] 添加 `resumingMemoId` 和 `resumingMemo` 状态
- [x] 使用 `useRef` 避免闭包问题
- [x] `onstop` 回调支持追加到现有 memo
- [x] 暂停按钮改为停止并保存（不是真正暂停）

#### 4. 麦克风共享
- [x] HomePage 获取 stream 后传给 HD 服务
- [x] 避免两个服务同时请求麦克风冲突
- [x] `ownsStream` 标记控制 stream 释放

#### 5. FloatingTranscript 修改
- [x] 添加 `onResume` prop 和 Resume 按钮
- [x] 多段音频顺序播放
- [x] 进度条可点击/拖动跳转
- [x] 显示当前时间 / 总时长

#### 6. UI 指示
- [x] 录音时显示 "RESUMING" 标记（左上角）
- [x] 进度条始终可见（不只是播放时）

### ❌ 待修复

#### Bug: Resume 后 transcribe 文字没有保存
- **现象**：
  - 主页 floating words 能显示识别的文字
  - 但停止后，卡带里没有新的 transcription
- **已添加详细调试日志** (2026-03-08 晚更新)：

**Console 关键日志点**：

```
[Resume] handleResume called with memo: xxx     <- 1. Resume 触发
[Resume] Refs set - resumingMemoIdRef: xxx      <- 2. Ref 设置成功

[DualTranscriber] stop() called                  <- 3. 转写服务停止
[DualTranscriber] Current transcript length: XX  <- 4. 检查是否有累积文本
[DualTranscriber] Returning text: ...            <- 5. 返回的文本

[HDService] stop() called                        <- 6. HD 服务停止
[HDService] Transcriber result: ...              <- 7. 传递的结果

[Recording] onstop triggered                     <- 8. MediaRecorder 停止
[Recording] transcriber.stop() result: ...       <- 9. 收到的结果

[Resume Debug] ===== RESUME CHECK =====
[Resume Debug] currentResumingId: xxx            <- 10. 检查 ref 是否仍有值
[Resume Debug] newText length: XX                <- 11. 新文本长度

[Resume Debug] ===== APPENDING TO EXISTING MEMO =====
[Resume Debug] setMemos callback                 <- 12. 是否进入追加逻辑
[Resume Debug] Found target memo: yes/no         <- 13. 是否找到目标
[Resume Debug] Updated memo transcription: XX    <- 14. 更新后的长度
```

**调试步骤**：
1. 打开 Chrome DevTools Console
2. 点击 Resume 开始录音
3. 说几句话（等 floating words 显示）
4. 停止录音
5. 查看 Console 日志，找到断点位置

**可能的问题**：
1. 如果 `currentResumingId` 是 null → ref 设置问题
2. 如果 `newText length` 是 0 → 转写累积问题
3. 如果没有 `APPENDING` 日志 → 条件判断问题
4. 如果 `Found target memo: no` → memo 查找问题

### 📁 相关文件

| 文件 | 改动 |
|------|------|
| `types.ts` | Memo 接口添加多段音频字段 |
| `pages/HomePage.tsx` | Resume 逻辑、存储、麦克风共享 |
| `components/FloatingTranscript.tsx` | Resume 按钮、多段播放、进度条拖动 |
| `components/CassetteTape.tsx` | 兼容 audioUrls |
| `services/hdService.ts` | start() 接受外部 stream |
| `services/deepgramService.ts` | start() 接受外部 stream，ownsStream 标记 |
| `services/deepgramDualService.ts` | 同上 |
| `services/dashscopeService.ts` | 同上 |

### 🎯 功能流程

```
1. 用户正常录音
2. 点击暂停/停止 → 保存为卡带
3. 打开卡带浮动窗口
4. 点击 Resume 按钮 → 关闭窗口，开始录音，左上角显示 RESUMING
5. 说话（floating words 显示）
6. 点击停止 → 新内容追加到原卡带（用 ——— 分隔）
7. 重新打开卡带 → 应该看到合并后的内容
```

### 🔧 进度条拖动功能

- **点击**：点击进度条任意位置跳转
- **拖动**：按住拖动小圆点调整位置
- **多段音频**：自动计算跳转到哪一段的哪个位置
- **时间显示**：`0:00 / 1:30` 格式

---

## 🎬 影视工作流功能（片场录音机 + 时码器）

### 背景

把 Diane 用于影视制作场景，作为带时码的片场录音机。Deepgram 返回的时间戳本质上就是时码，可以用于后期剪辑同步。

### 现有功能

- 在线录音机
- 接入 Deepgram API 实时转录（带时间戳）
- 文本编辑器可以编辑转录文稿
- 可以导出音频和文字

### 需要新增/修改的功能

#### 1. Export 导出选项修改

Archive 界面浮动窗口的 Export 里修改导出选项：

| 选项 | 说明 |
|------|------|
| Audio (MP3) | 现有 |
| Audio (WAV) | 现有改名 |
| **Audio (BWF)** | 🆕 Broadcast Wave Format，文件头写入 TimeReference |
| **Subtitles (SRT)** | 🆕 Deepgram 时间戳直接转成 SRT 格式 |

#### BWF 技术要点

```
录音开始时记录系统时间
TimeReference = 录音开始时间（距午夜秒数）× 采样率（44100）
BWF 和 SRT 时间起点相同 → 导进 DaVinci 字幕自动对齐
```

#### 2. 打板键 (Slate / Cue Mark)

- **位置**：录音机界面上现有的 Play 播放键改成打板键
- **样式**：主题红色 `#903e4f`，圆形按钮
- **功能**：按下时在音频里插入一个 **1kHz、100ms** 的哔声作为标记
- **使用场景**：录屏或 PPT 录制时配合视觉标记使用

#### 3. ElevenLabs API 接入

- 接入 ElevenLabs API 做声音转换/TTS
- **UI/UX 待定，暂不实现**

### 完整工作流

```
录音
  ↓
Deepgram 实时转文字
  ↓
编辑器清理文稿
  ↓
ElevenLabs 生成新声音音频（待定）
  ↓
导出 BWF + SRT
  ↓
拖进 DaVinci Resolve
  ↓
字幕自动对齐，音频直接可用
```

### 实现优先级

1. **高**：SRT 导出 ✅ 已完成 (2026-03-08)
2. **高**：BWF 导出 ✅ 已完成 (2026-03-08) - TimeReference 写入 bext chunk
3. **高**：WAV 导出 ✅ 已完成 (2026-03-08) - WebM 转 WAV
4. **中**：打板键（音频生成 + 混音）
5. **低**：ElevenLabs 接入（待定）

---

## 📝 待做清单 (2026-03-08 晚整理)

### 🤖 AI 文字处理

#### 1. 选择新的 API（非 OpenAI）
- **状态**：待选择
- **候选**：
  - 阿里云 Qwen (100万 tokens 免费)
  - Groq (快但有 rate limit)
  - Claude API
  - 其他？
- **需求**：便宜/免费、支持中英文、响应快

#### 2. 编写 AI Prompts
- **状态**：部分完成（本地功能已实现，AI 功能待 API 选择）
- **已完成（本地处理，不需要 AI）**：
  - ✅ Cleanup 基础版：去口癖词、去重复（正则匹配）
    - 中文：嗯、呃、啊、那个、就是说、然后呢、对吧、你知道吗...
    - 英文：um, uh, like, you know, i mean, basically, actually...
  - ✅ 划线→小标题：下划线文字转 H2 标题
- **待 AI API 选择后实现**：
  - Summary 摘要：概括内容
  - 定制 Cleanup：用户自定义模板
  - 重新转录：用更好的模型重转

### 🎨 UI/UX 改进

#### 3. 简洁工作主题 (Focus Mode 扩展)
- **状态**：UI 设计未完成
- **目标**：一键切换到简洁工作主题
- **特点**：
  - 可能是白底/浅色主题
  - 极简设计，减少视觉干扰
  - 适合工作/写作场景

#### 4. 全局中文切换
- **状态**：暂缓（先做完英文）
- **范围**：界面 UI 文字切换为中文
- **优先级**：低

#### 5. Ephemera 页面重新设计
- **状态**：已有设计方案
- **参考项目**：`catch-a-shooting-star`（同目录下的项目）

**设计方案**：
- **核心交互**：
  - 长 Markdown 文档分段显示
  - **按 Enter 键**：切换到下一段
  - 偶尔有流星飞过（比主页少）
  - **按 Space 键**：抓住流星，显示 About Me
- **UI 布局**：
  - 打开 Ephemera 界面 → 显示第一段文字
  - 底部提示："press enter to continue"
  - 流星不频繁，偶尔出现
- **About Me**：
  - 抓住流星后显示关于创作者的介绍

**技术参考**：
- 看 `catch-a-shooting-star/src/core/StarCatcher.tsx` - 流星捕捉逻辑
- 看 `catch-a-shooting-star/src/core/ShootingStar.tsx` - 流星动画

### ✏️ 文档编辑功能

#### 6. 左侧目录栏 (Table of Contents)
- **状态**：✅ 已完成 (2026-03-08)
- **位置**：浮动窗口左侧（点击工具栏 TOC 按钮展开）
- **功能**：
  - 可折叠的侧边栏（180px 宽）
  - 显示文档结构（H1、H2 标题）
  - 点击跳转到对应位置
  - 从 TipTap editor JSON 提取标题

#### 7. 标题可编辑
- **状态**：✅ 已完成 (2026-03-08)
- **实现**：
  - 浮动窗口标题使用 contentEditable
  - 点击编辑，失焦保存
  - 自动从 transcription 前 30 字符生成默认标题
  - 保存到 memo.title 字段

### 📄 富媒体内容支持

#### 8. 浮动窗口富媒体支持
- **状态**：待实现
- **目标**：Archive 磁带浮动窗口支持多种内容类型
- **支持类型**：
  - ✅ 音频（已有）
  - ✅ 文字（已有）
  - ⬜ 图片（拖拽上传）
  - ⬜ 视频（拖拽上传）
  - ⬜ 网页链接 embed
- **技术问题**：
  - 如何实现实时 embed（如 X/Twitter 帖子）？
  - 需要研究 oEmbed 协议或第三方库

### 📖 说明书/Guide

#### 10. README + 说明书卡带
- **状态**：等 API 功能做完后开始
- **流程**：
  1. 写一个详细的 README/文档
     - 事无巨细列出所有功能
     - 每个按键干什么
     - 每个功能怎么用
  2. 把文档给 AI 写一个语音讲解稿
  3. 录制音频版说明书
  4. 做成一个 "About" 卡带放在 Archive 里
     - 跟 Twin Peaks 1990 那个卡带一样是默认存在的
     - 包含音频讲解
     - 可能有图片/视频演示
     - 用户可以"听"和"看"来了解功能

### 🎤 ElevenLabs 语音合成

#### 11. ElevenLabs API 接入
- **状态**：待实现
- **用户场景**：
  - 录了一段自己的声音，想换成其他声音发布
  - 有一段文字，想用特定声音读出来
- **功能**：
  - 用户输入自己的 API key
  - 选择 ElevenLabs 声音库的声音 / 克隆声音
  - 生成新的音频并下载
- **UI 问题**：
  - 放在哪里？Export 菜单已经很拥挤了
  - 目前 Export 要放：SRT、BWF、WAV、ElevenLabs...
  - **需要重新设计 Export UI**

### 📱 多平台适配

#### 12. Mobile 页面适配
- **状态**：待做
- **内容**：
  - 手机端 layout 需要重新设计
  - 响应式布局

#### 13. App Store 上架
- **状态**：未来目标
- **平台**：iOS / Mac App
- **问题**：
  - 怎么打包成 App？
  - 目前功能不复杂，可能只需要改打包方式
  - 需要研究 PWA / Electron / Tauri / Capacitor 等方案

---

### 🔮 Future TODO（未来研究）

#### XML 项目导出
- **价值**：批量素材一键导入，时间线已排好
- **格式**：DaVinci Resolve XML 或 FCPXML
- **内容**：多条音频 + 字幕 + 打板标记点
- **场景**：一天拍 20 条素材，导出一个 XML，打开就全排好
- **难度**：需要研究 DaVinci XML 规范

#### 时码同步 (Timecode Sync)
- **目标**：BWF + SRT + 视频文件自动对齐
- **当前限制**：Diane 是网页应用，无法直接与相机通信
- **可行方案**：
  1. 系统时间同步（设备都用 NTP 精确时间）
  2. 打板 + 波形对齐（当前方案）
- **未来可能**：
  - 手机 App + 蓝牙与相机通信
  - 外接硬件时码器（Tentacle Sync 等）
- **需要研究**：
  - Jam Sync 原理
  - 不同相机的时码支持情况
  - LTC/SMPTE 时码格式

---

## 2026-03-08 夜间实现总结

### ✅ 今晚完成的功能

| 功能 | 文件 | 说明 |
|------|------|------|
| **SRT 字幕导出** | FloatingTranscript.tsx | 从 word timestamps 生成标准 SRT 格式 |
| **WAV 导出** | utils/audioExport.ts | WebM 转 WAV（Web Audio API 解码） |
| **BWF 导出** | utils/audioExport.ts | 带 bext chunk 的 WAV，写入 TimeReference |
| **标题可编辑** | FloatingTranscript.tsx | contentEditable，自动生成默认标题 |
| **左侧 TOC** | FloatingTranscript.tsx | 从 TipTap JSON 提取 H1/H2 标题 |
| **划线→标题** | FloatingTranscript.tsx | AI 侧边栏功能，本地处理无需 API |
| **Cleanup** | FloatingTranscript.tsx | 本地去口癖词（中英文），无需 AI |
| **导出加载状态** | FloatingTranscript.tsx | WAV/BWF 转换时显示 spinner |

### 📁 新增文件

- `utils/audioExport.ts` - 音频导出工具（WAV/BWF 转换）

### 🔧 修改文件

- `types.ts` - 添加 `title?: string` 字段
- `pages/HomePage.tsx` - Resume 调试日志、标题变更回调
- `components/FloatingTranscript.tsx` - 所有新功能实现
- `services/speechService.ts` - TranscriptionResult 添加 wordTimestamps 类型

### ⏳ 待用户测试

- **Resume 功能 bug**：追加录音后 transcription 没保存
  - 已添加详细 Console 日志
  - 用户需打开 DevTools Console 测试并查看 `[Resume]` 开头的日志

### 🚀 部署

- 所有更改已推送到 `origin/main`
- Vercel 会自动部署

---

## 🐛 Bug Report 功能设计（待截图参考）

### 当前实现（简单版）
- **位置**：右上角
- **文字**："Something's wrong"
- **颜色**：主题紫色 `#b69fbb`
- **功能**：点击打开 mailto 链接，预填报告模板

### 计划实现（引导式报告）

等用户发截图参考后实现：

1. **引导式流程**：
   - 步骤 1：选择问题类别（录音、播放、导出、UI、其他）
   - 步骤 2：描述问题
   - 步骤 3：截图上传（可选）
   - 步骤 4：自动收集环境信息

2. **自动收集的信息**：
   - 浏览器 User Agent
   - 当前 URL
   - 当前页面状态
   - Console 错误日志（如果可以获取）
   - 录音模式（HD/STD）
   - 语言设置

3. **生成报告格式**：
   - 对 AI 友好的结构化信息
   - 包含足够的上下文让 AI 能快速定位问题

### AI Debug 友好的报告格式（思考）

```markdown
## Bug Report

### 环境
- Browser: Chrome 120
- OS: macOS 14.2
- Mode: HD
- Language: en

### 问题
- Category: Recording
- Description: ...

### 重现步骤
1. ...
2. ...

### 期望行为
...

### 实际行为
...

### Console 错误
```
[error logs]
```

### 截图
[attached]
```

### ✅ 已完成（2026-03-08 晨）

Bug Report 面板 UI 已实现：
- **位置**：右上角 "Something's wrong" 按钮
- **样式**：与 ApiSettings 相同的透明毛玻璃风格
- **3步流程**：
  1. 选择分类（6个按钮）+ 可选描述
  2. 上传截图（拖拽/粘贴/点击）
  3. 选择严重程度（3级）

### ⏳ 待完成

1. **EmailJS 模板**：需要在 EmailJS 创建 `template_bugreport` 模板
   - 变量：category, description, severity, severity_desc, screenshot, browser, url, timestamp, screen_size

2. **截图发送**：目前截图只能通过 mailto fallback 时无法发送
   - 选项 A：用 Supabase Storage 存截图，邮件里放链接
   - 选项 B：Base64 编码放邮件里（可能太大）
   - 选项 C：用第三方服务如 Imgur 上传

3. **Console 错误收集**：自动捕获 JS 错误日志
