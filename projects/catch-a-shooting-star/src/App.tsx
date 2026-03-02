import { useState, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
import ModeSelector from './components/ModeSelector';
import StarCatcher from './core/StarCatcher';
import { loadGalleryConfig } from './utils/contentLoader';
import { useGuestbook } from './features/guestbook/useGuestbook';
import type { InteractionMode, StarCatcherConfig, ContentItem, DisplayMode } from './types';

// Lazy load font preview page
const FontPreview = lazy(() => import('./pages/FontPreview'));

// Font type definition
interface FontDef {
  name: string;
  file: string | null;
  lang: 'en' | 'zh' | 'ja' | 'system';
}

// English fonts with sizes (selected 11)
const ENGLISH_FONT_CONFIG = [
  { name: 'Courier', file: null, size: 18 },
  { name: 'Courier New', file: null, size: 18 },
  { name: 'Erika Ormig', file: 'Erika Ormig.ttf', size: 20 },
  { name: 'Erika PL DWS', file: 'Erika PL DWS wariant.otf', size: 26 },
  { name: 'Gabriele Light', file: 'gabriele-l.ttf', size: 20 },
  { name: 'Kingthings Typewriter', file: 'Kingthings_Trypewriter_2.ttf', size: 20 },
  { name: 'Nazi Typewriter', file: 'NaziTypewriterRegular.ttf', size: 20 },
  { name: 'Buadly Signature', file: 'BuadlySignature.ttf', size: 24 },
  { name: 'Wolgast Rand', file: 'WolgastRand.ttf', size: 32 },
  { name: 'Penna', file: 'penna.otf', size: 32 },
  { name: 'Tango', file: 'Tango.woff', size: 32 },
];

// For compatibility with existing code
const ENGLISH_FONTS: FontDef[] = ENGLISH_FONT_CONFIG.map(f => ({
  name: f.name,
  file: f.file,
  lang: f.file ? 'en' as const : 'system' as const,
}));

// Chinese fonts with sizes (selected 3) - 匯文明朝體 will be used as Chinese system UI font
const CHINESE_FONT_CONFIG = [
  { name: '匯文明朝體', file: '汇文明朝体.otf', size: 22 },  // also UI font
  { name: '京華老宋體', file: '京華老宋体2.0.ttf', size: 22 },
  { name: '中華薪火體', file: '中华薪火体.ttf', size: 24 },
];

const CHINESE_FONTS: FontDef[] = CHINESE_FONT_CONFIG.map(f => ({
  name: f.name,
  file: f.file,
  lang: 'zh' as const,
}));

// Japanese fonts
const JAPANESE_FONTS: FontDef[] = [
  { name: 'Hiragino Sans', file: null, lang: 'system' },
  { name: '市ヶ谷明朝', file: 'Ichigayamincho-9MAv0.ttf', lang: 'ja' },
  { name: 'Oradano 明朝', file: 'OradanoGSRR.ttf', lang: 'ja' },
];

// UI fonts with sizes (for rotation every 15 minutes)
interface UIFontConfig {
  name: string;
  file: string | null;
  size: number;
}

const UI_FONT_CONFIG: UIFontConfig[] = [
  { name: 'Brainrot', file: 'BrainrotTMRegular.ttf', size: 24 },  // Default
  { name: 'Courier', file: null, size: 14 },
  { name: 'Kingthings Typewriter', file: 'Kingthings_Trypewriter_2.ttf', size: 14 },
  { name: 'Buadly Signature', file: 'BuadlySignature.ttf', size: 20 },
  { name: 'Wolgast Rand', file: 'WolgastRand.ttf', size: 28 },
  { name: 'Penna', file: 'penna.otf', size: 24 },
];

// For font loading
const UI_FONTS: FontDef[] = UI_FONT_CONFIG.map(f => ({
  name: f.name,
  file: f.file,
  lang: 'en' as const,
}));

// Combined for loading
const ALL_FONTS: FontDef[] = [...ENGLISH_FONTS, ...CHINESE_FONTS, ...JAPANESE_FONTS, ...UI_FONTS];

// ============================================================
// CONFIGURATION
// ============================================================

const GALLERY_CONFIG_URL: string | null = null;

// Chinese text for testing Chinese fonts (longer paragraphs)
const CHINESE_ITEMS: ContentItem[] = [
  { id: 1, type: 'text', content: '星空之下，每一顆流星都承載著一個願望。在這漫漫長夜裡，我們仰望蒼穹，等待那一道劃破天際的光芒。也許是對遠方的思念，也許是對未來的期盼。', title: '願望' },
  { id: 2, type: 'text', content: '在漫長的黑夜裡，我們都是追逐星光的人。穿越時間的洪流，跨過命運的山河，只為在某個瞬間，與那顆屬於自己的星相遇。星光不問趕路人，歲月不負有心人。', title: '星光' },
  { id: 3, type: 'text', content: '抬頭仰望，繁星點點，彷彿訴說著古老的故事。每一顆星都是一段傳說，每一道光都是一次輪迴。在這無邊的宇宙裡，我們渺小如塵埃，卻依然懷抱著最璀璨的夢想。', title: '繁星' },
];

// English text for testing typewriter/script fonts (longer paragraphs)
const ENGLISH_ITEMS: ContentItem[] = [
  { id: 4, type: 'text', content: 'The stars are not what they seem. Behind each twinkling light lies a story untold, a mystery waiting to be unraveled. In the vast expanse of the cosmos, we search for meaning among the constellations.', title: 'Note' },
  { id: 5, type: 'text', content: 'Every shooting star carries a wish, burning bright across the midnight sky. They say if you catch one, your deepest desires will come true. But perhaps the magic lies not in the catching, but in the hoping itself.', title: 'Thought' },
  { id: 6, type: 'text', content: 'Catch a shooting star, make a wish upon its fleeting light. Let your dreams take flight on cosmic winds, dancing through nebulae and spiraling past distant galaxies. The universe is listening.', title: 'Wish' },
];

const DEMO_ITEMS: ContentItem[] = [...CHINESE_ITEMS, ...ENGLISH_ITEMS];

const CATCH_SOUND_URL = 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3';

// Dev mode: show font configuration controls
// Set to true when you need to adjust fonts, then set back to false
const DEV_MODE = false;

// ============================================================

const App: React.FC = () => {
  // Check for special pages (dev tools)
  // Access via: /fonts OR ?dev=fonts
  const [currentPage, _setCurrentPage] = useState(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    if (path.includes('/fonts') || params.get('dev') === 'fonts') return 'fonts';
    return 'main';
  });

  const [interactionMode, setInteractionMode] = useState<InteractionMode>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('single');

  // Guestbook: allows users to leave messages that become "stars" others catch
  const { onBeforeCatch, onInputSubmit } = useGuestbook({
    apiUrl: '/api/messages',
    placeholder: 'Let your words drift among the stars...',
    maxDailyMessages: 3,
    firstInputRange: [3, 7],  // Show first input after 3-7 catches
    nextInputRange: [5, 15],  // Show next inputs after 5-15 more catches
  });
  const [_items, setItems] = useState<ContentItem[]>(DEMO_ITEMS);
  const [isLoading, setIsLoading] = useState(!!GALLERY_CONFIG_URL);
  const [galleryTitle, setGalleryTitle] = useState<string | undefined>();
  const [selectedFont, setSelectedFont] = useState<string>('System Default');
  const [selectedUIFont, setSelectedUIFont] = useState<string>('Brainrot'); // Default UI font
  const [showFontSelector, setShowFontSelector] = useState(false);
  const [showUIFontSelector, setShowUIFontSelector] = useState(false);
  const [fontIndex, setFontIndex] = useState(0); // Current font index for keyboard nav
  const [uiFontIndex, setUIFontIndex] = useState(0); // UI font keyboard nav
  // Bookmarked fonts with their sizes: { fontName: fontSize }
  const [favoriteFonts, setFavoriteFonts] = useState<Map<string, number>>(new Map());
  // Bookmarked UI fonts with their sizes (for 15-minute rotation)
  const [favoriteUIFonts, setFavoriteUIFonts] = useState<Map<string, number>>(() => {
    // Default: All selected UI fonts for rotation
    return new Map([
      ['Brainrot', 24],
      ['Courier', 14],
      ['Kingthings Typewriter', 14],
      ['Buadly Signature', 20],
      ['Wolgast Rand', 28],
      ['Penna', 24],
    ]);
  });
  const [textMode, setTextMode] = useState<'mixed' | 'chinese' | 'english'>('mixed');
  const [fontOpacity, setFontOpacity] = useState(1);
  const [fontSize, setFontSize] = useState(18); // default 18px (text-lg)
  const [uiFontSize, setUIFontSize] = useState(24); // UI font size (matches Brainrot default)
  const [uiFontOpacity, setUIFontOpacity] = useState(1); // For fade transition
  const catchSoundRef = useRef<HTMLAudioElement | null>(null);
  const starCatcherRef = useRef<{ stackCards: () => void; setCurrentItem: (item: ContentItem | null) => void }>(null);

  // Generate font-face CSS for all fonts
  const fontFaceCSS = useMemo(() => {
    // Use base path from Vite config
    const basePath = '/';
    const getFormat = (file: string) => {
      if (file.endsWith('.otf')) return 'opentype';
      if (file.endsWith('.woff')) return 'woff';
      if (file.endsWith('.woff2')) return 'woff2';
      return 'truetype';
    };
    return ALL_FONTS
      .filter(f => f.file)
      .map(f => `
        @font-face {
          font-family: '${f.name}';
          src: url('${basePath}fonts/${encodeURIComponent(f.file!)}') format('${getFormat(f.file!)}');
          font-display: swap;
        }
      `)
      .join('\n');
  }, []);

  // Get fontFamily value for styling
  const fontFamily = useMemo(() => {
    if (selectedFont === 'System Default') return undefined;
    // For both system fonts and custom fonts, use the name directly
    return `'${selectedFont}', sans-serif`;
  }, [selectedFont]);

  // Get UI fontFamily value
  const uiFontFamily = useMemo(() => {
    if (selectedUIFont === 'System Default') return undefined;
    return `'${selectedUIFont}', sans-serif`;
  }, [selectedUIFont]);

  
  // Get items based on text mode
  const displayItems = useMemo(() => {
    switch (textMode) {
      case 'chinese': return CHINESE_ITEMS;
      case 'english': return ENGLISH_ITEMS;
      default: return DEMO_ITEMS;
    }
  }, [textMode]);

  // Load content
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const configUrl = urlParams.get('config') || GALLERY_CONFIG_URL;

    if (!configUrl) {
      setItems(DEMO_ITEMS);
      setIsLoading(false);
      return;
    }

    loadGalleryConfig(configUrl).then((config) => {
      setItems(config.items);
      setGalleryTitle(config.title);
      if (config.settings?.mode) {
        setDisplayMode(config.settings.mode);
      }
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    catchSoundRef.current = new Audio(CATCH_SOUND_URL);
    catchSoundRef.current.volume = 0.4;
  }, []);

  // Toggle favorite font (saves current fontSize)
  const toggleFavorite = (fontName: string) => {
    setFavoriteFonts(prev => {
      const next = new Map(prev);
      if (next.has(fontName)) {
        next.delete(fontName);
      } else {
        next.set(fontName, fontSize); // Save with current size
      }
      return next;
    });
  };

  // Update favorite font size
  const updateFavoriteSize = (fontName: string, size: number) => {
    setFavoriteFonts(prev => {
      const next = new Map(prev);
      if (next.has(fontName)) {
        next.set(fontName, size);
      }
      return next;
    });
  };

  // Toggle favorite UI font (saves current uiFontSize)
  const toggleUIFavorite = (fontName: string) => {
    setFavoriteUIFonts(prev => {
      const next = new Map(prev);
      if (next.has(fontName)) {
        next.delete(fontName);
      } else {
        next.set(fontName, uiFontSize);
      }
      return next;
    });
  };

  // Update UI favorite font size
  const updateUIFavoriteSize = (fontName: string, size: number) => {
    setFavoriteUIFonts(prev => {
      const next = new Map(prev);
      if (next.has(fontName)) {
        next.set(fontName, size);
      }
      return next;
    });
  };

  // Export UI favorites to console
  const exportUIFavorites = () => {
    const favorites = Array.from(favoriteUIFonts.entries()).map(([name, size]) => ({
      name,
      size
    }));
    console.log('=== Selected UI Fonts ===');
    console.log(JSON.stringify(favorites, null, 2));
    navigator.clipboard.writeText(JSON.stringify(favorites, null, 2));
    const summary = favorites.map(f => `${f.name}: ${f.size}px`).join('\n');
    alert(`已复制 ${favorites.length} 个UI字体到剪贴板！\n\n${summary}`);
  };

  // Export favorites to console
  const exportFavorites = () => {
    const favorites = Array.from(favoriteFonts.entries()).map(([name, size]) => ({
      name,
      size
    }));
    console.log('=== Selected Fonts ===');
    console.log(JSON.stringify(favorites, null, 2));
    // Also copy to clipboard
    navigator.clipboard.writeText(JSON.stringify(favorites, null, 2));
    const summary = favorites.map(f => `${f.name}: ${f.size}px`).join('\n');
    alert(`已复制 ${favorites.length} 个字体到剪贴板！\n\n${summary}`);
  };

  // Preload fonts using Font Loading API
  const [loadedFonts, setLoadedFonts] = useState<Set<string>>(new Set());

  // Current font list based on text mode
  const currentFontList = useMemo(() => {
    switch (textMode) {
      case 'chinese': return CHINESE_FONTS;
      case 'english': return ENGLISH_FONTS;
      default: return ENGLISH_FONTS; // Default to English for mixed
    }
  }, [textMode]);

  // Keyboard navigation for font selector
  useEffect(() => {
    if (!showFontSelector) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFontIndex(prev => Math.min(prev + 1, currentFontList.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFontIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const fontName = currentFontList[fontIndex].name;
        setSelectedFont(fontName);
        // Load saved size if bookmarked
        if (favoriteFonts.has(fontName)) {
          setFontSize(favoriteFonts.get(fontName)!);
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        // Toggle favorite with space
        toggleFavorite(currentFontList[fontIndex].name);
      } else if (e.key === 'Escape') {
        setShowFontSelector(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFontSelector, fontIndex, currentFontList, favoriteFonts]);

  useEffect(() => {
    const basePath = '/';
    const getFormat = (file: string) => {
      if (file.endsWith('.otf')) return 'opentype';
      if (file.endsWith('.woff')) return 'woff';
      if (file.endsWith('.woff2')) return 'woff2';
      return 'truetype';
    };

    // Load each font explicitly
    ALL_FONTS.filter(f => f.file).forEach(async (font) => {
      try {
        const format = getFormat(font.file!);
        const fontUrl = `${basePath}fonts/${encodeURIComponent(font.file!)}`;

        const fontFace = new FontFace(font.name, `url('${fontUrl}') format('${format}')`);
        const loadedFont = await fontFace.load();
        document.fonts.add(loadedFont);

        setLoadedFonts(prev => new Set([...prev, font.name]));
        console.log(`Font loaded: ${font.name}`);
      } catch (err) {
        console.error(`Failed to load font: ${font.name}`, err);
      }
    });
  }, []);

  // UI font list (combine English and Chinese for selection)
  const uiFontList = useMemo(() => {
    // Start with all content fonts + UI fonts
    const allUIFonts = [
      ...ENGLISH_FONT_CONFIG.map(f => ({ name: f.name, size: f.size })),
      ...CHINESE_FONT_CONFIG.map(f => ({ name: f.name, size: f.size })),
      ...UI_FONT_CONFIG,
    ];
    return allUIFonts;
  }, []);

  // Get bookmarked UI fonts for rotation
  const uiFontsForRotation = useMemo(() => {
    return Array.from(favoriteUIFonts.entries()).map(([name, size]) => ({ name, size }));
  }, [favoriteUIFonts]);

  // UI font auto-rotation timer (every 15 minutes)
  useEffect(() => {
    // Only rotate if there are multiple bookmarked UI fonts
    if (uiFontsForRotation.length <= 1) return;

    const ROTATION_INTERVAL = 15 * 60 * 1000; // 15 minutes

    const rotateFont = () => {
      // Fade out
      setUIFontOpacity(0);

      setTimeout(() => {
        // Pick a random font different from current
        let nextFont = uiFontsForRotation[Math.floor(Math.random() * uiFontsForRotation.length)];
        while (nextFont.name === selectedUIFont && uiFontsForRotation.length > 1) {
          nextFont = uiFontsForRotation[Math.floor(Math.random() * uiFontsForRotation.length)];
        }

        setSelectedUIFont(nextFont.name);
        setUIFontSize(nextFont.size);

        // Fade in
        setTimeout(() => {
          setUIFontOpacity(1);
        }, 100);
      }, 500); // Fade out duration
    };

    const timer = setInterval(rotateFont, ROTATION_INTERVAL);
    return () => clearInterval(timer);
  }, [uiFontsForRotation, selectedUIFont]);

  // Keyboard navigation for UI font selector
  useEffect(() => {
    if (!showUIFontSelector) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setUIFontIndex(prev => Math.min(prev + 1, uiFontList.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setUIFontIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const font = uiFontList[uiFontIndex];
        setSelectedUIFont(font.name);
        setUIFontSize(font.size);
        // Load saved size if bookmarked
        if (favoriteUIFonts.has(font.name)) {
          setUIFontSize(favoriteUIFonts.get(font.name)!);
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        toggleUIFavorite(uiFontList[uiFontIndex].name);
      } else if (e.key === 'Escape') {
        setShowUIFontSelector(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showUIFontSelector, uiFontIndex, uiFontList, favoriteUIFonts]);

  const playCatchSound = () => {
    if (catchSoundRef.current) {
      catchSoundRef.current.currentTime = 0;
      catchSoundRef.current.play().catch(() => {});
    }
  };

  const config: StarCatcherConfig = useMemo(() => ({
    mode: displayMode,
    items: displayItems,
    stars: {
      maxConcurrent: displayMode === 'gallery' ? 2 : 1,
      intervalRange: [6000, 12000] as [number, number],
      speedRange: [1.5, 2.5] as [number, number],
    },
    keyboard: {
      scheme: displayMode === 'gallery' ? 'directional' : 'space',
    },
    style: {
      cardSize: 'medium',
      floatingCards: false,
      transitionDuration: 1200,
      fontFamily: fontFamily,
      fontOpacity: fontOpacity,
      fontSize: fontSize,
      uiFontFamily: uiFontFamily || "'Brainrot', sans-serif",
      uiFontSize: uiFontSize,
      uiFontOpacity: uiFontOpacity,
    },
    onCatch: () => {
      playCatchSound();
    },
  }), [displayMode, displayItems, fontFamily, fontOpacity, fontSize, uiFontFamily, uiFontSize, uiFontOpacity]);

  // Font preview page
  if (currentPage === 'fonts') {
    return (
      <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
        <FontPreview />
      </Suspense>
    );
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white/40 text-sm tracking-widest">loading...</div>
      </div>
    );
  }

  if (!interactionMode) {
    return <ModeSelector onSelect={setInteractionMode} />;
  }

  return (
    <div className="relative" style={{ fontFamily: uiFontFamily }}>
      {/* Font-face styles */}
      <style>{fontFaceCSS}</style>

      <StarCatcher
        ref={starCatcherRef}
        config={config}
        interactionMode={interactionMode}
        onBeforeCatch={onBeforeCatch}
        onInputSubmit={onInputSubmit}
        canReply={true}
      />

      {galleryTitle && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 text-white/50 text-sm tracking-widest uppercase">
          {galleryTitle}
        </div>
      )}

      {/* Minimal back arrow - very subtle, visible on hover */}
      <button
        onClick={() => setInteractionMode(null)}
        className="fixed top-6 left-6 z-50 text-white/15 hover:text-white/50 transition-all duration-300 text-2xl"
        title="Back"
      >
        ←
      </button>

      {/* Text Mode & Style Controls (Dev Tool) */}
      {DEV_MODE && (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-4">
        {/* UI Font size slider */}
        <div className="flex items-center gap-2 border-r border-white/10 pr-4">
          <span className="text-white/40 text-xs">UI</span>
          <input
            type="range"
            min="12"
            max="32"
            step="2"
            value={uiFontSize}
            onChange={(e) => {
              const newSize = parseInt(e.target.value);
              setUIFontSize(newSize);
              // Auto-update bookmarked UI font's size
              if (favoriteUIFonts.has(selectedUIFont)) {
                updateUIFavoriteSize(selectedUIFont, newSize);
              }
            }}
            className="w-12 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-400/60"
          />
          <span className="text-white/40 text-xs w-8">{uiFontSize}px</span>
          {favoriteUIFonts.has(selectedUIFont) && (
            <span className="text-blue-400 text-xs">★</span>
          )}
        </div>

        {/* Content Font size slider */}
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs">Text</span>
          <input
            type="range"
            min="12"
            max="48"
            step="2"
            value={fontSize}
            onChange={(e) => {
              const newSize = parseInt(e.target.value);
              setFontSize(newSize);
              // Auto-update bookmarked font's size
              if (favoriteFonts.has(selectedFont)) {
                updateFavoriteSize(selectedFont, newSize);
              }
            }}
            className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white/60"
          />
          <span className="text-white/40 text-xs w-8">{fontSize}px</span>
          {/* Indicator if current font is bookmarked */}
          {favoriteFonts.has(selectedFont) && (
            <span className="text-yellow-400 text-xs">★</span>
          )}
        </div>

        {/* Opacity slider */}
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-xs">opacity</span>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={fontOpacity}
            onChange={(e) => setFontOpacity(parseFloat(e.target.value))}
            className="w-16 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white/60"
          />
          <span className="text-white/40 text-xs w-8">{Math.round(fontOpacity * 100)}%</span>
        </div>

        {/* Text mode toggle */}
        <div className="flex border border-white/20 rounded overflow-hidden">
          {(['chinese', 'english', 'mixed'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setTextMode(mode)}
              className={`px-2 py-1 text-xs transition-colors ${
                textMode === mode
                  ? 'bg-white/20 text-white'
                  : 'text-white/40 hover:bg-white/10'
              }`}
            >
              {mode === 'chinese' ? '中' : mode === 'english' ? 'EN' : 'Mix'}
            </button>
          ))}
        </div>

        {/* Font loading indicator */}
        <span className="text-white/30 text-xs">
          {loadedFonts.size}/{currentFontList.length - 1} fonts
        </span>
      </div>
      )}

      {/* Font Selectors (Dev Tool) */}
      {DEV_MODE && (
      <div className="fixed bottom-14 right-6 z-50 flex gap-3">
        {/* UI Font Selector */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUIFontSelector(!showUIFontSelector);
              setShowFontSelector(false);
            }}
            className="text-white/40 hover:text-white/70 text-xs tracking-widest uppercase transition-colors border border-blue-500/30 px-3 py-1 rounded hover:border-blue-400/50"
          >
            UI: {selectedUIFont === 'System Default' ? 'default' : selectedUIFont}
            {favoriteUIFonts.size > 1 && (
              <span className="ml-1 text-blue-400/70">({favoriteUIFonts.size})</span>
            )}
          </button>

          {showUIFontSelector && (
            <div className="absolute bottom-full right-0 mb-2 bg-black/95 border border-white/20 rounded-lg p-2 max-h-96 overflow-y-auto w-72">
              <div className="text-white/30 text-xs mb-2 px-2 flex justify-between items-center">
                <span>↑↓ navigate • Enter preview • Space bookmark</span>
              </div>
              {favoriteUIFonts.size > 0 && (
                <button
                  onClick={exportUIFavorites}
                  className="w-full text-left px-3 py-2 mb-2 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"
                >
                  Export {favoriteUIFonts.size} UI fonts (15min rotation)
                </button>
              )}
              {uiFontList.map((font, index) => (
                <div
                  key={font.name}
                  ref={index === uiFontIndex ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                  className={`flex items-center gap-2 px-2 py-2 rounded transition-colors cursor-pointer ${
                    index === uiFontIndex
                      ? 'bg-blue-500/30'
                      : selectedUIFont === font.name
                        ? 'bg-white/15'
                        : 'hover:bg-white/10'
                  }`}
                  onClick={() => {
                    setSelectedUIFont(font.name);
                    setUIFontIndex(index);
                    setUIFontSize(font.size);
                    // Load saved size if bookmarked
                    if (favoriteUIFonts.has(font.name)) {
                      setUIFontSize(favoriteUIFonts.get(font.name)!);
                    }
                  }}
                  onMouseEnter={() => setUIFontIndex(index)}
                >
                  {/* Bookmark checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleUIFavorite(font.name);
                    }}
                    className={`w-5 h-5 rounded border flex items-center justify-center text-xs transition-colors flex-shrink-0 ${
                      favoriteUIFonts.has(font.name)
                        ? 'bg-blue-500/80 border-blue-400 text-white'
                        : 'border-white/30 text-white/30 hover:border-white/50'
                    }`}
                  >
                    {favoriteUIFonts.has(font.name) ? '★' : ''}
                  </button>
                  {/* Font name */}
                  <span
                    className={`flex-1 text-sm truncate ${
                      selectedUIFont === font.name ? 'text-white' : 'text-white/70'
                    }`}
                    style={{
                      fontFamily: `'${font.name}', sans-serif`,
                    }}
                  >
                    {font.name}
                  </span>
                  {/* Saved size for bookmarked fonts */}
                  {favoriteUIFonts.has(font.name) && (
                    <span className="text-blue-400/70 text-xs flex-shrink-0">
                      {favoriteUIFonts.get(font.name)}px
                    </span>
                  )}
                  {/* Current preview indicator */}
                  {selectedUIFont === font.name && (
                    <span className="text-blue-400 text-xs flex-shrink-0">●</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Content Font Selector */}
        <div className="relative">
          <button
            onClick={() => {
              setShowFontSelector(!showFontSelector);
              setShowUIFontSelector(false);
            }}
            className="text-white/40 hover:text-white/70 text-xs tracking-widest uppercase transition-colors border border-white/20 px-3 py-1 rounded hover:border-white/40"
          >
            Text: {selectedFont === 'System Default' ? 'default' : selectedFont}
          </button>

          {showFontSelector && (
            <div className="absolute bottom-full right-0 mb-2 bg-black/95 border border-white/20 rounded-lg p-2 max-h-96 overflow-y-auto w-72">
              <div className="text-white/30 text-xs mb-2 px-2 flex justify-between items-center">
                <span>↑↓ navigate • Enter preview • Space bookmark</span>
              </div>
              {favoriteFonts.size > 0 && (
                <button
                  onClick={exportFavorites}
                  className="w-full text-left px-3 py-2 mb-2 text-xs bg-green-500/20 text-green-400 rounded hover:bg-green-500/30"
                >
                  Export {favoriteFonts.size} bookmarked fonts
                </button>
              )}
              {currentFontList.map((font, index) => (
                <div
                  key={font.name}
                  ref={index === fontIndex ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                  className={`flex items-center gap-2 px-2 py-2 rounded transition-colors cursor-pointer ${
                    index === fontIndex
                      ? 'bg-white/30'
                      : selectedFont === font.name
                        ? 'bg-white/15'
                        : 'hover:bg-white/10'
                  }`}
                  onClick={() => {
                    setSelectedFont(font.name);
                    setFontIndex(index);
                    // Load saved size if bookmarked
                    if (favoriteFonts.has(font.name)) {
                      setFontSize(favoriteFonts.get(font.name)!);
                    }
                  }}
                  onMouseEnter={() => setFontIndex(index)}
                >
                  {/* Bookmark checkbox */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(font.name);
                    }}
                    className={`w-5 h-5 rounded border flex items-center justify-center text-xs transition-colors flex-shrink-0 ${
                      favoriteFonts.has(font.name)
                        ? 'bg-yellow-500/80 border-yellow-400 text-black'
                        : 'border-white/30 text-white/30 hover:border-white/50'
                    }`}
                  >
                    {favoriteFonts.has(font.name) ? '★' : ''}
                  </button>
                  {/* Font name */}
                  <span
                    className={`flex-1 text-sm truncate ${
                      selectedFont === font.name ? 'text-white' : 'text-white/70'
                    }`}
                    style={{
                      fontFamily: font.name === 'System Default' ? 'system-ui' : `'${font.name}', sans-serif`,
                    }}
                  >
                    {font.name}
                  </span>
                  {/* Saved size for bookmarked fonts */}
                  {favoriteFonts.has(font.name) && (
                    <span className="text-yellow-400/70 text-xs flex-shrink-0">
                      {favoriteFonts.get(font.name)}px
                    </span>
                  )}
                  {/* Current preview indicator */}
                  {selectedFont === font.name && (
                    <span className="text-green-400 text-xs flex-shrink-0">●</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};

export default App;
