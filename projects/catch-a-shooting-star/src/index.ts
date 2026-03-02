// Core components
export { default as StarCatcher } from './core/StarCatcher';
export { default as Starfield } from './core/Starfield';
export { default as ShootingStar } from './core/ShootingStar';
export { default as HandTracker } from './core/HandTracker';

// Display modes
export { default as SingleView } from './modes/SingleView';
export { default as GalleryView } from './modes/GalleryView';

// Types
export type {
  ContentItem,
  DisplayMode,
  InteractionMode,
  KeyboardScheme,
  StarCatcherConfig,
} from './types';

export { defaultConfig } from './types';

// Utils
export { loadGalleryConfig } from './utils/contentLoader';
export type { GalleryConfig } from './utils/contentLoader';
