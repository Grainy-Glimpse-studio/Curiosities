/**
 * Vertical Text Playground
 *
 * Test different vertical text layout styles for Chinese/Japanese
 * Access via: /?dev=vertical or /vertical
 */

import { useState, useMemo } from 'react';

// Sample texts for testing
const SAMPLE_TEXTS = {
  short: '锦瑟无端五十弦，一弦一柱思华年。',
  medium: '锦瑟无端五十弦，一弦一柱思华年。庄生晓梦迷蝴蝶，望帝春心托杜鹃。',
  long: '锦瑟无端五十弦，一弦一柱思华年。庄生晓梦迷蝴蝶，望帝春心托杜鹃。沧海月明珠有泪，蓝田日暖玉生烟。此情可待成追忆，只是当时已惘然。',
  prose: '我已经老了。有一天，在一处公共场所的大厅里，有一个男人向我走来，他主动介绍自己，他对我说：「我认识你，我永远记得你。」',
};

const SAMPLE_META = '李商隐 / 《锦瑟》';

type LayoutStyle = 'standard' | 'staggered' | 'scattered' | 'wave' | 'mixed';

interface LayoutOption {
  id: LayoutStyle;
  name: string;
  nameZh: string;
  description: string;
}

const LAYOUT_OPTIONS: LayoutOption[] = [
  { id: 'standard', name: 'Standard', nameZh: '标准竖排', description: '传统竖排，从右到左' },
  { id: 'staggered', name: 'Staggered', nameZh: '参差错落', description: '每列有轻微上下偏移' },
  { id: 'scattered', name: 'Scattered', nameZh: '散落浮动', description: '每个字符独立偏移和旋转' },
  { id: 'wave', name: 'Wave', nameZh: '波浪排列', description: '列之间形成波浪曲线' },
  { id: 'mixed', name: 'Mixed', nameZh: '混合排版', description: '竖排正文 + 横排元数据' },
];

// Standard vertical layout
const StandardLayout: React.FC<{ text: string; meta: string }> = ({ text, meta }) => {
  return (
    <div className="flex flex-col items-center">
      <div
        className="text-white/90 leading-loose"
        style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          fontSize: '24px',
          letterSpacing: '0.1em',
          lineHeight: '2',
        }}
      >
        {text}
      </div>
      <div className="mt-8 text-white/50 text-sm">
        {meta}
      </div>
    </div>
  );
};

// Staggered layout - columns with random vertical offset
const StaggeredLayout: React.FC<{ text: string; meta: string }> = ({ text, meta }) => {
  // Split text into columns (roughly 10 chars each)
  const columns = useMemo(() => {
    const cols: string[] = [];
    const charsPerCol = 8;
    for (let i = 0; i < text.length; i += charsPerCol) {
      cols.push(text.slice(i, i + charsPerCol));
    }
    return cols;
  }, [text]);

  // Generate random offsets for each column
  const offsets = useMemo(() => {
    return columns.map(() => Math.random() * 40 - 20); // -20px to +20px
  }, [columns.length]);

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-row-reverse gap-6">
        {columns.map((col, i) => (
          <div
            key={i}
            className="text-white/90"
            style={{
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              fontSize: '24px',
              letterSpacing: '0.1em',
              lineHeight: '1.8',
              transform: `translateY(${offsets[i]}px)`,
            }}
          >
            {col}
          </div>
        ))}
      </div>
      <div className="mt-8 text-white/50 text-sm">
        {meta}
      </div>
    </div>
  );
};

