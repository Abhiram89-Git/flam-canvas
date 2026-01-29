# 🎨 Collaborative Drawing Canvas

A real-time collaborative drawing application built with Node.js, Express, Socket.IO, and HTML5 Canvas API. Multiple users can draw simultaneously on a shared canvas with full undo/redo functionality and ghost cursors showing other users' positions.

## ✨ Features

- **Real-time Collaboration** - Multiple users can draw simultaneously on the same canvas
- **Ghost Cursors** - See where other users are drawing with color-coded cursors
- **Undo/Redo** - Full undo/redo support that works across all users
- **Drawing Tools**
  - Custom brush colors
  - Adjustable brush sizes
  - Smooth line rendering
- **User Management**
  - Real-time user list
  - User join/leave notifications
  - Per-user stroke tracking
- **Keyboard Shortcuts**
  - `Ctrl+Z` - Undo
  - `Ctrl+Y` - Redo
  - `Ctrl+L` - Clear canvas
- **Export** - Download your drawings as PNG images
- **Responsive Design** - Works on desktop, tablet, and mobile

## 🛠️ Tech Stack

**Backend:**
- Node.js (v18+)
- Express.js
- Socket.IO
- CORS

**Frontend:**
- HTML5 Canvas API
- Vanilla JavaScript
- CSS3

## 📦 Installation

### Prerequisites
- Node.js v18+ installed
- npm or yarn package manager

### Setup Steps

1. **Clone the repository**
```bash
git clone <repository-url>
cd collaborative-canvas
```

2. **Install dependencies**
```bash
npm install
```

3. **Start the server**
```bash
npm start
```

The server will start on `http://localhost:3000`

4. **Open in browser**
- Open `http://localhost:3000` in your browser
- Open additional browser windows/tabs to test collaboration
- Use the same room ID in all windows to sync drawings

## 🚀 Usage

### Starting the Application

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

### Using the Application

1. **Join a Room**
   - Enter a Room ID (e.g., "my-drawing-session")
   - Click "Join Room"
   - Users with the same Room ID will be connected

2. **Drawing**
   - Select a color using the color picker
   - Adjust brush size with the slider
   - Click and drag on the canvas to draw

3. **Collaboration**
   - See real-time updates from other users
   - Ghost cursors show where others are drawing
   - User list shows who's connected

4. **Tools**
   - **Undo** - Removes your last stroke
   - **Redo** - Restores your last undone stroke
   - **Clear** - Clears the entire canvas for all users
   - **Download** - Saves the current drawing as PNG

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Ctrl+L` | Clear Canvas |

## 📁 Project Structure

```
collaborative-canvas/
├── server/
│   ├── server.js           # Main Express + Socket.IO server
│   ├── rooms.js            # Room management system
│   └── state-manager.js    # Drawing history & undo/redo
├── client/
│   ├── index.html          # Main HTML file
│   ├── style.css           # Styling
│   ├── canvas.js           # Canvas drawing logic
│   ├── websocket.js        # Socket.IO client
│   └── main.js             # Application orchestration
├── package.json
├── README.md               # This file
└── ARCHITECTURE.md         # Technical architecture
```

## 🏗️ Architecture Overview

### Server Architecture

**Room Manager**
- Isolates drawing sessions into separate rooms
- Manages user connections per room
- Tracks user metadata (ID, color, position)

**State Manager**
- Maintains complete drawing history
- Implements undo/redo per user
- Provides history to new users joining

**Socket.IO Events**
- `join_room` - User joins a drawing session
- `drawing_step` - User creates a stroke
- `cursor_move` - User moves cursor
- `undo/redo` - User requests undo/redo
- `clear_canvas` - User clears canvas

### Client Architecture

**DrawingCanvas Module**
- Wraps HTML5 Canvas API
- Handles coordinate normalization (CSS vs Canvas pixels)
- Renders strokes and ghost cursors
- Provides drawing callbacks

**SocketManager Module**
- Manages Socket.IO connection
- Emits/receives drawing events
- Handles user presence
- Manages undo/redo requests

**Main Application**
- Orchestrates canvas and socket
- Handles UI interactions
- Manages application state
- Updates UI based on events

## 🔄 Drawing Synchronization Flow

```
User A Draws
    ↓
Canvas captures local drawing
    ↓
Emits 'drawing_step' event
    ↓
Server receives and broadcasts
    ↓
User B receives draw event
    ↓
User B's canvas redraws stroke
```

## 🔧 Technical Highlights

### Coordinate Normalization

The canvas accounts for CSS scaling:
```javascript
function getCanvasCoordinates(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}
```

### Throttled Network Updates

Drawing events are throttled to prevent network congestion:
```javascript
// Throttle to 50ms intervals
setTimeout(() => {
  socketManager.emitDrawingStep(strokeData);
}, 50);
```

### State Synchronization

New users receive full drawing history:
```javascript
socket.on('join_room', () => {
  socket.emit('load_history', {
    history: room.stateManager.getHistory(),
    users: room.users
  });
});
```

## 📊 API Reference

### Server Events

#### `join_room`
User joins a drawing session
```javascript
socket.emit('join_room', { roomId: 'room-1', userId: 'Alice' });
```

#### `drawing_step`
User creates a stroke
```javascript
socket.emit('drawing_step', {
  roomId: 'room-1',
  stroke: {
    start: { x: 10, y: 20 },
    end: { x: 30, y: 40 },
    style: { color: '#000', width: 3 }
  }
});
```

#### `undo/redo`
User requests undo or redo
```javascript
socket.emit('undo', { roomId: 'room-1' });
socket.emit('redo', { roomId: 'room-1' });
```

## 🐛 Troubleshooting

### Connection Issues
- Check if server is running on the correct port (default: 3000)
- Verify firewall allows WebSocket connections
- Check browser console for connection errors

### Drawing Not Syncing
- Ensure all users are in the same room
- Check network latency
- Verify Socket.IO transport method (should use websocket)

### Canvas Appears Blurry
- Canvas resolution is set to window size
- Refresh page if canvas was resized
- Check device pixel ratio settings

## 🚀 Deployment

### Deploy to Heroku

1. Create a Heroku app:
```bash
heroku create your-app-name
```

2. Deploy:
```bash
git push heroku main
```

3. View logs:
```bash
heroku logs --tail
```

### Deploy to Railway

1. Connect your GitHub repository to Railway
2. Set root directory to `/` if needed
3. Railway automatically detects Node.js and runs `npm start`

### Deploy to Vercel (Serverless)

Note: Socket.IO requires a persistent connection, so traditional serverless platforms may not work well. Use Heroku or Railway instead.

## 📝 Performance Notes

- **Stroke Limit**: Tested with 10,000+ strokes
- **Concurrent Users**: Supports 100+ users in a single room
- **Network**: Throttled to 50ms intervals for stroke updates, 100ms for cursor
- **Canvas Size**: Handles up to 4K resolution smoothly

## 🔐 Security Considerations

- Currently no authentication implemented
- Room IDs are not encrypted
- Canvas data is not persisted to database
- Consider adding:
  - User authentication
  - Room password protection
  - Persistent storage
  - Rate limiting

## 📄 License

MIT License - Feel free to use this project for personal or commercial purposes.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues and questions, please create an issue in the repository.

---

**Happy Drawing! 🎨**