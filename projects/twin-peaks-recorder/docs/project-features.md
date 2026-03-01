# Ephemera / Diane - Project Features Document

## Project Overview

**Name**: Ephemera (also called "Diane")
**Type**: Web-based voice recorder with artistic visualization
**Inspiration**: Twin Peaks - Agent Cooper's voice memos to Diane
**Theme**: Capturing ephemeral thoughts, the words we speak when no one is listening

---

## Core Features

### 1. Voice Recording
- Record voice memos with one click
- Pause and resume recording
- Real-time speech-to-text transcription (Web Speech API)
- Auto-detect language (Chinese/English) and switch fonts accordingly
- Manual paragraph break with Tab key

### 2. Floating Words (Darkroom Effect)
- During recording, spoken words float up on screen like photos developing in a darkroom
- Words appear blurry, slowly become clear, then fade away
- Click any floating word to "capture" it - the word gets underlined in the final transcript
- Creates a dreamlike, meditative recording experience

### 3. Focus Mode
- Full-screen distraction-free mode during recording
- Shows real-time transcription in large text
- Can capture words by clicking

### 4. Archive (Tape Drawer)
- Cassette tape-styled cards for each recording
- Video background with feathered edges (cinematic feel)
- Drag cards freely, "Tidy" button to reset layout
- Search, filter by tags, filter by date range
- Font selection for display
- Easter egg: Hover over "ARCHIVE" letters to reveal "EPHEMERA"
- Hidden Twin Peaks quotes appear when mouse approaches certain areas

### 5. Floating Transcript Window
- Draggable, resizable floating window
- Rich text editor (Tiptap) - bold, italic, underline, headings, lists, quotes
- Karaoke-style playback: text highlights as audio plays
- Export options:
  - Markdown (.md)
  - HTML (.html)
  - Plain text (.txt)
  - Audio file (.webm/.mp4)
- "What is this?" - shows project introduction with darkroom reveal effect
- "Send your Ephemera" - sends underlined/highlighted words to the creator via email

### 6. Shooting Star & About Page
- A shooting star occasionally crosses the screen (every 45-90 seconds)
- Press spacebar to "catch" the star → enters the About page
- About page is a standalone route (/about)
- Contains: Artist statement, About the creator, contact info
- Press spacebar to return (remembers where you came from)

### 7. Email Integration
- Users can send their "ephemera" (underlined words) to the creator
- Uses EmailJS for seamless sending without opening email client
- Fallback to mailto: if EmailJS fails

---

## Visual Design

### Aesthetic
- Dark, atmospheric, night sky theme
- Inspired by Twin Peaks: mysterious, contemplative, slightly surreal
- Minimal UI, maximum emotional impact

### Background
- Starfield with twinkling stars (some brighter than others)
- Subtle vignette effect
- Pure black base

### Custom Cursor
- Soft glowing orb cursor
- Trail effect with fading glow orbs
- Creates ethereal, floating sensation

### Typography
- **HuiWen (汇文明朝体)**: Chinese serif font
- **Consulate**: Typewriter/monospace for English
- **LORE**: Display font for titles
- **Permanent Marker**: Handwriting style
- Auto-switches based on detected language

### Animations
- Darkroom developing effect for floating words (blur → clear → fade)
- Slow, meditative transitions
- Gentle glow effects

---

## Technical Details

### Stack
- React + TypeScript
- Vite build tool
- Framer Motion for animations
- Tiptap for rich text editing
- Web Speech API for transcription
- EmailJS for email sending
- React Router for navigation

### Routes
- `/` - Home page (recorder)
- `/about` - About/Ephemera page (standalone)

---

## Conceptual Framework

### The "Ephemera" Concept
- Everything can be generated now by AI
- But no one would generate this: unpolished, purposeless words murmured to oneself
- These are the words closest to our inner world
- This project captures those fleeting thoughts before they disappear

### Why "Diane"?
- Named after the unseen listener in Twin Peaks
- Agent Cooper speaks to Diane alone, in the dark, without expecting a reply
- The recorder becomes a safe space for unperformed speech

### The Physical Outcome
- Creator collects submitted "ephemera" from strangers
- Transforms them into physical works:
  - Words recorded onto magnetic tape
  - Printed folios
  - Cyanotype prints
- The ephemeral becomes permanent

---

## User Flow

1. **Land on homepage** → See starfield, recorder in center
2. **Start recording** → Speak, watch words float up like developing photos
3. **Capture words** → Click floating words to underline them
4. **Stop recording** → Tape saved to archive
5. **Open archive** → Browse past recordings as cassette tapes
6. **Open transcript** → Edit, add formatting, export
7. **Send ephemera** → Share underlined words with creator
8. **Catch shooting star** → Discover the About page and project story

---

## Target Audience
- People who want to record thoughts in a contemplative, non-utilitarian way
- Those interested in the intersection of technology and art
- Twin Peaks fans
- Anyone curious about what they say when no one is listening

---

## Key Differentiators
- Not a productivity tool - an artistic experience
- Focus on the ephemeral nature of speech
- Participatory art project (submissions become physical works)
- Unique visual language (darkroom, starfield, floating words)
