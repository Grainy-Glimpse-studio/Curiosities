import { useState, useCallback, useMemo, useImperativeHandle, forwardRef, useRef } from 'react';
import Starfield from './Starfield';
import ShootingStar from './ShootingStar';
import HandTracker from './HandTracker';
import FaceTracker from './FaceTracker';
import HolisticTracker from './HolisticTracker';
import SingleView from '../modes/SingleView';
import GalleryView from '../modes/GalleryView';
import FlashlightCursor from '../components/FlashlightCursor';
import type { StarCatcherConfig, ContentItem, InteractionMode } from '../types';

// Font configs for random selection
interface FontConfig {
  name: string;
  file: string | null;
  size: number;
}

// Default font configs (can be overridden via config)
const ENGLISH_FONT_CONFIG: FontConfig[] = [
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

const CHINESE_FONT_CONFIG: FontConfig[] = [
  { name: '匯文明朝體', file: '汇文明朝体.otf', size: 22 },
  { name: '京華老宋體', file: '京華老宋体2.0.ttf', size: 22 },
  { name: '中華薪火體', file: '中华薪火体.ttf', size: 24 },
];

// Helper to detect if text is Chinese
const isChinese = (text: string) => /[\u4e00-\u9fa5]/.test(text);

// Get random font config based on text content
const getRandomFontForText = (text: string): FontConfig => {
  const config = isChinese(text) ? CHINESE_FONT_CONFIG : ENGLISH_FONT_CONFIG;
  return config[Math.floor(Math.random() * config.length)];
};

// Simple translation map for demo (will be replaced by DeepL API)
const DEMO_TRANSLATIONS: Record<string, string> = {
  // Chinese -> English
  '星空之下，每一顆流星都承載著一個願望。在這漫漫長夜裡，我們仰望蒼穹，等待那一道劃破天際的光芒。也許是對遠方的思念，也許是對未來的期盼。':
    'Under the starry sky, every shooting star carries a wish. In this long night, we gaze at the heavens, waiting for that streak of light across the sky. Perhaps it is longing for the distance, perhaps hope for the future.',
  '在漫長的黑夜裡，我們都是追逐星光的人。穿越時間的洪流，跨過命運的山河，只為在某個瞬間，與那顆屬於自己的星相遇。星光不問趕路人，歲月不負有心人。':
    'In the long night, we are all chasers of starlight. Crossing the currents of time, traversing the mountains and rivers of fate, just to meet that star of our own in a certain moment.',
  '抬頭仰望，繁星點點，彷彿訴說著古老的故事。每一顆星都是一段傳說，每一道光都是一次輪迴。在這無邊的宇宙裡，我們渺小如塵埃，卻依然懷抱著最璀璨的夢想。':
    'Looking up, the stars twinkle as if telling ancient stories. Each star is a legend, each ray of light a cycle of rebirth. In this boundless universe, we are as small as dust, yet still hold the brightest dreams.',
  // English -> Chinese
  'The stars are not what they seem. Behind each twinkling light lies a story untold, a mystery waiting to be unraveled. In the vast expanse of the cosmos, we search for meaning among the constellations.':
    '星星并非表面所见。每一道闪烁的光芒背后，都隐藏着一个未曾诉说的故事，一个等待被揭开的谜团。在浩瀚的宇宙中，我们在星座间寻找意义。',
  'Every shooting star carries a wish, burning bright across the midnight sky. They say if you catch one, your deepest desires will come true. But perhaps the magic lies not in the catching, but in the hoping itself.':
    '每一颗流星都承载着一个愿望，在午夜的天空中燃烧。人们说，如果你抓住一颗，你最深的愿望就会实现。但也许魔力不在于抓住，而在于希望本身。',
  'Catch a shooting star, make a wish upon its fleeting light. Let your dreams take flight on cosmic winds, dancing through nebulae and spiraling past distant galaxies. The universe is listening.':
    '抓住一颗流星，在它转瞬即逝的光芒上许下愿望。让你的梦想乘着宇宙之风飞翔，穿过星云，盘旋过遥远的星系。宇宙在倾听。',
};

interface StarCatcherProps {
  config: StarCatcherConfig;
  interactionMode: InteractionMode;
  // Optional: inject a custom item instead of picking from items array
  // Return null to use default behavior, or return a ContentItem to display that instead
  onBeforeCatch?: () => ContentItem | null;
  // Optional: handle input submission (for custom input items)
  onInputSubmit?: (content: string) => void;
  // Whether users can reply to content (counts towards daily limit)
  canReply?: boolean;
}

export interface StarCatcherRef {
  stackCards: () => void;
  // Allow parent to set current item directly
  setCurrentItem: (item: ContentItem | null) => void;
}

// Quote character limit for replies (must match SingleView)
const QUOTE_MAX_LENGTH = 80;

const StarCatcher = forwardRef<StarCatcherRef, StarCatcherProps>(({
  config,
  interactionMode,
  onBeforeCatch,
  onInputSubmit,
  canReply = false,
}, ref) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentItem, setCurrentItem] = useState<ContentItem | null>(null);
  const [galleryItems, setGalleryItems] = useState<ContentItem[]>([]);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [grabPosition, setGrabPosition] = useState<{ x: number; y: number } | undefined>();
  const [grabPositions, setGrabPositions] = useState<{ x: number; y: number }[]>([]);
  const [isPaused, setIsPaused] = useState(false); // Pause star generation while content is showing
  const [isBlowingAway, setIsBlowingAway] = useState(false); // Blow away animation in progress
  const [isFlipped, setIsFlipped] = useState(false); // Translation flip state
  const [palmPosition, setPalmPosition] = useState<{ x: number; y: number } | null>(null); // Palm position for glow
  const galleryViewRef = useRef<{ stackCards: () => void }>(null);

  // Content protection: pause stars based on content type
  // - Text (short < 30 chars): random 100-500ms
  // - Text (long): random 500-1500ms
  // - Image: fixed 500ms
  // - Gallery mode: no protection (handled separately)
  const getProtectionTime = (item: ContentItem) => {
    if (item.type === 'image') {
      return 500; // Fixed 500ms for images
    }
    if (item.type === 'text' && item.content) {
      if (item.content.length < 30) {
        // Short text: small random delay (100-500ms)
        return 100 + Math.random() * 400;
      }
      // Longer text: random between 500-1500ms
      return 500 + Math.random() * 1000;
    }
    // Input or other types: no protection
    return 0;
  };

  const {
    mode,
    items,
    stars,
    keyboard,
    style,
    onCatch,
    onItemClick,
    onItemDoubleClick,
  } = config;

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    stackCards: () => {
      galleryViewRef.current?.stackCards();
    },
    setCurrentItem: (item: ContentItem | null) => {
      setCurrentItem(item);
    },
  }));

  // Handle catching a star
  const handleCatch = useCallback(() => {
    // Check if parent wants to inject a custom item
    const injectedItem = onBeforeCatch?.();
    if (injectedItem) {
      // Assign random font for text items from guestbook
      let itemToShow = injectedItem;
      if (injectedItem.type === 'text' && injectedItem.content) {
        const fontConfig = getRandomFontForText(injectedItem.content);
        itemToShow = {
          ...injectedItem,
          _fontFamily: `'${fontConfig.name}', sans-serif`,
          _fontSize: fontConfig.size,
        };
      }
      if (mode === 'single') {
        setCurrentItem(itemToShow);
        // Pause stars during content protection time
        const protectionTime = getProtectionTime(itemToShow);
        if (protectionTime > 0) {
          setIsPaused(true);
          setTimeout(() => setIsPaused(false), protectionTime);
        }
      }
      return;
    }

    // Normal content catch
    if (items.length === 0) return;

    const baseItem = items[currentIndex % items.length];
    setCurrentIndex(prev => prev + 1);

    // Assign random font for text items, preserve existing translation (no fallback - respect quotesLoader's decision)
    let nextItem = { ...baseItem };
    if (baseItem.type === 'text' && baseItem.content) {
      const fontConfig = getRandomFontForText(baseItem.content);
      nextItem = {
        ...baseItem,
        _fontFamily: `'${fontConfig.name}', sans-serif`,
        _fontSize: fontConfig.size,
        // Preserve original translation from quotesLoader - if null/undefined, no translation needed
        _translation: baseItem._translation,
      };
    }

    if (mode === 'single') {
      setCurrentItem(nextItem);
      // Pause stars during content protection time
      const protectionTime = getProtectionTime(nextItem);
      if (protectionTime > 0) {
        setIsPaused(true);
        setTimeout(() => setIsPaused(false), protectionTime);
      }
    } else {
      // Gallery mode: no protection
      setGalleryItems(prev => [...prev, { ...nextItem, id: `${nextItem.id}-${Date.now()}` }]);
    }

    onCatch?.(nextItem);
  }, [items, currentIndex, mode, onCatch, onBeforeCatch]);

  // Handle input submit (pass to parent)
  // If there's quoted content, format it as markdown quote
  const handleInputSubmit = useCallback((content: string) => {
    const quotedContent = currentItem?.quotedContent;
    let finalContent = content;

    if (quotedContent) {
      // Truncate quote if too long
      const truncatedQuote = quotedContent.length > QUOTE_MAX_LENGTH
        ? quotedContent.slice(0, QUOTE_MAX_LENGTH).trim() + '...'
        : quotedContent;
      // Format as markdown quote
      finalContent = `> ${truncatedQuote}\n\n${content}`;
    }

    setCurrentItem(null);
    onInputSubmit?.(finalContent);
  }, [onInputSubmit, currentItem?.quotedContent]);

  // Handle reply to content - show input with quoted content
  const handleReply = useCallback((item: ContentItem) => {
    if (!item.content) return;

    const inputItem: ContentItem = {
      id: `reply-${Date.now()}`,
      type: 'input',
      quotedContent: item.content,
      placeholder: 'your reply...',
    };

    setCurrentItem(inputItem);
  }, []);

  // Handle closing a gallery item
  const handleCloseGalleryItem = useCallback((item: ContentItem) => {
    setGalleryItems(prev => prev.filter(i => i.id !== item.id));
  }, []);

  // Handle grab change from hand tracker (supports multiple hands)
  const handleGrabChange = useCallback((grabbing: boolean, positions: { x: number; y: number }[]) => {
    setIsGrabbing(grabbing);
    setGrabPosition(positions[0]); // Use first grabbing hand for now
    setGrabPositions(positions); // Store all positions
  }, []);

  // Handle blow to dismiss current content with animation
  const handleBlow = useCallback(() => {
    if (currentItem && !isBlowingAway) {
      console.log('💨 Blow detected! Starting blow away animation...');
      setIsBlowingAway(true);
    }
  }, [currentItem, isBlowingAway]);

  // Handle blow away animation complete
  const handleBlowAwayComplete = useCallback(() => {
    setIsBlowingAway(false);
    setCurrentItem(null);
    setIsFlipped(false);
  }, []);

  // Handle palm move for glow effect (gesture mode)
  const handlePalmMove = useCallback((position: { x: number; y: number } | null, isOpen: boolean) => {
    if (isOpen && position) {
      setPalmPosition(position);
    } else {
      setPalmPosition(null);
    }
  }, []);

  // Handle mouse move for glow effect (keyboard mode)
  const handleMouseMove = useCallback((position: { x: number; y: number } | null) => {
    setPalmPosition(position);
  }, []);

  // Handle swipe gesture to trigger translation flip (up = to back, down = to front)
  const handleSwipeGesture = useCallback((direction: 'up' | 'down') => {
    console.log('👋 handleSwipeGesture called:', { direction, hasItem: !!currentItem, isBlowingAway, isFlipped });
    if (currentItem && !isBlowingAway) {
      const shouldFlipToBack = direction === 'up';
      // Only flip if we're going in the right direction
      if (shouldFlipToBack && !isFlipped) {
        console.log('👋 Swipe UP - flipping to back');
        setIsFlipped(true);
      } else if (!shouldFlipToBack && isFlipped) {
        console.log('👋 Swipe DOWN - flipping to front');
        setIsFlipped(false);
      } else {
        console.log('👋 No flip needed:', { shouldFlipToBack, isFlipped });
      }
    } else {
      console.log('👋 Cannot flip:', { hasItem: !!currentItem, isBlowingAway });
    }
  }, [currentItem, isBlowingAway, isFlipped]);

  // Reset flip state when item changes
  const handleItemChange = useCallback((item: ContentItem | null) => {
    setCurrentItem(item);
    setIsFlipped(false);
  }, []);

  // Determine keyboard scheme based on mode and config
  const keyboardScheme = useMemo(() => {
    if (interactionMode === 'gesture') return 'space';
    if (mode === 'gallery' && (stars?.maxConcurrent ?? 1) > 1) {
      return keyboard?.scheme ?? 'directional';
    }
    return keyboard?.scheme ?? 'space';
  }, [interactionMode, mode, stars?.maxConcurrent, keyboard?.scheme]);

  // Max concurrent stars
  const maxConcurrent = useMemo(() => {
    if (interactionMode === 'keyboard' && keyboardScheme === 'space') {
      return 1; // Single star for simple space mode
    }
    return stars?.maxConcurrent ?? 1;
  }, [interactionMode, keyboardScheme, stars?.maxConcurrent]);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Starfield Background */}
      <Starfield />

      {/* Shooting Stars */}
      <ShootingStar
        onCatch={handleCatch}
        mode={interactionMode}
        keyboardScheme={keyboardScheme}
        isGrabbing={isGrabbing}
        grabPosition={grabPosition}
        grabPositions={grabPositions}
        maxConcurrent={maxConcurrent}
        intervalRange={stars?.intervalRange}
        speedRange={stars?.speedRange}
        isPaused={isPaused}
        uiFontFamily={style?.uiFontFamily}
        uiFontSize={style?.uiFontSize}
        uiFontOpacity={style?.uiFontOpacity}
      />

      {/* Flashlight cursor (keyboard mode) */}
      {interactionMode === 'keyboard' && (
        <FlashlightCursor onMouseMove={handleMouseMove} />
      )}

      {/* Holistic Tracker - combined hand + face (gesture mode only) */}
      {interactionMode === 'gesture' && (
        <HolisticTracker
          onGrabChange={handleGrabChange}
          onPalmMove={handlePalmMove}
          onSwipeGesture={handleSwipeGesture}
          onBlow={handleBlow}
          blowDuration={600}
          blowEnabled={currentItem !== null}
        />
      )}

      {/* Content Display */}
      {mode === 'single' ? (
        <SingleView
          item={currentItem}
          transitionDuration={style?.transitionDuration}
          fontFamily={style?.fontFamily}
          fontOpacity={style?.fontOpacity}
          fontSize={style?.fontSize}
          canReply={canReply}
          blowAway={isBlowingAway}
          isFlipped={isFlipped}
          onFlip={() => setIsFlipped(prev => !prev)}
          palmPosition={palmPosition}
          onItemClick={onItemClick}
          onItemDoubleClick={onItemDoubleClick}
          onInputSubmit={handleInputSubmit}
          onReply={handleReply}
          onClose={() => handleItemChange(null)}
          onBlowAwayComplete={handleBlowAwayComplete}
        />
      ) : (
        <GalleryView
          ref={galleryViewRef}
          items={galleryItems}
          floatingCards={style?.floatingCards}
          cardSize={style?.cardSize}
          transitionDuration={style?.transitionDuration}
          onItemClick={onItemClick}
          onItemDoubleClick={onItemDoubleClick}
          onItemClose={handleCloseGalleryItem}
        />
      )}
    </div>
  );
});

StarCatcher.displayName = 'StarCatcher';

export default StarCatcher;
