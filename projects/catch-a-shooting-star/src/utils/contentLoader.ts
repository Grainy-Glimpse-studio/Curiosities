import type { ContentItem } from '../types';

// Gallery configuration from R2 or local
export interface GalleryConfig {
  title?: string;
  description?: string;
  items: ContentItem[];
  settings?: {
    mode?: 'single' | 'gallery';
    cardSize?: 'small' | 'medium' | 'large';
    starInterval?: [number, number];
  };
}

// Default fallback content (used when no config is loaded)
export const DEFAULT_CONTENT: ContentItem[] = [
  { id: 'demo-1', type: 'text', content: 'Catch a shooting star to begin...', title: 'Welcome' },
];

/**
 * Load gallery config from a URL (Cloudflare R2, CDN, or local)
 *
 * Usage:
 *   const config = await loadGalleryConfig('https://cdn.yoursite.com/gallery.json');
 *   const config = await loadGalleryConfig('/gallery.json'); // local
 */
export async function loadGalleryConfig(url: string): Promise<GalleryConfig> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`Failed to load gallery config from ${url}: ${response.status}`);
      return { items: DEFAULT_CONTENT };
    }

    const data = await response.json();

    // Validate and transform items
    const items: ContentItem[] = (data.items || []).map((item: any, index: number) => ({
      id: item.id || `item-${index}`,
      type: item.type || 'image',
      src: item.src ? resolveUrl(item.src, url) : undefined,
      content: item.content,
      title: item.title,
      alt: item.alt,
    }));

    return {
      title: data.title,
      description: data.description,
      items: items.length > 0 ? items : DEFAULT_CONTENT,
      settings: data.settings,
    };
  } catch (error) {
    console.error('Error loading gallery config:', error);
    return { items: DEFAULT_CONTENT };
  }
}

/**
 * Resolve relative URLs against the config URL base
 * e.g., "photos/img.jpg" + "https://cdn.xxx/gallery.json" → "https://cdn.xxx/photos/img.jpg"
 */
function resolveUrl(src: string, configUrl: string): string {
  // Already absolute URL
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) {
    return src;
  }

  // Resolve relative to config URL
  try {
    const base = new URL(configUrl);
    // Remove the filename from the path
    const basePath = base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
    base.pathname = basePath + src;
    return base.toString();
  } catch {
    // If configUrl is a relative path, just return src as-is
    return src;
  }
}

/**
 * Example gallery.json structure for reference:
 *
 * {
 *   "title": "My Gallery",
 *   "description": "A collection of memories",
 *   "items": [
 *     {
 *       "id": "1",
 *       "type": "image",
 *       "src": "photos/sunset.jpg",
 *       "title": "Sunset"
 *     },
 *     {
 *       "id": "2",
 *       "type": "video",
 *       "src": "videos/trip.mp4",
 *       "title": "Summer Trip"
 *     },
 *     {
 *       "id": "3",
 *       "type": "text",
 *       "content": "The stars are not what they seem...",
 *       "title": "Note"
 *     }
 *   ],
 *   "settings": {
 *     "mode": "single",
 *     "cardSize": "medium",
 *     "starInterval": [6000, 12000]
 *   }
 * }
 */
