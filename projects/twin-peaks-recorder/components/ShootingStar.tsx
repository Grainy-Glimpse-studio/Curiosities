import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ShootingStarProps {
  onCatch: () => void;
  disabled?: boolean; // 当在 Archive 或 About 页面时禁用
  onVisibilityChange?: (visible: boolean) => void; // 流星可见性变化
}

interface StarState {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  duration: number;
  angle: number;
}

const ShootingStar: React.FC<ShootingStarProps> = ({ onCatch, disabled = false, onVisibilityChange }) => {
  const [star, setStar] = useState<StarState | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [hasSeenStar, setHasSeenStar] = useState(false);

  // 检查是否第一次看到流星
  useEffect(() => {
    const seen = localStorage.getItem('hasSeenShootingStar');
    if (seen) {
      setHasSeenStar(true);
    }
  }, []);

  // 生成随机流星
  const generateStar = useCallback(() => {
    if (disabled) return;

    const windowW = window.innerWidth;
    const windowH = window.innerHeight;

    // 避开中间区域（录音机所在位置）
    // 只在上部 1/3 或下部 1/3 的区域划过
    const isUpperPath = Math.random() > 0.5;

    // 随机选择起点边缘 (0: 左上到右上, 1: 右上到左下角落)
    const pathType = Math.floor(Math.random() * 4);
    let startX: number, startY: number, endX: number, endY: number;

    if (isUpperPath) {
      // 上半部分的轨迹
      switch (pathType) {
        case 0: // 从左上角向右划
          startX = -20;
          startY = windowH * 0.1 + Math.random() * windowH * 0.15;
          endX = windowW + 20;
          endY = startY + (Math.random() - 0.3) * windowH * 0.2;
          break;
        case 1: // 从右上角向左划
          startX = windowW + 20;
          startY = windowH * 0.05 + Math.random() * windowH * 0.15;
          endX = -20;
          endY = startY + (Math.random() - 0.3) * windowH * 0.2;
          break;
        case 2: // 从上边斜向下（但只到上部 1/3）
          startX = windowW * 0.2 + Math.random() * windowW * 0.6;
          startY = -20;
          endX = startX + (Math.random() > 0.5 ? 1 : -1) * windowW * 0.3;
          endY = windowH * 0.25;
          break;
        default: // 从左上角斜向右下角落
          startX = -20;
          startY = -20;
          endX = windowW * 0.3;
          endY = windowH * 0.25;
          break;
      }
    } else {
      // 下半部分的轨迹
      switch (pathType) {
        case 0: // 从左下角向右划
          startX = -20;
          startY = windowH * 0.8 + Math.random() * windowH * 0.15;
          endX = windowW + 20;
          endY = startY + (Math.random() - 0.5) * windowH * 0.1;
          break;
        case 1: // 从右下角向左划
          startX = windowW + 20;
          startY = windowH * 0.85 + Math.random() * windowH * 0.1;
          endX = -20;
          endY = startY + (Math.random() - 0.5) * windowH * 0.1;
          break;
        case 2: // 从下边斜向上（但只到下部）
          startX = windowW * 0.2 + Math.random() * windowW * 0.6;
          startY = windowH + 20;
          endX = startX + (Math.random() > 0.5 ? 1 : -1) * windowW * 0.3;
          endY = windowH * 0.75;
          break;
        default: // 从右下角斜向左
          startX = windowW + 20;
          startY = windowH + 20;
          endX = windowW * 0.7;
          endY = windowH * 0.8;
          break;
      }
    }

    // 计算角度（用于旋转尾巴）
    const angle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);

    setStar({
      id: Date.now(),
      startX,
      startY,
      endX,
      endY,
      duration: 1.2 + Math.random() * 0.8, // 1.2-2秒，快速划过
      angle,
    });

    // 第一次显示提示
    if (!hasSeenStar) {
      setShowHint(true);
      setTimeout(() => {
        setShowHint(false);
        setHasSeenStar(true);
        localStorage.setItem('hasSeenShootingStar', 'true');
      }, 3000);
    }

    // 通知父组件流星出现
    onVisibilityChange?.(true);

    // 流星消失后清除状态
    setTimeout(() => {
      setStar(null);
      onVisibilityChange?.(false);
    }, 3000);
  }, [disabled, hasSeenStar, onVisibilityChange]);

  // 定时生成流星
  useEffect(() => {
    if (disabled) return;

    // 首次延迟 5-15 秒出现
    const initialDelay = 5000 + Math.random() * 10000;
    let nextTimer: ReturnType<typeof setTimeout>;

    const scheduleNextStar = () => {
      // 45-90 秒随机间隔
      const interval = 45000 + Math.random() * 45000;
      nextTimer = setTimeout(() => {
        generateStar();
        scheduleNextStar();
      }, interval);
    };

    const initialTimer = setTimeout(() => {
      generateStar();
      scheduleNextStar();
    }, initialDelay);

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(nextTimer);
    };
  }, [disabled, generateStar]);

  // 空格键捕获
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 只有当流星存在时，按空格才能捕获
      if (e.code === 'Space' && star) {
        e.preventDefault();
        setStar(null);
        setShowHint(false);
        onCatch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, star, onCatch]);

  if (disabled || !star) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[50]">
      <AnimatePresence>
        {star && (
          <motion.div
            key={star.id}
            className="absolute"
            initial={{ x: star.startX, y: star.startY, opacity: 0 }}
            animate={{ x: star.endX, y: star.endY, opacity: [0, 1, 1, 0] }}
            transition={{ duration: star.duration, ease: 'linear' }}
          >
            {/* 流星本体 */}
            <div
              className="relative"
              style={{
                transform: `rotate(${star.angle}deg)`,
              }}
            >
              {/* 尾巴 - 渐变拖尾 */}
              <div
                className="absolute"
                style={{
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '120px',
                  height: '3px',
                  background: 'linear-gradient(to left, rgba(255,255,255,1), rgba(255,220,180,0.5), transparent)',
                  filter: 'blur(1px)',
                }}
              />
              {/* 更长的淡尾 */}
              <div
                className="absolute"
                style={{
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '200px',
                  height: '6px',
                  background: 'linear-gradient(to left, rgba(255,255,255,0.5), rgba(255,200,150,0.2), transparent)',
                  filter: 'blur(4px)',
                }}
              />
              {/* 头部 - 柔和发光点 */}
              <div
                className="relative rounded-full"
                style={{
                  width: '12px',
                  height: '12px',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.3) 40%, transparent 70%)',
                  filter: 'blur(1px)',
                  boxShadow: '0 0 10px rgba(255,255,255,0.6), 0 0 25px rgba(255,200,150,0.4)',
                }}
              />
            </div>
          </motion.div>
        )}

        {/* 首次提示 */}
        {showHint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="fixed bottom-20 left-1/2 transform -translate-x-1/2 text-white/40 text-xs tracking-widest uppercase"
            style={{ fontFamily: "'Consulate', monospace" }}
          >
            press space...
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ShootingStar;
