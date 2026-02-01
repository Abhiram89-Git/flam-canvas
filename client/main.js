class CollaborativeDrawingApp {
  constructor() {
    this.canvas = document.getElementById('drawingCanvas');
    this.statusEl = document.getElementById('status');
    this.colorPicker = document.getElementById('colorPicker');
    this.brushSize = document.getElementById('brushSize');
    this.sizeDisplay = document.getElementById('sizeDisplay');
    this.brushBtn = document.getElementById('brushBtn');
    this.eraserBtn = document.getElementById('eraserBtn');
    this.undoBtn = document.getElementById('undoBtn');
    this.redoBtn = document.getElementById('redoBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.downloadBtn = document.getElementById('downloadBtn');
    this.joinBtn = document.getElementById('joinBtn');
    this.roomInput = document.getElementById('roomInput');
    this.userList = document.getElementById('userList');
    this.strokeCount = document.getElementById('strokeCount');
    this.userCount = document.getElementById('userCount');

    this.drawingCanvas = new DrawingCanvas(this.canvas);
    this.socketManager = new SocketManager();

    this.allStrokes = [];
    this.throttleTimer = null;
    this.cursorThrottleTimer = null;
    this.currentRoomId = null;

    // Setup callbacks BEFORE connecting
    this.setupSocketCallbacks();
    this.init();
  }

  init() {
    console.log('[APP] Starting');
    this.setupUIListeners();
    this.setupCanvasCallbacks();
    this.socketManager.connect();
    this.setupKeyboardShortcuts();
    this.resizeCanvasToFitWindow();
    window.addEventListener('resize', () => this.resizeCanvasToFitWindow());
  }

  setupUIListeners() {
    // Tool selection
    this.brushBtn.addEventListener('click', () => {
      this.drawingCanvas.setTool('brush');
      this.brushBtn.classList.add('active');
      this.eraserBtn.classList.remove('active');
      this.showNotification('Brush selected');
    });

    this.eraserBtn.addEventListener('click', () => {
      this.drawingCanvas.setTool('eraser');
      this.eraserBtn.classList.add('active');
      this.brushBtn.classList.remove('active');
      this.showNotification('Eraser selected');
    });

    // Color picker
    this.colorPicker.addEventListener('change', (e) => {
      this.drawingCanvas.setColor(e.target.value);
    });

    // Brush size
    this.brushSize.addEventListener('input', (e) => {
      const size = e.target.value;
      this.drawingCanvas.setStrokeWidth(size);
      this.sizeDisplay.textContent = size + 'px';
    });

    // Undo/Redo buttons
    this.undoBtn.addEventListener('click', () => {
      if (!this.currentRoomId) {
        alert('Join a room first!');
        return;
      }
      this.socketManager.requestUndo();
    });

    this.redoBtn.addEventListener('click', () => {
      if (!this.currentRoomId) {
        alert('Join a room first!');
        return;
      }
      this.socketManager.requestRedo();
    });

    // Clear button
    this.clearBtn.addEventListener('click', () => {
      if (!this.currentRoomId) {
        alert('Join a room first!');
        return;
      }
      if (confirm('Clear canvas?')) {
        this.socketManager.requestClearCanvas();
      }
    });

    // Download button
    this.downloadBtn.addEventListener('click', () => {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      this.drawingCanvas.downloadAsImage(`drawing-${timestamp}.png`);
      this.showNotification('Downloaded!');
    });

    // Join room
    this.joinBtn.addEventListener('click', () => {
      this.joinRoom();
    });

    this.roomInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.joinRoom();
      }
    });
  }

  setupCanvasCallbacks() {
    this.drawingCanvas.onStrokeComplete = (stroke) => {
      // When a complete stroke is drawn, send it
      if (this.currentRoomId && this.socketManager.isConnected) {
        console.log('[APP] Sending stroke with', stroke.points.length, 'points, tool:', stroke.tool);
        this.socketManager.emitDrawingStep(stroke);
        this.allStrokes.push(stroke);
        this.updateStrokeCount();
      }
    };

    this.drawingCanvas.onCursorMove = (position) => {
      if (this.cursorThrottleTimer) {
        clearTimeout(this.cursorThrottleTimer);
      }

      this.cursorThrottleTimer = setTimeout(() => {
        if (this.currentRoomId && this.socketManager.isConnected) {
          this.socketManager.emitCursorMove(position.x, position.y);
        }
      }, 100);
    };
  }

  setupSocketCallbacks() {
    this.socketManager.onConnect = () => {
      console.log('[APP] Connected!');
      this.updateStatus('Connected', true);
      this.showNotification('Connected!');
    };

    this.socketManager.onDisconnect = () => {
      this.updateStatus('Connecting...', false);
    };

    this.socketManager.onDrawEvent = ({ userId, stroke }) => {
      console.log('[APP] Draw event - stroke points:', stroke.points ? stroke.points.length : 'unknown', 'tool:', stroke.tool);
      this.drawingCanvas.drawStroke(stroke);
      this.allStrokes.push(stroke);
      this.updateStrokeCount();
    };

    this.socketManager.onCursorMove = ({ userId, userColor, userName, x, y }) => {
      let cursor = this.drawingCanvas.ghostCursors.get(userId);
      if (!cursor) {
        this.drawingCanvas.addGhostCursor(userId, userColor, userName);
      }
      this.drawingCanvas.updateGhostCursor(userId, x, y);
    };

    this.socketManager.onUserJoined = () => {
      this.updateUserList();
    };

    this.socketManager.onUserLeft = () => {
      this.updateUserList();
    };

    this.socketManager.onUsersUpdated = ({ users }) => {
      this.updateUserList();
    };

    this.socketManager.onHistoryLoaded = ({ history, users }) => {
      console.log('[APP] History loaded:', history.length, 'strokes');
      this.allStrokes = history;
      this.drawingCanvas.redrawCanvas(history);
      this.updateStrokeCount();
      this.updateUserList();
    };

    this.socketManager.onHistoryUpdated = ({ userId, history, action }) => {
      console.log('[APP] History updated - action:', action, 'strokes:', history.length);
      
      this.allStrokes = history;
      this.drawingCanvas.redrawCanvas(history);
      this.updateStrokeCount();
      
      if (action === 'undo') {
        this.showNotification('Undone!');
      } else if (action === 'redo') {
        this.showNotification('Redone!');
      }
    };

    this.socketManager.onCanvasCleared = ({ userId }) => {
      this.allStrokes = [];
      this.drawingCanvas.clearCanvas();
      this.updateStrokeCount();
      this.showNotification('Cleared!');
    };
  }

  joinRoom() {
    const roomId = this.roomInput.value.trim();
    
    if (!roomId) {
      alert('Enter room ID');
      return;
    }

    const userId = 'User-' + Math.random().toString(36).substr(2, 9);
    this.currentRoomId = roomId;
    
    this.socketManager.joinRoom(roomId, userId);
    this.showNotification('Joined: ' + roomId);
  }

  updateStatus(text, isConnected) {
    this.statusEl.textContent = text;
    this.statusEl.className = isConnected ? 'status connected' : 'status disconnected';
  }

  updateUserList() {
    const users = this.socketManager.getUsers();
    if (users.length === 0) {
      this.userList.innerHTML = '<p class="placeholder">No users</p>';
      this.userCount.textContent = '0';
      return;
    }
    this.userList.innerHTML = users.map(u => '<div class="user-item" style="border-color:' + u.color + '"><div class="user-color-dot" style="background-color:' + u.color + '"></div><div class="user-name">' + u.userId + '</div></div>').join('');
    this.userCount.textContent = users.length;
  }

  updateStrokeCount() {
    this.strokeCount.textContent = this.allStrokes.length;
  }

  showNotification(msg) {
    const n = document.createElement('div');
    n.className = 'notification';
    n.textContent = msg;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (this.currentRoomId) this.socketManager.requestUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        if (this.currentRoomId) this.socketManager.requestRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        if (this.currentRoomId) {
          if (confirm('Clear canvas?')) {
            this.socketManager.requestClearCanvas();
          }
        }
      }
    });
  }

  resizeCanvasToFitWindow() {
    const container = this.canvas.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    this.canvas.width = width;
    this.canvas.height = height;
    if (this.allStrokes.length > 0) {
      this.drawingCanvas.redrawCanvas(this.allStrokes);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new CollaborativeDrawingApp();
});