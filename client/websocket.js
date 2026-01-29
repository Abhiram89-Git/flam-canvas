class SocketManager {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.currentRoom = null;
    this.userId = null;
    this.users = [];

    // Callbacks (set by main app)
    this.onConnect = null;
    this.onDisconnect = null;
    this.onDrawEvent = null;
    this.onCursorMove = null;
    this.onUserJoined = null;
    this.onUserLeft = null;
    this.onUsersUpdated = null;
    this.onHistoryLoaded = null;
    this.onHistoryUpdated = null;
    this.onCanvasCleared = null;
  }

  /**
   * Connect to socket server
   */
  connect() {
    console.log('[SOCKET] Connecting to server...');
    this.socket = io("https://flam-canvas.up.railway.app");

    // Connection events
    this.socket.on('connect', () => {
      console.log('[SOCKET] Connected to server, id:', this.socket.id);
      this.isConnected = true;
      if (this.onConnect) {
        this.onConnect();
      }
    });

    this.socket.on('disconnect', () => {
      console.log('[SOCKET] Disconnected from server');
      this.isConnected = false;
      if (this.onDisconnect) {
        this.onDisconnect();
      }
    });

    // Drawing events
    this.socket.on('draw_event', ({ userId, stroke }) => {
      console.log('[SOCKET] Draw event received');
      if (this.onDrawEvent) {
        this.onDrawEvent({ userId, stroke });
      }
    });

    // Cursor events
    this.socket.on('cursor_moved', ({ userId, userColor, userName, x, y }) => {
      if (this.onCursorMove) {
        this.onCursorMove({ userId, userColor, userName, x, y });
      }
    });

    // User events
    this.socket.on('user_joined', ({ user, totalUsers }) => {
      console.log('[SOCKET] User joined');
      if (this.onUserJoined) {
        this.onUserJoined({ user, totalUsers });
      }
    });

    this.socket.on('user_left', ({ userId, totalUsers }) => {
      console.log('[SOCKET] User left');
      if (this.onUserLeft) {
        this.onUserLeft({ userId, totalUsers });
      }
    });

    this.socket.on('users_updated', ({ users }) => {
      console.log('[SOCKET] Users updated');
      this.users = users;
      if (this.onUsersUpdated) {
        this.onUsersUpdated({ users });
      }
    });

    // History load event
    this.socket.on('load_history', ({ history, users }) => {
      console.log('[SOCKET] History loaded:', history.length);
      this.users = users;
      if (this.onHistoryLoaded) {
        this.onHistoryLoaded({ history, users });
      }
    });

    // CRITICAL: History updated event (for undo/redo)
    this.socket.on('history_updated', (data) => {
      console.log('[SOCKET] *** HISTORY_UPDATED EVENT RECEIVED ***');
      console.log('[SOCKET] Data:', data);
      console.log('[SOCKET] Action:', data.action);
      console.log('[SOCKET] History length:', data.history.length);
      
      if (this.onHistoryUpdated) {
        console.log('[SOCKET] Calling onHistoryUpdated callback');
        this.onHistoryUpdated({ 
          userId: data.userId, 
          history: data.history,
          action: data.action
        });
      } else {
        console.log('[SOCKET] WARNING: onHistoryUpdated callback not set!');
      }
    });

    // Clear canvas event
    this.socket.on('canvas_cleared', ({ userId }) => {
      console.log('[SOCKET] Canvas cleared');
      if (this.onCanvasCleared) {
        this.onCanvasCleared({ userId });
      }
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('[SOCKET] Socket error:', error);
    });
  }

  /**
   * Join a room
   */
  joinRoom(roomId, userId) {
    if (!this.isConnected) {
      console.error('[SOCKET] Not connected to server');
      return;
    }

    this.currentRoom = roomId;
    this.userId = userId;

    console.log('[SOCKET] Joining room:', roomId, 'as user:', userId);
    this.socket.emit('join_room', { roomId, userId });
  }

  /**
   * Emit a drawing step
   */
  emitDrawingStep(stroke) {
    if (!this.isConnected || !this.currentRoom) {
      return;
    }

    this.socket.emit('drawing_step', {
      roomId: this.currentRoom,
      stroke: stroke
    });
  }

  /**
   * Emit cursor movement
   */
  emitCursorMove(x, y) {
    if (!this.isConnected || !this.currentRoom) {
      return;
    }

    this.socket.emit('cursor_move', {
      roomId: this.currentRoom,
      x: x,
      y: y
    });
  }

  /**
   * Request undo on server
   */
  requestUndo() {
    if (!this.isConnected || !this.currentRoom) {
      console.error('[SOCKET] Cannot undo: not connected or no room');
      return;
    }

    console.log('[SOCKET] *** SENDING UNDO REQUEST ***');
    console.log('[SOCKET] Room:', this.currentRoom);
    this.socket.emit('undo', { roomId: this.currentRoom });
  }

  /**
   * Request redo on server
   */
  requestRedo() {
    if (!this.isConnected || !this.currentRoom) {
      console.error('[SOCKET] Cannot redo: not connected or no room');
      return;
    }

    console.log('[SOCKET] *** SENDING REDO REQUEST ***');
    console.log('[SOCKET] Room:', this.currentRoom);
    this.socket.emit('redo', { roomId: this.currentRoom });
  }

  /**
   * Request canvas clear
   */
  requestClearCanvas() {
    if (!this.isConnected || !this.currentRoom) {
      console.error('[SOCKET] Cannot clear: not connected or no room');
      return;
    }

    console.log('[SOCKET] Requesting canvas clear');
    this.socket.emit('clear_canvas', { roomId: this.currentRoom });
  }

  /**
   * Get connected users
   */
  getUsers() {
    return this.users || [];
  }
}