/**
 * Vertical Text Component
 *
 * Renders Chinese/Japanese text vertically with different layout styles:
 * - poetry: Classical poetry layout (columns aligned at top)
 * - prose-staggered: Prose with staggered column offsets
 * - prose-mixed: Prose with mixed layout (vertical text + horizontal metadata)
 */

import React, { useMemo } from 'react';
import type { VerticalLayoutType } from '../utils/quotesLoader';

interface VerticalTextProps {
  text: string;
  segments?: string[];
  meta?: string;
  layout: VerticalLayoutType;
  fontSize?: number;
  fontFamily?: string;
  className?: string;
}

// Default Chinese font for vertical text
const CHINESE_FONT = "'匯文明朝體', '京華老宋體', 'Noto Serif SC', serif";

// Poetry layout: columns aligned at top, split by punctuation
const PoetryLayout: React.FC<{
  segments: string[];
  meta?: string;
  fontSize: number;
  fontFamily?: string;
}> = ({ segments, meta, fontSize, fontFamily }) => {
  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-row-reverse gap-8 items-start">
        {segments.map((segment, i) => (
          <div
            key={i}
            className="text-white/90"
            style={{
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              fontSize: `${fontSize}px`,
              fontFamily: fontFamily || CHINESE_FONT,
              letterSpacing: '0.15em',
              lineHeight: '1.8',
            }}
          >
            {segment}
          </div>
        ))}
      </div>
      {meta && (
        <div
          className="mt-8 text-white/50 text-sm tracking-wider"
          style={{ fontFamily: fontFamily || CHINESE_FONT }}
        >
          {meta}
        </div>
      )}
    </div>
  );
};

// Staggered layout: columns with random vertical offsets
const StaggeredLayout: React.FC<{
  segments: string[];
  meta?: string;
  fontSize: number;
  fontFamily?: string;
}> = ({ segments, meta, fontSize, fontFamily }) => {
  // Generate consistent random offsets based on segment content
  const offsets = useMemo(() => {
    return segments.map((seg, i) => {
      // Use segment length and index for pseudo-random but consistent offset
      const seed = seg.length * 7 + i * 13;
      return (seed % 40) - 20; // -20px to +20px
    });
  }, [segments]);

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-row-reverse gap-6 items-start">
        {segments.map((segment, i) => (
          <div
            key={i}
            className="text-white/90"
            style={{
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              fontSize: `${fontSize}px`,
              fontFamily: fontFamily || CHINESE_FONT,
              letterSpacing: '0.12em',
              lineHeight: '1.8',
              transform: `translateY(${offsets[i]}px)`,
            }}
          >
            {segment}
          </div>
        ))}
      </div>
      {meta && (
        <div
          className="mt-8 text-white/50 text-sm tracking-wider"
          style={{ fontFamily: fontFamily || CHINESE_FONT }}
        >
          {meta}
        </div>
      )}
    </div>
  );
};

// Mixed layout: vertical text with horizontal metadata, centered
const MixedLayout: React.FC<{
  text: string;
  segments?: string[];
  meta?: string;
  fontSize: number;
  fontFamily?: string;
}> = ({ text, segments, meta, fontSize, fontFamily }) => {
  // If we have segments, use them; otherwise use the full text
  const displaySegments = segments || [text];

  // Generate subtle offsets for mixed layout
  const offsets = useMemo(() => {
    return displaySegments.map((seg, i) => {
      const seed = seg.length * 5 + i * 11;
      return (seed % 20) - 10; // -10px to +10px (subtler than staggered)
    });
  }, [displaySegments]);

  return (
    <div className="flex flex-col items-center">
      <div className="border-b border-white/10 pb-6 mb-4">
        <div className="flex flex-row-reverse gap-6 items-start justify-center">
          {displaySegments.map((segment, i) => (
            <div
              key={i}
              className="text-white/90"
              style={{
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                fontSize: `${fontSize}px`,
                fontFamily: fontFamily || CHINESE_FONT,
                letterSpacing: '0.15em',
                lineHeight: '2',
                transform: `translateY(${offsets[i]}px)`,
              }}
            >
              {segment}
            </div>
          ))}
        </div>
      </div>
      {meta && (
        <div
          className="text-white/50 text-sm tracking-wider"
          style={{ fontFamily: fontFamily || CHINESE_FONT }}
        >
          {meta}
        </div>
      )}
    </div>
  );
};

// Horizontal layout for non-CJK text
const HorizontalLayout: React.FC<{
  text: string;
  meta?: string;
  fontSize: number;
}> = ({ text, meta, fontSize }) => {
  return (
    <div className="flex flex-col items-center text-center max-w-2xl">
      <div
        className="text-white/90 leading-relaxed"
        style={{ fontSize: `${fontSize}px` }}
      >
        "{text}"
      </div>
      {meta && (
        <div className="mt-6 text-white/50 text-sm tracking-wider">
          {meta}
        </div>
      )}
    </div>
  );
};

// Main component
const VerticalText: React.FC<VerticalTextProps> = ({
  text,
  segments,
  meta,
  layout,
  fontSize = 24,
  fontFamily,
  className = '',
}) => {
  // For horizontal layout (non-CJK)
  if (layout === 'none') {
    return (
      <div className={className}>
        <HorizontalLayout text={text} meta={meta} fontSize={fontSize} />
      </div>
    );
  }

  // Use segments if available, otherwise split text
  const displaySegments = segments || text.split(/[，。、；：！？]/g).filter(s => s.trim());

  return (
    <div className={className}>
      {layout === 'poetry' && (
        <PoetryLayout segments={displaySegments} meta={meta} fontSize={fontSize} fontFamily={fontFamily} />
      )}
      {layout === 'prose-staggered' && (
        <StaggeredLayout segments={displaySegments} meta={meta} fontSize={fontSize} fontFamily={fontFamily} />
      )}
      {layout === 'prose-mixed' && (
        <MixedLayout text={text} segments={displaySegments} meta={meta} fontSize={fontSize} fontFamily={fontFamily} />
      )}
    </div>
  );
};

export default VerticalText;
