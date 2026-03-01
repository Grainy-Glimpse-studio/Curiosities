import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FloatingWord {
  id: string;
  text: string;
  x: number;
  y: number;
  isFinal: boolean;
  isPinned: boolean;
  createdAt: number;
  pinnedAt?: number; // 固定的时间
  maxWidth: number; // 随机宽度
  displayDuration: number; // 显示时长（毫秒）
  isVertical: boolean; // 是否竖排（中文）
}

// 检测文本是否主要是中文
const isMostlyChinese = (text: string): boolean => {
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
  return chineseChars.length > text.length * 0.3; // 超过30%是中文字符
};

interface RecorderBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FloatingWordsProps {
  isRecording: boolean;
  onPinWord: (text: string) => void;
  recorderBounds: RecorderBounds | null;
  fontFamily?: string;
}

// 检查新位置是否与现有位置重叠
const checkOverlap = (
  x: number,
  y: number,
  existingWords: FloatingWord[],
  minDistance: number = 100
): boolean => {
  for (const word of existingWords) {
    const dx = x - word.x;
    const dy = y - word.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < minDistance) {
      return true;
    }
  }
  return false;
};

// 定义安全区域（避开录音机位置）
type SafeZone = { xMin: number; xMax: number; yMin: number; yMax: number };

const getSafeZones = (recorderBounds: RecorderBounds | null): SafeZone[] => {
  const w = window.innerWidth;
  const h = window.innerHeight;

  // 边距设置
  const edgePadding = 20;
  const topEdge = 100;
  const bottomEdge = h - 80;

  // 如果没有录音机位置信息，使用屏幕两侧
  if (!recorderBounds) {
    console.log('No recorder bounds, using fallback zones');
    return [
      { xMin: edgePadding, xMax: 250, yMin: topEdge, yMax: bottomEdge },
      { xMin: w - 300, xMax: w - edgePadding, yMin: topEdge, yMax: bottomEdge },
    ];
  }

  // 录音机边界（加上 padding）
  const padding = 50;
  const recLeft = recorderBounds.x - padding;
  const recRight = recorderBounds.x + recorderBounds.width + padding;
  const recTop = recorderBounds.y - padding;
  const recBottom = recorderBounds.y + recorderBounds.height + padding;

  console.log('Recorder bounds:', recorderBounds, 'Window:', w, h);

  const zones: SafeZone[] = [];

  // 左边区域：从屏幕左边到录音机左边
  if (recLeft > edgePadding + 100) {
    zones.push({
      xMin: edgePadding,
      xMax: recLeft - 20,
      yMin: topEdge,
      yMax: bottomEdge
    });
  }

  // 右边区域：从录音机右边到屏幕右边
  if (w - recRight > 100) {
    zones.push({
      xMin: recRight + 20,
      xMax: w - edgePadding,
      yMin: topEdge,
      yMax: bottomEdge
    });
  }

  // 上方区域
  if (recTop > topEdge + 80) {
    zones.push({
      xMin: edgePadding,
      xMax: w - edgePadding,
      yMin: topEdge,
      yMax: recTop - 20
    });
  }

  // 下方区域
  if (bottomEdge - recBottom > 80) {
    zones.push({
      xMin: edgePadding,
      xMax: w - edgePadding,
      yMin: recBottom + 20,
      yMax: bottomEdge
    });
  }

  console.log('Safe zones:', zones);

  // 如果没有有效区域，使用 fallback
  if (zones.length === 0) {
    console.log('No zones found, using fallback');
    return [
      { xMin: edgePadding, xMax: 200, yMin: topEdge, yMax: bottomEdge },
    ];
  }

  return zones;
};

// 生成不重叠的随机位置（只在安全区域内）
const generatePosition = (
  existingWords: FloatingWord[],
  recorderBounds: RecorderBounds | null,
  maxAttempts: number = 30
): { x: number; y: number } => {
  const safeZones = getSafeZones(recorderBounds);

  for (let i = 0; i < maxAttempts; i++) {
    // 随机选择一个安全区域
    const zone = safeZones[Math.floor(Math.random() * safeZones.length)];

    const x = zone.xMin + Math.random() * (zone.xMax - zone.xMin);
    const y = zone.yMin + Math.random() * (zone.yMax - zone.yMin);

    // 检查是否与其他词重叠，距离设大一点避免重叠
    if (!checkOverlap(x, y, existingWords, 150)) {
      return { x, y };
    }
  }

  // 如果找不到好位置，随机放在一个安全区域
  const zone = safeZones[Math.floor(Math.random() * safeZones.length)];
  return {
    x: zone.xMin + Math.random() * (zone.xMax - zone.xMin),
    y: zone.yMin + Math.random() * (zone.yMax - zone.yMin)
  };
};

