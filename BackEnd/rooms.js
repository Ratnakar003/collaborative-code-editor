// rooms.js
const db = require("./database");

function getRoomCode(roomId) {
  return db.getRoomCode(roomId);
}

function updateRoomCode(roomId, code) {
  db.updateRoomCode(roomId, code);
}

function addUserToRoom(roomId, socketId, name) {
  return db.addUserToRoom(roomId, socketId, name);
}

function removeUserFromRoom(roomId, socketId) {
  return db.removeUserFromRoom(roomId, socketId);
}

function getUsersInRoom(roomId) {
  return db.getUsersInRoom(roomId);
}

module.exports = {
  getRoomCode,
  updateRoomCode,
  addUserToRoom,
  removeUserFromRoom,
  getUsersInRoom,
};
