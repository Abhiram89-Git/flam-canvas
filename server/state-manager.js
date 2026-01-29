class StateManager {
  constructor() {
    this.history = [];
    this.undoStack = {}; // Stack for undo operations
    this.redoStack = {}; // Stack for redo operations
    this.userStrokes = new Map(); // Track strokes by user for targeted undo
  }

  /**
   * Add a stroke to the history
   * @param {Object} stroke - The stroke object containing drawing data
   */
  addStroke(stroke) {
    // When a new stroke is added, clear the redo stack
    this.redoStack = {};

    // Add to main history
    this.history.push(stroke);

    // Track strokes by user
    if (!this.userStrokes.has(stroke.userId)) {
      this.userStrokes.set(stroke.userId, []);
    }
    this.userStrokes.get(stroke.userId).push(stroke);
  }

  /**
   * Get the complete drawing history
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Undo the last stroke by a specific user
   * @param {String} userId - The ID of the user
   * @returns {Object} The undone stroke or null
   */
  undoLastStrokeByUser(userId) {
    // Find the last stroke by this user
    let lastStrokeIndex = -1;
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].userId === userId) {
        lastStrokeIndex = i;
        break;
      }
    }

    if (lastStrokeIndex === -1) {
      return null; // No stroke to undo
    }

    // Remove the stroke from history
    const undoneStroke = this.history.splice(lastStrokeIndex, 1)[0];

    // Add to undo stack for this user
    if (!this.undoStack[userId]) {
      this.undoStack[userId] = [];
    }
    this.undoStack[userId].push(undoneStroke);

    // Update user strokes
    const userStrokesList = this.userStrokes.get(userId);
    if (userStrokesList) {
      userStrokesList.pop();
    }

    return undoneStroke;
  }

  /**
   * Redo the last undone stroke by a specific user
   * @param {String} userId - The ID of the user
   * @returns {Object} The redone stroke or null
   */
  redoStrokeByUser(userId) {
    if (!this.undoStack[userId] || this.undoStack[userId].length === 0) {
      return null; // Nothing to redo
    }

    const redoStroke = this.undoStack[userId].pop();
    
    // Add back to history
    this.history.push(redoStroke);

    // Update user strokes
    if (!this.userStrokes.has(userId)) {
      this.userStrokes.set(userId, []);
    }
    this.userStrokes.get(userId).push(redoStroke);

    return redoStroke;
  }

  /**
   * Clear all drawing history
   */
  clearHistory() {
    this.history = [];
    this.undoStack = {};
    this.redoStack = {};
    this.userStrokes.clear();
  }

  /**
   * Get stroke count for analytics
   */
  getStrokeCount() {
    return this.history.length;
  }

  /**
   * Get user stroke count
   */
  getUserStrokeCount(userId) {
    return this.userStrokes.get(userId)?.length || 0;
  }

  /**
   * Get all strokes by a specific user
   */
  getStrokesByUser(userId) {
    return this.userStrokes.get(userId) || [];
  }

  /**
   * Check if user can undo
   */
  canUndo(userId) {
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].userId === userId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if user can redo
   */
  canRedo(userId) {
    return this.undoStack[userId] && this.undoStack[userId].length > 0;
  }
}

module.exports = StateManager;