// Scattered layout - each character with random offset and rotation
const ScatteredLayout: React.FC<{ text: string; meta: string }> = ({ text, meta }) => {
  const chars = useMemo(() => {
    return text.split('').map((char, i) => ({
      char,
      offsetX: Math.random() * 8 - 4,      // -4px to +4px
      offsetY: Math.random() * 6 - 3,      // -3px to +3px
      rotation: Math.random() * 4 - 2,     // -2deg to +2deg
      delay: i * 0.05,                      // Animation delay
    }));
  }, [text]);

  // Arrange in columns
  const charsPerCol = 8;
  const columns: typeof chars[] = [];
  for (let i = 0; i < chars.length; i += charsPerCol) {
    columns.push(chars.slice(i, i + charsPerCol));
  }

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-row-reverse gap-8">
        {columns.map((col, colIndex) => (
          <div key={colIndex} className="flex flex-col items-center gap-1">
            {col.map((c, charIndex) => (
              <span
                key={charIndex}
                className="text-white/90 inline-block"
                style={{
                  fontSize: '24px',
                  transform: `translate(${c.offsetX}px, ${c.offsetY}px) rotate(${c.rotation}deg)`,
                  transition: 'transform 0.3s ease',
                }}
              >
                {c.char}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-8 text-white/50 text-sm">
        {meta}
      </div>
    </div>
  );
};

// Wave layout - columns form a wave pattern
const WaveLayout: React.FC<{ text: string; meta: string }> = ({ text, meta }) => {
  const charsPerCol = 8;
  const columns: string[] = [];
  for (let i = 0; i < text.length; i += charsPerCol) {
    columns.push(text.slice(i, i + charsPerCol));
  }

  // Wave pattern offset
  const waveOffsets = columns.map((_, i) => {
    return Math.sin((i / columns.length) * Math.PI * 2) * 30;
  });

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-row-reverse gap-6 items-start">
        {columns.map((col, i) => (
          <div
            key={i}
            className="text-white/90"
            style={{
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              fontSize: '24px',
              letterSpacing: '0.1em',
              lineHeight: '1.8',
              transform: `translateY(${waveOffsets[i]}px)`,
            }}
          >
            {col}
          </div>
        ))}
      </div>
      <div className="mt-8 text-white/50 text-sm">
        {meta}
      </div>
    </div>
  );
};

// Mixed layout - vertical text with horizontal metadata
const MixedLayout: React.FC<{ text: string; meta: string }> = ({ text, meta }) => {
  return (
    <div className="flex flex-col items-center">
      <div className="border-b border-white/20 pb-6 mb-4">
        <div
          className="text-white/90"
          style={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            fontSize: '24px',
            letterSpacing: '0.15em',
            lineHeight: '2.2',
            maxHeight: '400px',
          }}
        >
          {text}
        </div>
      </div>
      <div className="text-white/50 text-sm tracking-wider">
        {meta}
      </div>
    </div>
  );
};

// Main Playground component
// Add global style to enable scrolling
const globalStyle = `
  html, body, #root {
    overflow: auto !important;
    height: auto !important;
    min-height: 100vh;
  }
`;

const VerticalTextPlayground: React.FC = () => {
  const [selectedLayout, setSelectedLayout] = useState<LayoutStyle>('standard');
  const [selectedText, setSelectedText] = useState<keyof typeof SAMPLE_TEXTS>('medium');
  const [customText, setCustomText] = useState('');

  const displayText = customText || SAMPLE_TEXTS[selectedText];

  const renderLayout = () => {
    const props = { text: displayText, meta: SAMPLE_META };

    switch (selectedLayout) {
      case 'standard':
        return <StandardLayout {...props} />;
      case 'staggered':
        return <StaggeredLayout {...props} />;
      case 'scattered':
        return <ScatteredLayout {...props} />;
      case 'wave':
        return <WaveLayout {...props} />;
      case 'mixed':
        return <MixedLayout {...props} />;
      default:
        return <StandardLayout {...props} />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8 pb-24 overflow-auto">
      {/* Enable scrolling */}
      <style>{globalStyle}</style>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl mb-2">Vertical Text Playground</h1>
        <p className="text-white/40 text-sm">竖排文字排版测试</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-8 mb-12">
        {/* Layout selector */}
        <div>
          <div className="text-white/50 text-xs mb-2 uppercase tracking-wider">Layout Style</div>
          <div className="flex flex-wrap gap-2">
            {LAYOUT_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => setSelectedLayout(option.id)}
                className={`px-4 py-2 rounded-lg text-sm transition-all ${
                  selectedLayout === option.id
                    ? 'bg-white/20 text-white border border-white/40'
                    : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                }`}
              >
                <div>{option.nameZh}</div>
                <div className="text-xs opacity-60">{option.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Text length selector */}
        <div>
          <div className="text-white/50 text-xs mb-2 uppercase tracking-wider">Text Length</div>
          <div className="flex gap-2">
            {(['short', 'medium', 'long', 'prose'] as const).map((key) => (
              <button
                key={key}
                onClick={() => {
                  setSelectedText(key);
                  setCustomText('');
                }}
                className={`px-3 py-2 rounded text-sm transition-colors ${
                  selectedText === key && !customText
                    ? 'bg-white/20 text-white'
                    : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Layout description */}
      <div className="mb-8 p-4 bg-white/5 rounded-lg">
        <div className="text-white/70 text-sm">
          <span className="text-white/90 font-medium">
            {LAYOUT_OPTIONS.find(o => o.id === selectedLayout)?.nameZh}
          </span>
          {' — '}
          {LAYOUT_OPTIONS.find(o => o.id === selectedLayout)?.description}
        </div>
      </div>

      {/* Preview area */}
      <div className="flex justify-center items-center min-h-[500px] bg-white/5 rounded-xl p-12">
        {renderLayout()}
      </div>

      {/* Custom text input */}
      <div className="mt-8">
        <div className="text-white/50 text-xs mb-2 uppercase tracking-wider">Custom Text</div>
        <textarea
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="输入自定义文字测试..."
          className="w-full h-24 bg-white/5 border border-white/10 rounded-lg p-4 text-white/90 placeholder-white/30 focus:outline-none focus:border-white/30"
        />
      </div>

      {/* Back link */}
      <a
        href="/"
        className="fixed top-6 right-6 text-white/40 hover:text-white/70 text-sm"
      >
        ← Back
      </a>
    </div>
  );
};

export default VerticalTextPlayground;
