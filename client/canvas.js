class DrawingCanvas {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    
    this.isDrawing = false;
    this.currentColor = '#000000';
    this.currentStrokeWidth = 3;
    this.currentTool = 'brush'; // 'brush' or 'eraser'
    this.lastPosition = { x: 0, y: 0 };
    this.currentStrokePoints = [];
    
    this.ghostCursors = new Map();
    
    this.onStrokeComplete = null;
    this.onCursorMove = null;
    
    this.setupCanvas();
    this.setupEventListeners();
  }

  setupCanvas() {
    const container = this.canvas.parentElement;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  setupEventListeners() {
    this.canvas.addEventListener('mousedown', (e) => this.handlePointerDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handlePointerMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handlePointerUp(e));
    this.canvas.addEventListener('mouseout', (e) => this.handlePointerOut(e));

    this.canvas.addEventListener('touchstart', (e) => this.handlePointerDown(e));
    this.canvas.addEventListener('touchmove', (e) => this.handlePointerMove(e));
    this.canvas.addEventListener('touchend', (e) => this.handlePointerUp(e));
  }

  getCanvasCoordinates(event) {
    const rect = this.canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if (event.touches) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  handlePointerDown(e) {
    e.preventDefault();
    this.isDrawing = true;
    this.lastPosition = this.getCanvasCoordinates(e);
    this.currentStrokePoints = [{ x: this.lastPosition.x, y: this.lastPosition.y }];
  }

  handlePointerMove(e) {
    const currentPosition = this.getCanvasCoordinates(e);

    if (this.isDrawing) {
      if (this.currentTool === 'eraser') {
        this.erase(
          this.lastPosition.x,
          this.lastPosition.y,
          currentPosition.x,
          currentPosition.y,
          this.currentStrokeWidth
        );
      } else {
        this.drawLine(
          this.lastPosition.x,
          this.lastPosition.y,
          currentPosition.x,
          currentPosition.y,
          this.currentColor,
          this.currentStrokeWidth
        );
      }

      this.currentStrokePoints.push({ x: currentPosition.x, y: currentPosition.y });
      this.lastPosition = currentPosition;
    }

    if (this.onCursorMove) {
      this.onCursorMove(currentPosition);
    }
  }

  handlePointerUp(e) {
    if (this.isDrawing) {
      const stroke = {
        points: this.currentStrokePoints,
        color: this.currentTool === 'eraser' ? 'eraser' : this.currentColor,
        width: this.currentStrokeWidth,
        tool: this.currentTool
      };
      
      if (this.onStrokeComplete) {
        this.onStrokeComplete(stroke);
      }
    }
    
    this.isDrawing = false;
    this.currentStrokePoints = [];
  }

  handlePointerOut(e) {
    if (this.isDrawing) {
      const stroke = {
        points: this.currentStrokePoints,
        color: this.currentTool === 'eraser' ? 'eraser' : this.currentColor,
        width: this.currentStrokeWidth,
        tool: this.currentTool
      };
      
      if (this.onStrokeComplete) {
        this.onStrokeComplete(stroke);
      }
    }
    
    this.isDrawing = false;
    this.currentStrokePoints = [];
  }

  drawLine(fromX, fromY, toX, toY, color, width) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.globalCompositeOperation = 'source-over';

    this.ctx.beginPath();
    this.ctx.moveTo(fromX, fromY);
    this.ctx.lineTo(toX, toY);
    this.ctx.stroke();
  }

  erase(fromX, fromY, toX, toY, width) {
    this.ctx.lineWidth = width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.globalCompositeOperation = 'destination-out';

    this.ctx.beginPath();
    this.ctx.moveTo(fromX, fromY);
    this.ctx.lineTo(toX, toY);
    this.ctx.stroke();

    this.ctx.globalCompositeOperation = 'source-over';
  }

  drawStroke(stroke) {
    if (!stroke || !stroke.points || stroke.points.length === 0) {
      return;
    }

    if (stroke.tool === 'eraser' || stroke.color === 'eraser') {
      this.ctx.lineWidth = stroke.width || 3;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.globalCompositeOperation = 'destination-out';

      this.ctx.beginPath();
      this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length; i++) {
        this.ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }

      this.ctx.stroke();
      this.ctx.globalCompositeOperation = 'source-over';
    } else {
      this.ctx.strokeStyle = stroke.color || '#000000';
      this.ctx.lineWidth = stroke.width || 3;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.globalCompositeOperation = 'source-over';

      this.ctx.beginPath();
      this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length; i++) {
        this.ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }

      this.ctx.stroke();
    }
  }

  redrawCanvas(strokes) {
    this.clearCanvas();

    if (!strokes || strokes.length === 0) {
      return;
    }

    strokes.forEach(stroke => {
      this.drawStroke(stroke);
    });
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  setColor(color) {
    this.currentColor = color;
  }

  setStrokeWidth(width) {
    this.currentStrokeWidth = width;
  }

  setTool(tool) {
    this.currentTool = tool;
  }

  getTool() {
    return this.currentTool;
  }

  addGhostCursor(userId, color, userName) {
    const cursor = document.createElement('div');
    cursor.className = 'ghost-cursor';
    cursor.style.borderColor = color;
    cursor.style.backgroundColor = color;
    cursor.textContent = userName.charAt(0).toUpperCase();
    cursor.id = `cursor-${userId}`;

    const container = document.getElementById('cursorContainer');
    if (container) {
      container.appendChild(cursor);
      this.ghostCursors.set(userId, cursor);
    }
  }

  updateGhostCursor(userId, x, y) {
    let cursor = this.ghostCursors.get(userId);
    if (cursor) {
      cursor.style.left = x + 'px';
      cursor.style.top = y + 'px';
    }
  }

  removeGhostCursor(userId) {
    const cursor = this.ghostCursors.get(userId);
    if (cursor) {
      cursor.remove();
      this.ghostCursors.delete(userId);
    }
  }

  downloadAsImage(filename = 'drawing.png') {
    const link = document.createElement('a');
    link.href = this.canvas.toDataURL('image/png');
    link.download = filename;
    link.click();
  }
}