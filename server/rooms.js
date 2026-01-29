const StateManager = require('./state-manager.js');

class Room {
  constructor(roomId) {
    this.roomId = roomId;
    this.users = [];
    this.stateManager = new StateManager();
    this.createdAt = new Date();
  }

  addUser(user) {
    this.users.push(user);
  }

  removeUser(userId) {
    this.users = this.users.filter(u => u.id !== userId);
  }

  getUserById(userId) {
    return this.users.find(u => u.id === userId);
  }

  getUserCount() {
    return this.users.length;
  }
}

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Room(roomId));
      console.log(`[ROOMS] Created room: ${roomId}`);
    }
    return this.rooms.get(roomId);
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  deleteRoom(roomId) {
    if (this.rooms.has(roomId)) {
      this.rooms.delete(roomId);
      console.log(`[ROOMS] Deleted room: ${roomId}`);
    }
  }

  getAllRooms() {
    return Array.from(this.rooms.values());
  }

  getRoomStats(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return null;

    return {
      roomId: room.roomId,
      userCount: room.users.length,
      strokeCount: room.stateManager.getHistory().length,
      createdAt: room.createdAt
    };
  }
}

module.exports = RoomManager;