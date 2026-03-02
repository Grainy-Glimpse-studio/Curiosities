import { useState, useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ContentItem } from '../types';

interface GalleryItemState {
  item: ContentItem;
  x: number;
  y: number;
  vx: number;
  vy: number;
  zIndex: number;
}

interface GalleryViewProps {
  items: ContentItem[];
  floatingCards?: boolean;
  cardSize?: 'small' | 'medium' | 'large';
  transitionDuration?: number;
  onItemClick?: (item: ContentItem) => void;
  onItemDoubleClick?: (item: ContentItem) => void;
  onItemClose?: (item: ContentItem) => void;
}

export interface GalleryViewRef {
  stackCards: () => void;
}

const cardSizes = {
  small: { width: 160, height: 120 },
  medium: { width: 256, height: 192 },
  large: { width: 320, height: 240 },
};

const GalleryView = forwardRef<GalleryViewRef, GalleryViewProps>(({
  items,
  floatingCards = false,
  cardSize = 'medium',
  transitionDuration = 1200,
  onItemClick,
  onItemDoubleClick,
  onItemClose,
}, ref) => {
  const [galleryItems, setGalleryItems] = useState<GalleryItemState[]>([]);
  const [isStacked, setIsStacked] = useState(false);
  const animationRef = useRef<number>();
  const nextZIndexRef = useRef(1);

  // Stack all cards to center
  const stackCards = useCallback(() => {
    const windowW = window.innerWidth;
    const windowH = window.innerHeight;
    const centerX = windowW / 2;
    const centerY = windowH / 2;

    setGalleryItems(prev =>
      prev.map((g, index) => ({
        ...g,
        x: centerX + (index * 8), // Slight offset for stacking effect
        y: centerY + (index * 8),
        vx: 0,
        vy: 0,
        zIndex: index + 1,
      }))
    );
    setIsStacked(true);
  }, []);

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    stackCards,
  }));

  // Initialize new items with random positions
  useEffect(() => {
    const existingIds = new Set(galleryItems.map(g => g.item.id));
    const newItems = items.filter(item => !existingIds.has(item.id));

    if (newItems.length > 0) {
      const windowW = window.innerWidth;
      const windowH = window.innerHeight;
      const size = cardSizes[cardSize];

      const newGalleryItems = newItems.map(item => {
        nextZIndexRef.current += 1;
        return {
          item,
          x: size.width / 2 + Math.random() * (windowW - size.width),
          y: size.height / 2 + Math.random() * (windowH - size.height),
          vx: floatingCards ? (Math.random() - 0.5) * 0.3 : 0,
          vy: floatingCards ? (Math.random() - 0.5) * 0.3 : 0,
          zIndex: nextZIndexRef.current,
        };
      });

      setGalleryItems(prev => [...prev, ...newGalleryItems]);
      setIsStacked(false);
    }
  }, [items, cardSize, floatingCards]);

  // Remove items that are no longer in the list
  useEffect(() => {
    const currentIds = new Set(items.map(i => i.id));
    setGalleryItems(prev => prev.filter(g => currentIds.has(g.item.id)));
  }, [items]);

  // Floating animation (only if enabled)
  useEffect(() => {
    if (!floatingCards || isStacked) return;

    const animate = () => {
      setGalleryItems(prev => {
        const windowW = window.innerWidth;
        const windowH = window.innerHeight;
        const size = cardSizes[cardSize];

        return prev.map(g => {
          let { x, y, vx, vy } = g;

          x += vx;
          y += vy;

          // Bounce off edges
          if (x < size.width / 2 || x > windowW - size.width / 2) {
            vx = -vx;
            x = Math.max(size.width / 2, Math.min(windowW - size.width / 2, x));
          }
          if (y < size.height / 2 || y > windowH - size.height / 2) {
            vy = -vy;
            y = Math.max(size.height / 2, Math.min(windowH - size.height / 2, y));
          }

          // Add slight random drift
          vx += (Math.random() - 0.5) * 0.01;
          vy += (Math.random() - 0.5) * 0.01;

          // Limit velocity
          const maxV = 0.5;
          vx = Math.max(-maxV, Math.min(maxV, vx));
          vy = Math.max(-maxV, Math.min(maxV, vy));

          return { ...g, x, y, vx, vy };
        });
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [floatingCards, cardSize, isStacked]);

  // Bring card to front on click
  const bringToFront = useCallback((itemId: string | number) => {
    nextZIndexRef.current += 1;
    setGalleryItems(prev =>
      prev.map(g =>
        g.item.id === itemId ? { ...g, zIndex: nextZIndexRef.current } : g
      )
    );
  }, []);

  const durationSec = transitionDuration / 1000;
  const size = cardSizes[cardSize];

  return (
    <div className="fixed inset-0 z-20 pointer-events-none overflow-hidden">
      <AnimatePresence>
        {galleryItems.map(({ item, x, y, zIndex }) => (
          <motion.div
            key={item.id}
            className="absolute pointer-events-auto cursor-pointer group"
            style={{ zIndex }}
            initial={{
              opacity: 0,
              scale: 0.8,
              filter: 'blur(20px)',
              x: x - size.width / 2,
              y: y - size.height / 2,
            }}
            animate={{
              opacity: 1,
              scale: 1,
              filter: 'blur(0px)',
              x: x - size.width / 2,
              y: y - size.height / 2,
            }}
            exit={{
              opacity: 0,
              scale: 0.9,
              filter: 'blur(10px)',
            }}
            transition={{
              duration: durationSec,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
            drag
            dragMomentum={false}
            onDragStart={() => {
              bringToFront(item.id);
              setIsStacked(false);
            }}
            onDragEnd={(_, info) => {
              setGalleryItems(prev =>
                prev.map(g =>
                  g.item.id === item.id
                    ? { ...g, x: g.x + info.offset.x, y: g.y + info.offset.y, vx: 0, vy: 0 }
                    : g
                )
              );
            }}
            onClick={() => {
              bringToFront(item.id);
              onItemClick?.(item);
            }}
            onDoubleClick={() => onItemDoubleClick?.(item)}
          >
            {/* Close button */}
            {onItemClose && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onItemClose(item);
                }}
                className="absolute -top-3 -right-3 z-30 w-6 h-6 rounded-full bg-black/50 border border-white/20 text-white/60 hover:text-white hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs"
              >
                x
              </button>
            )}

            {/* Card content */}
            <div
              className="relative overflow-hidden rounded-lg border border-white/10"
              style={{
                width: size.width,
                height: size.height,
                boxShadow: '0 0 40px rgba(255,255,255,0.1), 0 20px 60px rgba(0,0,0,0.5)',
              }}
            >
              {item.type === 'image' ? (
                <img
                  src={item.src}
                  alt={item.alt || item.title || 'Image'}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : item.type === 'text' ? (
                <div className="w-full h-full p-4 bg-black/40 backdrop-blur-md flex items-center justify-center">
                  <p className="text-white/90 text-sm leading-relaxed italic text-center line-clamp-4">
                    "{item.content}"
                  </p>
                </div>
              ) : item.render ? (
                item.render()
              ) : null}

              {/* Title overlay */}
              {item.title && (
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-white/70 text-xs tracking-widest uppercase text-center">
                    {item.title}
                  </p>
                </div>
              )}

              {/* Inner glow */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  boxShadow: 'inset 0 0 30px rgba(255,255,255,0.05)',
                }}
              />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});

GalleryView.displayName = 'GalleryView';

export default GalleryView;
