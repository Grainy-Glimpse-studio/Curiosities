# Catch A Shooting Star

A configurable interactive gallery where you catch shooting stars to reveal content.

## Features

- **Two interaction modes**: Keyboard (Space/WASD) or Gesture (MediaPipe hand tracking)
- **Two display modes**: Single (one item at a time) or Gallery (multiple floating cards)
- **Content from anywhere**: Local files, Cloudflare R2, or any CDN
- **Supports**: Images, videos, text, custom components

## Quick Start

```bash
npm install
npm run dev
```

## Configuration

### Option 1: Demo Mode (default)

Edit `DEMO_ITEMS` in `src/App.tsx` to change content.

### Option 2: Local JSON

1. Create `public/gallery.json`:
```json
{
  "title": "My Gallery",
  "items": [
    { "id": "1", "type": "image", "src": "/images/photo1.jpg", "title": "Photo 1" },
    { "id": "2", "type": "text", "content": "Hello world", "title": "Note" }
  ]
}
```

2. Update `src/App.tsx`:
```typescript
const GALLERY_CONFIG_URL = '/gallery.json';
```

### Option 3: Cloudflare R2 (Recommended for production)

1. Create a Cloudflare R2 bucket
2. Enable public access (Settings → Public Access → Add custom domain)
3. Upload your images and `gallery.json`
4. Update `src/App.tsx`:
```typescript
const GALLERY_CONFIG_URL = 'https://cdn.yoursite.com/gallery.json';
```

### Option 4: URL Parameter

Pass config URL as query parameter:
```
https://yoursite.com/catch-a-shooting-star/?config=https://cdn.xxx/gallery.json
```

## gallery.json Format

```json
{
  "title": "My Gallery",
  "description": "Optional description",
  "items": [
    {
      "id": "unique-id",
      "type": "image",
      "src": "photos/sunset.jpg",
      "title": "Sunset"
    },
    {
      "id": "2",
      "type": "video",
      "src": "https://cdn.xxx/video.mp4",
      "title": "Trip Video"
    },
    {
      "id": "3",
      "type": "text",
      "content": "Your text content here...",
      "title": "Note"
    }
  ],
  "settings": {
    "mode": "single",
    "cardSize": "medium",
    "starInterval": [6000, 12000]
  }
}
```

### Content Types

| Type | Required Fields | Optional |
|------|----------------|----------|
| `image` | `src` | `title`, `alt` |
| `video` | `src` | `title` |
| `text` | `content` | `title` |

### Settings

| Setting | Values | Default |
|---------|--------|---------|
| `mode` | `"single"`, `"gallery"` | `"single"` |
| `cardSize` | `"small"`, `"medium"`, `"large"` | `"medium"` |
| `starInterval` | `[min, max]` ms | `[6000, 12000]` |

## Cloudflare R2 Setup

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → R2
2. Create bucket (e.g., `my-gallery`)
3. Settings → Public Access → Add custom domain (e.g., `cdn.yoursite.com`)
4. Upload files:
   ```
   my-gallery/
   ├── gallery.json
   └── photos/
       ├── photo1.jpg
       └── photo2.jpg
   ```
5. Access at `https://cdn.yoursite.com/gallery.json`

## Controls

### Keyboard Mode
- **Single mode**: Press `Space` to catch
- **Gallery mode**: Press `W/A/S/D` or arrow keys (direction the star is heading)

### Gesture Mode
- Make a "grab" gesture with your hand
- Both hands are supported
- Camera preview shown in bottom-right corner

## License

MIT
