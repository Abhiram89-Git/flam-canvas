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
    this.colorPicker.addEventListener('change', (e) => {
      this.drawingCanvas.setColor(e.target.value);
    });

    this.brushSize.addEventListener('input', (e) => {
      const size = e.target.value;
      this.drawingCanvas.setStrokeWidth(size);
      this.sizeDisplay.textContent = size + 'px';
    });

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
    this.drawingCanvas.onStrokeComplete = (stroke) => {
      // When a complete stroke is drawn, send it
      if (this.currentRoomId && this.socketManager.isConnected) {
        console.log('[APP] Sending stroke with', stroke.points.length, 'points');
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
      this.updateStatus('Disconnected', false);
    };

    this.socketManager.onDrawEvent = ({ userId, stroke }) => {
      console.log('[APP] Draw event - stroke points:', stroke.points ? stroke.points.length : 'unknown');
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

const style = document.createElement('style');
style.textContent = '@keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }';