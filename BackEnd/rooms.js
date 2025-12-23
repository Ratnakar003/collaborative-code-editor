// BackEnd/rooms.js
// Manages room state: users + code

const rooms = {}; 
/*
rooms = {
  roomId: {
    code: "string",
    users: {
      socketId: name
    }
  }
}
*/

// ---------- HELPERS ----------

// Check if room exists
function roomExists(roomId) {
  return !!rooms[roomId];
}

// Get users in room (array for frontend)
function getUsersInRoom(roomId) {
  if (!rooms[roomId]) return [];

  return Object.entries(rooms[roomId].users).map(
    ([socketId, name]) => ({
      socketId,
      name,
    })
  );
}

// ---------- CORE LOGIC ----------

// Add user to room (creates room if needed)
function addUserToRoom(roomId, socketId, name) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      code: "",
      users: {},
    };
  }

  rooms[roomId].users[socketId] = name;
  return getUsersInRoom(roomId);
}

// Remove user from room
function removeUserFromRoom(roomId, socketId) {
  if (!rooms[roomId]) return [];

  delete rooms[roomId].users[socketId];

  // If room empty → delete room
  if (Object.keys(rooms[roomId].users).length === 0) {
    delete rooms[roomId];
    return [];
  }

  return getUsersInRoom(roomId);
}

// Update room code
function updateRoomCode(roomId, code) {
  if (!rooms[roomId]) {
    rooms[roomId] = {
      code: "",
      users: {},
    };
  }
  rooms[roomId].code = code;
}

// Get room code (used by REST API)
function getRoomCode(roomId) {
  return rooms[roomId]?.code || "";
}

// ---------- EXPORTS ----------
module.exports = {
  roomExists,
  getUsersInRoom,
  addUserToRoom,
  removeUserFromRoom,
  updateRoomCode,
  getRoomCode,
};
