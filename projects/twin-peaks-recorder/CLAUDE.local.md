# Twin Peaks Recorder - Design Specifications (2026-02-28)

## Key Features Implemented

### 1. Cassette Tape Card (CassetteTape.tsx)
- **Black container**: `bg-[#1a1a1a]` with plastic texture
- **Title hover color**: Changes to theme red `#903e4f` on hover (NOT white)
  - Class: `group-hover:text-[#903e4f]`
- **Sound on CLICK only** - NOT on hover
  - `playClickSound()` called in `handleCardClick()`
- **Draggable cards**: Using framer-motion `drag` prop in TapeDrawer

### 2. Archive Drawer (TapeDrawer.tsx)
- **Video background**: `/video/background.mp4` with feathered edges
- **ARCHIVE text**: Vertical glowing text on right side
  - Proximity-based glow effect
  - **Easter egg**: Hover all letters to cross-dissolve into "TWINPEAKS"
    - State: `bgWord`, `hoveredLetters`, `wordTransition`
- **Hidden scattered text**: Twin Peaks quotes revealed by mouse proximity
  - "THE OWLS ARE NOT WHAT THEY SEEM", "FIRE WALK WITH ME", etc.

### 3. Floating Controls (NO backgrounds, NO borders)
- All dropdowns are **transparent** - no `bg-black/80`
- Text is white, no special colors
- Dropdowns:
  - **Date**: Sort order + date range picker
  - **Tag**: Single dropdown with all tags merged (NOT separate buttons)
  - **Style**: Title Font + Text Font options

### 4. Drag & Tidy
- Cards can be dragged using framer-motion
- "Tidy" button appears when cards are out of grid
- `handleTidy()` resets all positions

## Theme Colors
- Primary red: `#903e4f`
- Lighter red: `#b85a6a`
- Dark background: `#1a1a1a`

## Fonts
- **HuiWen** (明朝): Chinese font `汇文筑地五号明朝体1.0.otf` - available for both Title and Text
- **Permanent Marker**: English handwriting
- **LORE**: Title font
- **Consulate**: Typewriter/monospace
- **Journal Ultra**: Body text
- **Kawaiitegakimoji**: Cute Japanese handwriting

## Editable Transcript Title
- The "Transcript" header in the modal is editable (contentEditable)
- State: `customTitle` in CassetteTape.tsx

## Language Toggle & Font Switching
- **UI Toggle**: Click to switch between AUTO / 中文 / EN during recording
- Located next to HIDE and FOCUS MODE buttons (top-left when recording)
- **AUTO**: Browser auto-detects language
- **中文**: Forces Traditional Chinese (zh-TW) + HuiWen (明朝) font
- **EN**: Forces English (en-US) + Consulate (typewriter) font
- Can switch language while recording without stopping

## FloatingWords Animation Settings
- **Enter/Exit duration**: 2.0 seconds (darkroom developing effect)
- **Display duration**: 4-6 seconds (based on text length)
- **Max words on screen**: 5
- Animation: blur(12px) → blur(0px), opacity fade, scale 0.95 → 1

## Backup Location
- `.backups/2026-02-28/TapeDrawer.tsx`
- `.backups/2026-02-28/CassetteTape.tsx`

## Recovery Notes
If features are lost, check the conversation log at:
`~/.claude/projects/-Users-yuxiwang-Documents-2026-Curiosities/1f6804c7-bb3c-426c-811e-08301f4a5aa1.jsonl`

Key line numbers in log:
- Cassette hover red: Line 3677
- Tags dropdown transparent: Line 3572
- ARCHIVE morph effect: Line 4400
