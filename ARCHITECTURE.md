# 🏗️ Architecture Summary (Short)

## System Overview

```
CLIENT (Browser)          SERVER (Node.js)
┌──────────────┐         ┌──────────────┐
│ Canvas API   │◄──────►│ Socket.IO    │
│ Drawing      │ WebSocket │ Broadcasting│
│ Ghost Cursor │         │ History Mgmt │
└──────────────┘         └──────────────┘
```

---

## Core Components

### Frontend
- **canvas.js** - Draw locally, manage ghost cursors
- **websocket.js** - Socket.IO connection & events
- **main.js** - Coordinate UI, canvas, and socket

### Backend
- **server.js** - Express + Socket.IO
- **rooms.js** - Multi-room management
- **state-manager.js** - History & undo/redo

---

## Data Flow

```
User Draws
  ↓
Mouse Events
  ↓
Collect Points
  ↓
Create Stroke { points, color, width }
  ↓
Send to Server
  ↓
Server Broadcasts to Room
  ↓
Other Users Render
  ↓
All See Same Drawing
```

---

## WebSocket Events

**Drawing:** `drawing_step` → broadcast → `draw_event`
**Cursor:** `cursor_move` → broadcast → `cursor_moved` (100ms throttle)
**Undo:** `undo` → server processes → broadcast `history_updated`
**Redo:** `redo` → server processes → broadcast `history_updated`

---

## State Management

**Server (Single Source of Truth):**
```javascript
room.history = [stroke, stroke, ...]
room.undoStacks[userId] = [stroke, ...]
room.redoStacks[userId] = [stroke, ...]
```

**Client (Local Copy):**
```javascript
allStrokes = [stroke, stroke, ...]
```

---

## Undo/Redo Strategy

**Per-User Stacks on Server:**
```
User A draws → history = [A1]
User B draws → history = [A1, B1]

User A undoes:
  - Find & remove A1
  - history = [B1]
  - A.undoStack = [A1]
  - Broadcast to all
  - Everyone sees [B1]
```

✅ **Key:** One user can undo another's strokes without affecting others' undo stacks

---

## Conflict Handling

**Sequential Processing:**
- Server processes events one-by-one
- Each event updates history
- Each update broadcasts to all users
- No race conditions
- All users always synchronized

---

## Performance Decisions

| Decision | Why |
|----------|-----|
| Collect all points | Smooth curves, not jagged lines |
| Send on mouseup | Efficient, not per-pixel |
| Throttle cursor 100ms | Smooth movement, not saturated |
| Atomic full redraw | Simple, always correct |
| In-memory storage | Fast, acceptable for sessions |

---

## Key Features

✅ **Real-Time Sync** - Strokes appear instantly on all users
✅ **Ghost Cursors** - See other users' mouse positions
✅ **Global Undo/Redo** - Works across all users
✅ **Conflict-Free** - Server is authoritative
✅ **Auto-Reconnect** - Handles disconnections
✅ **Multi-Room** - Separate canvases per room ID

---

## Tech Stack

**Frontend:** HTML5, CSS3, Vanilla JS, Canvas API, Socket.IO
**Backend:** Node.js, Express, Socket.IO
**Deployment:** Vercel (frontend), Railway (backend)

---

## Testing Checklist

- [x] Single user draws smoothly
- [x] Multi-user sync works (2+ windows)
- [x] Ghost cursors appear & move
- [x] Undo removes one user's stroke
- [x] All users see same state after undo
- [x] Reconnection works
- [x] Keyboard shortcuts work (Ctrl+Z, Y, L)
- [x] Touch events work on mobile

---

**That's it!** The architecture is simple, clean, and scalable. 🚀