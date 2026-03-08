// Content item that can be displayed after catching a star
export interface ContentItem {
  id: string | number;
  type: 'image' | 'text' | 'custom' | 'input'; // 'input' for guestbook
  // For image type
  src?: string;
  alt?: string;
  // For text type
  content?: string;
  // For input type (guestbook)
  placeholder?: string;
  quotedContent?: string; // For reply mode - shows as > quote
  // Common
  title?: string;
  // For custom type - render function
  render?: () => React.ReactNode;
  // Random font assignment (set when caught)
  _fontFamily?: string;
  _fontSize?: number;
  // Translation (set when caught or after API call)
  _translation?: string;
}

// Display mode
export type DisplayMode = 'single' | 'gallery';

// Interaction mode (null = not selected yet)
export type InteractionMode = 'keyboard' | 'gesture' | null;

// Keyboard control scheme
export type KeyboardScheme = 'space' | 'directional';

// Font definition
export interface FontConfig {
  name: string;
  file: string | null;
  category: 'system' | 'chinese' | 'japanese' | 'typewriter' | 'script';
}

// Configuration for the framework
export interface StarCatcherConfig {
  // Display
  mode: DisplayMode;

  // Content
  items: ContentItem[];

  // Shooting star behavior
  stars?: {
    // Max stars on screen at once (1-3)
    maxConcurrent?: number;
    // Interval range in ms [min, max]
    intervalRange?: [number, number];
    // Speed range in seconds [min, max]
    speedRange?: [number, number];
  };

  // Keyboard control
  keyboard?: {
    scheme: KeyboardScheme;
  };

  // Styling
  style?: {
    // Card size for gallery mode
    cardSize?: 'small' | 'medium' | 'large';
    // Whether cards float/drift in gallery mode
    floatingCards?: boolean;
    // Transition duration in ms
    transitionDuration?: number;
    // Font family for text content
    fontFamily?: string;
    // Font opacity (0-1)
    fontOpacity?: number;
    // Font size in px
    fontSize?: number;
    // Use random font from config
    useRandomFont?: boolean;
    // UI font family
    uiFontFamily?: string;
    // UI font size
    uiFontSize?: number;
    // UI font opacity (for fade transitions)
    uiFontOpacity?: number;
  };

  // Callbacks
  onCatch?: (item: ContentItem) => void;
  onItemClick?: (item: ContentItem) => void;
  onItemDoubleClick?: (item: ContentItem) => void;
}

// Default configuration
export const defaultConfig: StarCatcherConfig = {
  mode: 'single',
  items: [],
  stars: {
    maxConcurrent: 1,
    intervalRange: [8000, 15000],
    speedRange: [1.5, 2.5],
  },
  keyboard: {
    scheme: 'space',
  },
  style: {
    cardSize: 'medium',
    floatingCards: true,
    transitionDuration: 1200,
  },
};
