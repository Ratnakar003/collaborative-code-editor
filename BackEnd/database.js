// database.js
// In-memory "database" for rooms and users.
// Later you can replace this with MongoDB or any real DB.

const rooms = {
  "demo-room": {
    code: `// This code is coming from BACKEND ✅
//
// If you see this in your editor, backend is working!
// Now with REAL-TIME updates 😎
`
  }
};

const roomUsers = {
  // roomId: [ { id, name, color }, ... ]
};

// a small palette to choose from (extend if you want)
const PALETTE = [
  "#2563eb", // blue
  "#16a34a", // green
  "#7c3aed", // purple
  "#ef4444", // red
  "#f59e0b", // amber
  "#06b6d4", // teal
  "#e11d48", // rose
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#8b5cf6", // violet
];

// deterministic-ish pick: hash string => index
function pickColorForName(name) {
  if (!name) return PALETTE[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  const idx = Math.abs(h) % PALETTE.length;
  return PALETTE[idx];
}

function ensureRoom(roomId) {
  if (!rooms[roomId]) {
    rooms[roomId] = { code: "" };
  }
  return rooms[roomId];
}

// ----- Room code functions -----
function getRoomCode(roomId) {
  const room = ensureRoom(roomId);
  return room.code;
}

function updateRoomCode(roomId, code) {
  const room = ensureRoom(roomId);
  room.code = code;
}

// ----- User tracking functions -----
function addUserToRoom(roomId, socketId, name) {
  if (!roomUsers[roomId]) {
    roomUsers[roomId] = [];
  }
  // If same socketId exists, update name (rare)
  const existing = roomUsers[roomId].find((u) => u.id === socketId);
  if (existing) {
    existing.name = name;
    if (!existing.color) existing.color = pickColorForName(name);
  } else {
    const color = pickColorForName(name);
    roomUsers[roomId].push({ id: socketId, name, color });
  }
  return getUsersInRoom(roomId);
}

function removeUserFromRoom(roomId, socketId) {
  if (!roomUsers[roomId]) return [];
  roomUsers[roomId] = roomUsers[roomId].filter((u) => u.id !== socketId);
  return getUsersInRoom(roomId);
}

function getUsersInRoom(roomId) {
  if (!roomUsers[roomId]) return [];
  // return array of { name, color }
  return roomUsers[roomId].map((u) => ({ name: u.name, color: u.color }));
}

module.exports = {
  getRoomCode,
  updateRoomCode,
  addUserToRoom,
  removeUserFromRoom,
  getUsersInRoom,
};
