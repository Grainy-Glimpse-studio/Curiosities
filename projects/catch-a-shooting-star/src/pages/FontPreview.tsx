/**
 * Font Preview Page
 * Preview and select fonts for Chinese/English/Japanese
 */

import { useState, useMemo } from 'react';

// Font definitions
const FONTS = [
  { name: 'System Default', file: null, category: 'system' },

  // === 中文字體 ===
  { name: '匯文明朝體', file: '汇文明朝体.otf', category: 'chinese' },
  { name: '京華老宋體', file: '京華老宋体2.0.ttf', category: 'chinese' },
  { name: '中華薪火體', file: '中华薪火体.ttf', category: 'chinese' },
  { name: '大正活字明朝', file: '【大正活字】以梅明朝为基础，同时混合了源云明朝等字体.ttf', category: 'chinese' },
  { name: '齊伋體', file: 'qiji-combo.ttf', category: 'chinese' },
  { name: '思源宋體', file: 'SiyinSong-Regular.otf', category: 'chinese' },

  // === 日本語 ===
  { name: '市ヶ谷明朝', file: 'Ichigayamincho-9MAv0.ttf', category: 'japanese' },
  { name: 'Oradano 明朝', file: 'OradanoGSRR.ttf', category: 'japanese' },

  // === English Typewriter ===
  { name: '1942 Report', file: '1942 Report 是一种独特而与众不同的打字机字体，非常适合更具创意或艺术性的设计项目。.ttf', category: 'typewriter' },
  { name: 'AA Typewriter', file: 'AA_typewriter.ttf', category: 'typewriter' },
  { name: 'Erika Ormig', file: 'Erika Ormig.ttf', category: 'typewriter' },
  { name: 'Erika PL', file: 'Erika PL.otf', category: 'typewriter' },
  { name: 'Erika PL DWS', file: 'Erika PL DWS wariant.otf', category: 'typewriter' },
  { name: 'Elite Math', file: 'Elite Math Regular.ttf', category: 'typewriter' },
  { name: 'Kingthings Typewriter', file: 'Kingthings_Trypewriter_2.ttf', category: 'typewriter' },
  { name: "Mom's Typewriter", file: "Mom's Typewriter.ttf", category: 'typewriter' },
  { name: 'Mytype', file: 'mytype.ttf', category: 'typewriter' },
  { name: 'Daisywhl', file: 'daisywhl.otf', category: 'typewriter' },
  { name: 'Gabriele Bad', file: 'Gabriele Bad AH.ttf', category: 'typewriter' },
  { name: 'Gabriele Light', file: 'gabriele-l.ttf', category: 'typewriter' },
  { name: 'Nazi Typewriter', file: 'NaziTypewriterRegular.ttf', category: 'typewriter' },

  // === English Script/Handwriting ===
  { name: '1871 Dreamer Script', file: '1871 Dreamer Script W00 Normal.otf', category: 'script' },
  { name: 'Amastay', file: 'amastay.ttf', category: 'script' },
  { name: 'Belisma Kimono', file: 'BelismaKimono-KVyEA.ttf', category: 'script' },
  { name: 'Bertholina Script', file: 'Bertholina Script.otf', category: 'script' },
  { name: 'Better Do', file: 'Better do.otf', category: 'script' },
  { name: 'Buadly Signature', file: 'BuadlySignature.ttf', category: 'script' },
  { name: 'Wolgast Rand', file: 'WolgastRand.ttf', category: 'script' },
];

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'chinese', label: '中文' },
  { id: 'japanese', label: '日本語' },
  { id: 'typewriter', label: 'Typewriter' },
  { id: 'script', label: 'Script' },
];

// Sample text for preview
const PREVIEW_TEXT = {
  chinese: '星空之下，每一顆流星都承載著一個願望。',
  english: 'Under the starry sky, every shooting star carries a wish.',
  mixed: 'Catch a shooting star 抓住流星',
  japanese: 'すべての流れ星には願いが込められている。',
};

type PreviewType = keyof typeof PREVIEW_TEXT;

const FontPreview: React.FC = () => {
  const [selectedFont, setSelectedFont] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<PreviewType>('mixed');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Filter fonts by category
  const filteredFonts = useMemo(() => {
    if (categoryFilter === 'all') return FONTS;
    return FONTS.filter(f => f.category === categoryFilter || f.category === 'system');
  }, [categoryFilter]);

  // Generate @font-face CSS
  const fontFaceCSS = FONTS
    .filter(f => f.file)
    .map(f => `
      @font-face {
        font-family: '${f.name}';
        src: url('/fonts/${encodeURIComponent(f.file!)}') format('${f.file?.endsWith('.otf') ? 'opentype' : 'truetype'}');
      }
    `)
    .join('\n');

  return (
    <div className="min-h-screen bg-black text-white p-8 pb-24">
      <style>{fontFaceCSS}</style>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl mb-2">Font Preview</h1>
        <p className="text-white/40 text-sm">
          {FONTS.length - 1} fonts loaded
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-8">
        {/* Category Filter */}
        <div className="flex gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                categoryFilter === cat.id
                  ? 'bg-white/20 text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="w-px h-8 bg-white/20" />

        {/* Preview Text Type */}
        <div className="flex gap-2">
          {(['chinese', 'english', 'japanese', 'mixed'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setPreviewType(type)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                previewType === type
                  ? 'border border-white/40 text-white'
                  : 'border border-white/10 text-white/50 hover:border-white/30'
              }`}
            >
              {type === 'chinese' ? '繁中' : type === 'english' ? 'EN' : type === 'japanese' ? '日' : 'Mix'}
            </button>
          ))}
        </div>
      </div>

      {/* Font List */}
      <div className="space-y-4">
        {filteredFonts.map((font, index) => (
          <div
            key={index}
            onClick={() => setSelectedFont(font.name)}
            className={`p-5 rounded-lg border cursor-pointer transition-all ${
              selectedFont === font.name
                ? 'border-white/60 bg-white/5'
                : 'border-white/10 hover:border-white/30'
            }`}
          >
            {/* Font info */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-3">
                <span className="text-white/80 text-sm font-medium">{font.name}</span>
                <span className="text-white/30 text-xs px-2 py-0.5 bg-white/5 rounded">
                  {font.category}
                </span>
              </div>
              {selectedFont === font.name && (
                <span className="text-green-400/70 text-xs">✓ selected</span>
              )}
            </div>

            {/* Preview text */}
            <p
              className="text-2xl leading-relaxed text-white/90"
              style={{
                fontFamily: font.file ? `'${font.name}', sans-serif` : 'system-ui, sans-serif',
              }}
            >
              {PREVIEW_TEXT[previewType]}
            </p>
          </div>
        ))}
      </div>

      {/* Selected font bottom bar */}
      {selectedFont && (
        <div className="fixed bottom-0 left-0 right-0 bg-black/95 border-t border-white/20 p-4">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <div>
              <span className="text-white/50 text-sm">Selected: </span>
              <span className="text-white font-medium">{selectedFont}</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedFont);
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded text-sm transition-colors"
              >
                Copy Name
              </button>
              <button
                onClick={() => setSelectedFont(null)}
                className="px-4 py-2 text-white/50 hover:text-white/70 text-sm transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

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

export default FontPreview;