const FloatingWords: React.FC<FloatingWordsProps> = ({ isRecording, onPinWord, recorderBounds, fontFamily = "'Consulate', monospace" }) => {
  const [words, setWords] = useState<FloatingWord[]>([]);
  const recorderBoundsRef = useRef<RecorderBounds | null>(null);

  // 保持最新的 recorderBounds
  useEffect(() => {
    recorderBoundsRef.current = recorderBounds;
  }, [recorderBounds]);

  // 添加新词
  const addWord = useCallback((text: string, isFinal: boolean) => {
    if (!text.trim()) return;

    setWords((prev: FloatingWord[]) => {
      const position = generatePosition(prev, recorderBoundsRef.current);
      const textLength = text.trim().length;

      // 随机宽度：短文本宽一些，长文本窄一些，加上随机变化
      const baseWidth = textLength < 15 ? 320 : textLength < 30 ? 280 : 240;
      const randomOffset = Math.random() * 80 - 40; // -40 到 +40
      const maxWidth = Math.max(200, Math.min(400, baseWidth + randomOffset));

      // 显示时长：4-6秒，给足显影和停留时间
      const displayDuration = Math.min(6000, 4000 + textLength * 50);

      const trimmedText = text.trim();
      const isVertical = isMostlyChinese(trimmedText);

      const newWord: FloatingWord = {
        id: `${Date.now()}-${Math.random()}`,
        text: trimmedText,
        x: position.x,
        y: position.y,
        isFinal,
        isPinned: false,
        createdAt: Date.now(),
        maxWidth,
        displayDuration,
        isVertical,
      };

      // 限制最多显示5个词
      const updated = [...prev, newWord];
      if (updated.length > 5) {
        return updated.slice(-5);
      }
      return updated;
    });
  }, []);

  // 固定词（标记为已选择，但仍会消失）
  const pinWord = useCallback((wordId: string) => {
    // 先找到词并保存
    const wordToPin = words.find(w => w.id === wordId);
    if (wordToPin && !wordToPin.isPinned) {
      // 立即调用回调保存词
      onPinWord(wordToPin.text);
      console.log('Pinned word saved:', wordToPin.text);

      // 更新状态
      setWords(prev => prev.map(w =>
        w.id === wordId ? { ...w, isPinned: true, pinnedAt: Date.now() } : w
      ));
    }
  }, [words, onPinWord]);

  // 自动移除词（快速消散）
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setWords(prev => prev.filter(w => {
        // 固定的词：动画2秒完成后移除
        if (w.isPinned && w.pinnedAt) {
          return now - w.pinnedAt < 2100; // 略多于动画时间
        }
        // 未固定的词：根据 displayDuration 消失
        return now - w.createdAt < w.displayDuration;
      }));
    }, 200);

    return () => clearInterval(interval);
  }, []);


  // 暴露 addWord 方法给父组件
  useEffect(() => {
    (window as any).__floatingWordsAddWord = addWord;
    return () => {
      delete (window as any).__floatingWordsAddWord;
    };
  }, [addWord]);

  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      <AnimatePresence>
        {words.map(word => (
          <motion.div
            key={word.id}
            className={`absolute pointer-events-auto cursor-pointer select-none ${
              word.isPinned
                ? 'text-white'
                : 'text-white/90 hover:text-white'
            } ${word.isVertical ? 'flex flex-col items-center' : ''}`}
            style={{
              left: word.x,
              top: word.y,
              fontFamily: fontFamily,
              fontSize: word.isFinal ? '16px' : '14px',
              textShadow: word.isPinned
                ? '0 0 15px rgba(255,255,255,0.8), 0 0 30px rgba(255,255,255,0.4)'
                : '0 0 20px rgba(0,0,0,0.8)',
              maxWidth: word.isVertical ? 'none' : `${word.maxWidth}px`,
              lineHeight: word.isVertical ? '1.2' : '1.4',
              wordWrap: 'break-word',
            }}
            initial={{
              opacity: 0,
              filter: 'blur(12px)',
              scale: 0.95,
            }}
            animate={word.isPinned ? {
              // 被固定：定住 → 缩小成光点 → 消失
              opacity: [1, 1, 0.8, 0],
              filter: ['blur(0px)', 'blur(0px)', 'blur(6px)', 'blur(15px)'],
              scale: [1, 1, 0.5, 0.1],
              transition: {
                duration: 2.0,
                ease: 'easeOut',
                times: [0, 0.2, 0.6, 1] // 前20%定住，然后缩小消失
              }
            } : {
              // 正常显现：暗房显影
              opacity: [0, 0.2, 0.5, 0.65],
              filter: ['blur(12px)', 'blur(8px)', 'blur(3px)', 'blur(0px)'],
              scale: [0.95, 0.97, 0.99, 1],
              transition: {
                duration: 2.0,
                ease: [0.1, 0.3, 0.4, 1],
                times: [0, 0.3, 0.7, 1]
              }
            }}
            exit={{
              opacity: [0.65, 0.5, 0.2, 0],
              filter: ['blur(0px)', 'blur(3px)', 'blur(8px)', 'blur(12px)'],
              scale: [1, 0.99, 0.97, 0.95],
              transition: {
                duration: 2.0,
                ease: [0.4, 0.1, 0.6, 1],
                times: [0, 0.3, 0.7, 1]
              }
            }}
            onClick={() => !word.isPinned && pinWord(word.id)}
          >
            {word.isVertical ? (
              // 竖排：每个字一行，像 ARCHIVE 那样
              word.text.split('').map((char, i) => (
                <span key={i} className="block">{char}</span>
              ))
            ) : (
              // 横排：正常显示
              word.text
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default FloatingWords;
