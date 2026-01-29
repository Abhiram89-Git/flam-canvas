class CollaborativeDrawingApp {
  constructor() {
    this.canvas = document.getElementById('drawingCanvas');
    this.statusEl = document.getElementById('status');
    this.colorPicker = document.getElementById('colorPicker');
    this.brushSize = document.getElementById('brushSize');
    this.sizeDisplay = document.getElementById('sizeDisplay');
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

    // CRITICAL: SET UP CALLBACKS FIRST, BEFORE CONNECTING
    this.setupSocketCallbacks();
    this.init();
  }

  init() {
    console.log('[APP] Starting');
    this.setupUIListeners();
    this.setupCanvasCallbacks();
    // NOW connect after callbacks are set
    this.socketManager.connect();
    this.setupKeyboardShortcuts();
    this.resizeCanvasToFitWindow();
    window.addEventListener('resize', () => this.resizeCanvasToFitWindow());
  }

  setupUIListeners() {
    this.colorPicker.addEventListener('change', (e) => {
      this.drawingCanvas.setColor(e.target.value);
    });

    this.brushSize.addEventListener('input', (e) => {
      const size = e.target.value;
      this.drawingCanvas.setStrokeWidth(size);
      this.sizeDisplay.textContent = size + 'px';
    });

    this.undoBtn.addEventListener('click', () => {
      console.log('[APP] Undo button clicked');
      if (!this.currentRoomId) {
        alert('Join a room first!');
        return;
      }
      this.socketManager.requestUndo();
    });

    this.redoBtn.addEventListener('click', () => {
      console.log('[APP] Redo button clicked');
      if (!this.currentRoomId) {
        alert('Join a room first!');
        return;
      }
      this.socketManager.requestRedo();
    });

    this.clearBtn.addEventListener('click', () => {
      if (!this.currentRoomId) {
        alert('Join a room first!');
        return;
      }
      if (confirm('Clear canvas?')) {
        this.socketManager.requestClearCanvas();
      }
    });

    this.downloadBtn.addEventListener('click', () => {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      this.drawingCanvas.downloadAsImage(`drawing-${timestamp}.png`);
      this.showNotification('Downloaded!');
    });

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
    this.drawingCanvas.onStrokeStart = () => {
      console.log('[APP] Stroke start');
    };

    this.drawingCanvas.onStrokeMove = (strokeData) => {
      if (this.throttleTimer) {
        clearTimeout(this.throttleTimer);
      }

      this.throttleTimer = setTimeout(() => {
        if (this.currentRoomId && this.socketManager.isConnected) {
          this.socketManager.emitDrawingStep(strokeData);
        }
      }, 50);
    };

    this.drawingCanvas.onStrokeEnd = () => {
      console.log('[APP] Stroke end');
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
    console.log('[APP] Setting up socket callbacks BEFORE connect');

    this.socketManager.onConnect = () => {
      console.log('[APP] Connected!');
      this.updateStatus('Connected', true);
      this.showNotification('Connected!');
    };

    this.socketManager.onDisconnect = () => {
      console.log('[APP] Disconnected');
      this.updateStatus('Disconnected', false);
    };

    this.socketManager.onDrawEvent = ({ userId, stroke }) => {
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
      console.log('[APP] History loaded:', history.length);
      this.allStrokes = history;
      this.drawingCanvas.redrawCanvas(history);
      this.updateStrokeCount();
      this.updateUserList();
    };

    // CRITICAL: This callback MUST be set before connect!
    this.socketManager.onHistoryUpdated = ({ userId, history, action }) => {
      console.log('[APP] *** onHistoryUpdated CALLED ***');
      console.log('[APP] Action:', action);
      console.log('[APP] New history length:', history.length);
      
      // Update the history
      this.allStrokes = history;
      
      // Redraw the canvas
      this.drawingCanvas.redrawCanvas(history);
      
      // Update count
      this.updateStrokeCount();
      
      // Show notification
      if (action === 'undo') {
        this.showNotification('Undone! (' + history.length + ' strokes)');
      } else if (action === 'redo') {
        this.showNotification('Redone! (' + history.length + ' strokes)');
      }
    };

    this.socketManager.onCanvasCleared = ({ userId }) => {
      console.log('[APP] Canvas cleared');
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
    console.log('[APP] Joining room:', roomId);
    
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

console.log('[APP] Loading main.js');
document.addEventListener('DOMContentLoaded', () => {
  console.log('[APP] DOM ready');
  window.app = new CollaborativeDrawingApp();
  console.log('[APP] App initialized');
});

const style = document.createElement('style');
style.textContent = '@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }';
document.head.appendChild(style);