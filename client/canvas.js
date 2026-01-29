/**
 * Canvas Drawing Module
 * Handles all canvas rendering and drawing logic
 */

class DrawingCanvas {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    
    // State
    this.isDrawing = false;
    this.currentColor = '#000000';
    this.currentStrokeWidth = 3;
    this.lastPosition = { x: 0, y: 0 };
    
    // History for undo/redo
    this.drawingHistory = [];
    
    // Ghost cursors (other users)
    this.ghostCursors = new Map();
    
    // Event listeners
    this.onStrokeStart = null;
    this.onStrokeMove = null;
    this.onStrokeEnd = null;
    
    this.setupCanvas();
    this.setupEventListeners();
  }

  /**
   * Setup canvas size and context
   */
  setupCanvas() {
    // Get parent container
    const container = this.canvas.parentElement;
    if (!container) return;
    
    // Set canvas size to fill container
    const rect = container.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    
    // Set up context properties
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.antialiasing = true;
  }

  /**
   * Setup event listeners for drawing
   */
  setupEventListeners() {
    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.handlePointerDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handlePointerMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handlePointerUp(e));
    this.canvas.addEventListener('mouseout', (e) => this.handlePointerOut(e));

    // Touch events (for mobile)
    this.canvas.addEventListener('touchstart', (e) => this.handlePointerDown(e));
    this.canvas.addEventListener('touchmove', (e) => this.handlePointerMove(e));
    this.canvas.addEventListener('touchend', (e) => this.handlePointerUp(e));

    // Window resize
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });
  }

  /**
   * Get accurate canvas coordinates from mouse/touch event
   * This accounts for CSS scaling and pixel ratio
   * @param {Event} event - Mouse or touch event
   * @returns {Object} Normalized coordinates {x, y}
   */
  getCanvasCoordinates(event) {
    const rect = this.canvas.getBoundingClientRect();
    
    // Get the actual pointer position
    let clientX, clientY;
    
    if (event.touches) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    // Calculate scale factors
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    // Return normalized coordinates
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  /**
   * Handle pointer down event (start drawing)
   */
  handlePointerDown(e) {
    e.preventDefault();
    this.isDrawing = true;
    this.lastPosition = this.getCanvasCoordinates(e);

    // Callback for parent class
    if (this.onStrokeStart) {
      this.onStrokeStart({
        x: this.lastPosition.x,
        y: this.lastPosition.y,
        color: this.currentColor,
        width: this.currentStrokeWidth
      });
    }
  }

  /**
   * Handle pointer move event (draw)
   */
  handlePointerMove(e) {
    const currentPosition = this.getCanvasCoordinates(e);

    if (this.isDrawing) {
      // Draw locally
      this.drawLine(
        this.lastPosition.x,
        this.lastPosition.y,
        currentPosition.x,
        currentPosition.y,
        this.currentColor,
        this.currentStrokeWidth
      );

      // Callback for parent class
      if (this.onStrokeMove) {
        this.onStrokeMove({
          start: this.lastPosition,
          end: currentPosition,
          color: this.currentColor,
          width: this.currentStrokeWidth
        });
      }

      this.lastPosition = currentPosition;
    }

    // Emit cursor position even when not drawing
    if (this.onCursorMove) {
      this.onCursorMove({
        x: currentPosition.x,
        y: currentPosition.y
      });
    }
  }

  /**
   * Handle pointer up event (end drawing)
   */
  handlePointerUp(e) {
    if (this.isDrawing && this.onStrokeEnd) {
      this.onStrokeEnd();
    }
    this.isDrawing = false;
  }

  /**
   * Handle pointer out event
   */
  handlePointerOut(e) {
    if (this.isDrawing && this.onStrokeEnd) {
      this.onStrokeEnd();
    }
    this.isDrawing = false;
  }

  /**
   * Draw a line on the canvas
   * @param {number} fromX - Start X coordinate
   * @param {number} fromY - Start Y coordinate
   * @param {number} toX - End X coordinate
   * @param {number} toY - End Y coordinate
   * @param {string} color - Line color (hex or rgb)
   * @param {number} width - Line width in pixels
   */
  drawLine(fromX, fromY, toX, toY, color = this.currentColor, width = this.currentStrokeWidth) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.beginPath();
    this.ctx.moveTo(fromX, fromY);
    this.ctx.lineTo(toX, toY);
    this.ctx.stroke();
    this.ctx.closePath();
  }

  /**
   * Draw a stroke (line segment)
   * @param {Object} stroke - Stroke object containing start, end, style
   */
  drawStroke(stroke) {
    if (!stroke.start || !stroke.end || !stroke.style) {
      return;
    }

    this.drawLine(
      stroke.start.x,
      stroke.start.y,
      stroke.end.x,
      stroke.end.y,
      stroke.style.color,
      stroke.style.width
    );
  }

  /**
   * Redraw all strokes from history
   * @param {Array} strokes - Array of stroke objects
   */
  redrawCanvas(strokes) {
    // Clear canvas
    this.clearCanvas();

    // Redraw all strokes
    strokes.forEach(stroke => {
      this.drawStroke(stroke);
    });
  }

  /**
   * Clear the entire canvas
   */
  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawingHistory = [];
  }

  /**
   * Update drawing color
   */
  setColor(color) {
    this.currentColor = color;
  }

  /**
   * Update stroke width
   */
  setStrokeWidth(width) {
    this.currentStrokeWidth = width;
  }

  /**
   * Resize canvas to fit window
   */
  resizeCanvas() {
    // Save current canvas content
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

    // Resize canvas
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

    // Restore canvas content
    this.ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Add a ghost cursor for another user
   * @param {string} userId - User ID
   * @param {string} color - Cursor color
   * @param {string} userName - User name
   */
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

  /**
   * Update ghost cursor position
   * @param {string} userId - User ID
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   */
  updateGhostCursor(userId, x, y) {
    let cursor = this.ghostCursors.get(userId);

    if (!cursor) {
      return;
    }

    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';
  }

  /**
   * Remove a ghost cursor
   * @param {string} userId - User ID
   */
  removeGhostCursor(userId) {
    const cursor = this.ghostCursors.get(userId);
    if (cursor) {
      cursor.remove();
      this.ghostCursors.delete(userId);
    }
  }

  /**
   * Get canvas as image data (for download)
   * @returns {string} Data URL of canvas
   */
  getCanvasAsImage() {
    return this.canvas.toDataURL('image/png');
  }

  /**
   * Download canvas as image file
   * @param {string} filename - Name of the file to download
   */
  downloadAsImage(filename = 'drawing.png') {
    const link = document.createElement('a');
    link.href = this.getCanvasAsImage();
    link.download = filename;
    link.click();
  }

  /**
   * Get canvas image as blob (useful for server upload)
   * @returns {Promise<Blob>} Canvas as blob
   */
  getCanvasAsBlob() {
    return new Promise((resolve) => {
      this.canvas.toBlob(resolve, 'image/png');
    });
  }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DrawingCanvas;
}