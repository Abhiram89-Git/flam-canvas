const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const http = require('http');
const path = require('path');
const RoomManager = require('./rooms.js');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:3001',
      'https://flam-canvas.vercel.app',
      'https://*.vercel.app'
    ],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:3001',
    'https://flam-canvas.vercel.app',
    'https://*.vercel.app'
  ],
  credentials: true
}));
app.use(express.json());

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// Initialize room manager
const roomManager = new RoomManager();

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(` User connected: ${socket.id}`);

  // User joins a room
  socket.on('join_room', ({ roomId, userId }) => {
    socket.join(roomId);
    socket.userData = { roomId, userId };

    // Get or create room
    let room = roomManager.getRoom(roomId);
    if (!room) {
      room = roomManager.createRoom(roomId);
    }

    // Add user to room
    room.addUser({ id: socket.id, userId, color: generateRandomColor() });

    console.log(` ${userId} joined room ${roomId}`);
    console.log(` Room ${roomId} has ${room.users.length} users`);

    // Send drawing history to the new user
    socket.emit('load_history', {
      history: room.stateManager.getHistory(),
      users: room.users
    });

    // Broadcast user list to all in room
    io.to(roomId).emit('users_updated', { users: room.users });

    // Broadcast that a user joined
    socket.broadcast.to(roomId).emit('user_joined', {
      user: room.getUserById(socket.id),
      totalUsers: room.users.length
    });
  });

  // Handle drawing events
  socket.on('drawing_step', ({ roomId, stroke }) => {
    console.log(' Drawing step received');
    const room = roomManager.getRoom(roomId);
    if (room) {
      stroke.userId = socket.id;
      // Add to room history
      room.stateManager.addStroke(stroke);
      
      // Broadcast to all users in the room (including sender)
      io.to(roomId).emit('draw_event', {
        userId: socket.id,
        stroke: stroke
      });
    }
  });

  // Handle cursor movement
  socket.on('cursor_move', ({ roomId, x, y }) => {
    const room = roomManager.getRoom(roomId);
    if (room) {
      const user = room.getUserById(socket.id);
      if (user) {
        user.cursor = { x, y };
        
        // Broadcast cursor position to others (not self)
        socket.broadcast.to(roomId).emit('cursor_moved', {
          userId: socket.id,
          userColor: user.color,
          userName: user.userId,
          x: x,
          y: y
        });
      }
    }
  });

  // Handle undo
  socket.on('undo', ({ roomId }) => {
    console.log(' UNDO REQUEST received for room:', roomId);
    const room = roomManager.getRoom(roomId);
    if (room) {
      console.log(' Room found, current history:', room.stateManager.getHistory().length);
      const undoneStroke = room.stateManager.undoLastStrokeByUser(socket.id);
      
      if (undoneStroke) {
        const newHistory = room.stateManager.getHistory();
        console.log(' Undo successful! New history length:', newHistory.length);
        
        // Send the FULL updated history so all clients can redraw correctly
        io.to(roomId).emit('history_updated', {
          userId: socket.id,
          history: newHistory,
          action: 'undo'
        });
      } else {
        console.log('Undo failed - no stroke to undo');
      }
    } else {
      console.log('Room not found:', roomId);
    }
  });

  // Handle redo
  socket.on('redo', ({ roomId }) => {
    console.log('REDO REQUEST received for room:', roomId);
    const room = roomManager.getRoom(roomId);
    if (room) {
      console.log('Room found, current history:', room.stateManager.getHistory().length);
      const redoStroke = room.stateManager.redoStrokeByUser(socket.id);
      
      if (redoStroke) {
        const newHistory = room.stateManager.getHistory();
        console.log('Redo successful! New history length:', newHistory.length);
        
        // Send the FULL updated history so all clients can redraw correctly
        io.to(roomId).emit('history_updated', {
          userId: socket.id,
          history: newHistory,
          action: 'redo'
        });
      } else {
        console.log(' Redo failed - no stroke to redo');
      }
    } else {
      console.log(' Room not found:', roomId);
    }
  });

  // Clear canvas (by current user)
  socket.on('clear_canvas', ({ roomId }) => {
    console.log('Clear canvas requested');
    const room = roomManager.getRoom(roomId);
    if (room) {
      room.stateManager.clearHistory();
      io.to(roomId).emit('canvas_cleared', { userId: socket.id });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    if (socket.userData) {
      const { roomId, userId } = socket.userData;
      const room = roomManager.getRoom(roomId);
      
      if (room) {
        room.removeUser(socket.id);
        console.log(`${userId} left room ${roomId}`);
        console.log(`Room ${roomId} now has ${room.users.length} users`);
        
        // If room is empty, delete it
        if (room.users.length === 0) {
          roomManager.deleteRoom(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        } else {
          io.to(roomId).emit('users_updated', { users: room.users });
          io.to(roomId).emit('user_left', {
            userId: socket.id,
            totalUsers: room.users.length
          });
        }
      }
    }
    console.log(` User disconnected: ${socket.id}`);
  });
});

// Helper function to generate random colors
function generateRandomColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
});