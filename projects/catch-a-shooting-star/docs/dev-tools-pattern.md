# Developer Tool Pattern: In-Context Configuration

## 核心理念

**在实际场景中配置，而非独立 Playground**

传统的配置工具往往是独立的页面，用户无法看到配置在实际使用中的效果。这个模式将配置工具嵌入到实际应用中，让用户在真实场景下进行选择和调整。

---

## 模式结构

### 1. 分类系统 (Category System)

按**用途**和**属性**对配置项进行分类：

```typescript
// 按用途分类
const UI_FONTS = [...];      // UI 元素使用
const CONTENT_FONTS = [...]; // 内容展示使用

// 按属性分类
const ENGLISH_FONTS = [...]; // 英文字体
const CHINESE_FONTS = [...]; // 中文字体
```

**设计原则**：
- 每个类别有独立的配置列表
- 支持切换查看不同类别
- 不同类别可以有不同的默认值

### 2. 独立配置 (Per-Item Configuration)

每个配置项都有自己的参数设置：

```typescript
interface FontConfig {
  name: string;      // 标识
  file: string;      // 资源路径
  size: number;      // 该字体的推荐大小
}
```

**设计原则**：
- 不同项目可能需要不同参数（如不同字体需要不同大小才能看起来协调）
- 保存时记录当前参数，下次加载时恢复

### 3. 收藏系统 (Bookmark System)

用 Map 存储收藏项及其配置：

```typescript
// Map<名称, 配置参数>
const [favorites, setFavorites] = useState<Map<string, number>>(new Map());

// 收藏时保存当前配置
const toggleFavorite = (name: string) => {
  setFavorites(prev => {
    const next = new Map(prev);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.set(name, currentSize); // 保存当前大小
    }
    return next;
  });
};
```

**设计原则**：
- 收藏 = 标记 + 配置快照
- 选中收藏项时自动恢复其配置
- 修改配置时自动更新收藏中的值

### 4. 导出功能 (Export)

将配置导出为可复制的格式：

```typescript
const exportFavorites = () => {
  const data = Array.from(favorites.entries()).map(([name, size]) => ({
    name,
    size
  }));

  // 复制到剪贴板
  navigator.clipboard.writeText(JSON.stringify(data, null, 2));

  // 同时打印到控制台
  console.log('=== Exported Config ===');
  console.log(JSON.stringify(data, null, 2));
};
```

**设计原则**：
- JSON 格式，方便粘贴给 Claude 或其他工具
- 同时复制到剪贴板和控制台
- 可选：显示摘要提示

### 5. 键盘导航 (Keyboard Navigation)

快速选择和操作：

```typescript
useEffect(() => {
  if (!showSelector) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        setIndex(prev => Math.min(prev + 1, list.length - 1));
        break;
      case 'ArrowUp':
        setIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        selectItem(list[index]);
        break;
      case ' ':
        toggleFavorite(list[index].name);
        break;
      case 'Escape':
        setShowSelector(false);
        break;
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [showSelector, index, list]);
```

**快捷键约定**：
- `↑↓` - 导航
- `Enter` - 选择/预览
- `Space` - 收藏/取消收藏
- `Escape` - 关闭

### 6. 实时预览 (Live Preview)

配置变化立即应用到实际内容：

```typescript
// 配置 → 样式对象
const style = useMemo(() => ({
  fontFamily: selectedFont,
  fontSize: `${fontSize}px`,
  opacity: fontOpacity,
}), [selectedFont, fontSize, fontOpacity]);

// 应用到实际组件
<ContentDisplay style={style}>
  {actualContent}
</ContentDisplay>
```

**设计原则**：
- 无需"应用"按钮，即时生效
- 用户在真实内容上看到效果
- 支持动态内容（如随机内容展示不同效果）

---

## UI 布局模式

```
┌─────────────────────────────────────────────────────┐
│                    实际应用内容                       │
│                  (Live Preview)                      │
│                                                      │
│                                                      │
├─────────────────────────────────────────────────────┤
│ [类别切换] [参数滑块] [导出按钮]                       │  ← 控制栏
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────┐                     │
│ │ ↑↓ navigate • Enter select │  ← 提示             │
│ │ ★ Item A          24px  ● │  ← 收藏 + 当前      │
│ │   Item B          18px    │                      │
│ │ ★ Item C          20px    │  ← 收藏             │
│ │   Item D          22px    │                      │
│ └─────────────────────────────┘  ← 选择器面板      │
└─────────────────────────────────────────────────────┘
```

---

## 访问入口

```typescript
// URL 路径
if (path.includes('/fonts')) return 'dev-tool';

// URL 参数
const params = new URLSearchParams(window.location.search);
if (params.get('dev') === 'fonts') return 'dev-tool';

// 主应用内嵌（推荐）
// 在主界面底部或侧边显示控制面板
```

**访问方式**：
1. 直接 URL: `/app/fonts` 或 `?dev=fonts`
2. 主界面内嵌的控制面板
3. 告诉 Claude: "打开字体开发工具"

---

## 数据流

```
用户选择 → 更新 State → 重新计算 Style → 应用到组件 → 用户看到效果
    ↓
收藏操作 → 更新 Favorites Map → 可导出
```

---

## 复用清单

创建新的 Dev Tool 时：

- [ ] 定义配置项接口 (`interface XxxConfig`)
- [ ] 创建分类数组 (`const CATEGORY_A = [...]`)
- [ ] 添加选择状态 (`useState`)
- [ ] 添加收藏 Map (`useState<Map>`)
- [ ] 实现键盘导航 (`useEffect + keydown`)
- [ ] 实现导出功能 (`navigator.clipboard`)
- [ ] 创建样式计算 (`useMemo`)
- [ ] 在实际组件上应用样式
- [ ] 添加 UI 控制面板

---

## 示例：颜色配置工具

```typescript
interface ColorConfig {
  name: string;
  value: string;
  opacity: number;
}

const UI_COLORS = [
  { name: 'Midnight', value: '#1a1a2e', opacity: 1 },
  { name: 'Ocean', value: '#16213e', opacity: 0.9 },
];

const ACCENT_COLORS = [
  { name: 'Gold', value: '#ffd700', opacity: 1 },
  { name: 'Coral', value: '#ff6b6b', opacity: 0.8 },
];

// 收藏: Map<name, { value, opacity }>
const [favoriteColors, setFavoriteColors] = useState(new Map());

// 导出
const exportColors = () => {
  const data = Array.from(favoriteColors.entries());
  navigator.clipboard.writeText(JSON.stringify(data, null, 2));
};
```

---

## 文件结构建议

```
src/
├── dev-tools/
│   ├── FontSelector/
│   │   ├── index.tsx        # 主组件
│   │   ├── config.ts        # 字体配置
│   │   └── hooks.ts         # useKeyboardNav, useFavorites
│   ├── ColorPicker/
│   │   └── ...
│   └── shared/
│       ├── SelectorPanel.tsx   # 通用选择面板
│       ├── ExportButton.tsx    # 导出按钮
│       └── useDevTool.ts       # 通用 hook
└── ...
```
