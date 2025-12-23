const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const roomRoutes = require("./routes/roomRoutes");
const Rooms = require("./rooms");

const app = express();
const PORT = 3000;

console.log("Server starting...");

app.use(cors());
app.use(express.json());

// ----- REST API -----
app.use("/api/rooms", roomRoutes);

// ---- Serve frontend static files ----
const frontendPath = path.join(__dirname, "../frontend");
app.use(express.static(frontendPath));

// ----- HTTP server + Socket.io setup -----
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Host of each room: roomId -> socketId
const roomHosts = {};
// Pending join requests: roomId -> [ { socketId, name } ]
const pendingJoins = {};

// ----- Socket.io events -----
io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id);

  socket.on("cursor-move", ({ roomId, name, cursor }) => {
  if (!roomId) return;
  socket.to(roomId).emit("cursor-update", { name, cursor });
});

  // STEP 1: client requests to join a room
  socket.on("request-join", ({ roomId, name }) => {
    if (!roomId || !name) return;

    const currentHostId = roomHosts[roomId];

    // If no host yet -> this user becomes HOST and joins immediately
    if (!currentHostId) {
      roomHosts[roomId] = socket.id;

      socket.join(roomId);
      socket.roomId = roomId;
      socket.userName = name;

      const usersInRoom = Rooms.addUserToRoom(roomId, socket.id, name);
      io.to(roomId).emit("room-users", usersInRoom);

      socket.emit("join-approved", { roomId, isHost: true });
      console.log(`⭐ ${name} (${socket.id}) is now HOST of room ${roomId}`);
      return;
    }

    // Otherwise, send join request to host
    if (!pendingJoins[roomId]) pendingJoins[roomId] = [];
    pendingJoins[roomId].push({ socketId: socket.id, name });

    console.log(`📨 Join request from ${name} (${socket.id}) for room ${roomId}`);

    io.to(currentHostId).emit("join-request", {
      roomId,
      socketId: socket.id,
      name,
    });
  });

  // STEP 2: host approves join
  socket.on("approve-join", ({ roomId, socketId }) => {
    if (!roomId || !socketId) return;

    const hostId = roomHosts[roomId];
    if (socket.id !== hostId) {
      console.log("❗ Non-host tried to approve join");
      return;
    }

    const pending = pendingJoins[roomId] || [];
    const index = pending.findIndex((p) => p.socketId === socketId);
    if (index === -1) return;

    const { name } = pending[index];
    pending.splice(index, 1);

    const targetSocket = io.sockets.sockets.get(socketId);
    if (!targetSocket) {
      console.log("❗ Requested user disconnected before approval");
      return;
    }

    targetSocket.join(roomId);
    targetSocket.roomId = roomId;
    targetSocket.userName = name;

    const usersInRoom = Rooms.addUserToRoom(roomId, socketId, name);
    io.to(roomId).emit("room-users", usersInRoom);

    targetSocket.emit("join-approved", { roomId, isHost: false });
    console.log(`✅ Host approved ${name} (${socketId}) for room ${roomId}`);
  });

  // STEP 3: host rejects join
  socket.on("reject-join", ({ roomId, socketId }) => {
    if (!roomId || !socketId) return;

    const hostId = roomHosts[roomId];
    if (socket.id !== hostId) {
      console.log("❗ Non-host tried to reject join");
      return;
    }

    const pending = pendingJoins[roomId] || [];
    const index = pending.findIndex((p) => p.socketId === socketId);
    if (index === -1) return;

    pending.splice(index, 1);

    const targetSocket = io.sockets.sockets.get(socketId);
    if (targetSocket) {
      targetSocket.emit("join-rejected", { roomId });
    }

    console.log(`🚫 Host rejected ${socketId} for room ${roomId}`);
  });

  // CODE CHANGES (only allowed if socket is actually in that room)
  socket.on("code-change", ({ roomId, code }) => {
    if (!roomId) return;
    if (socket.roomId !== roomId) return; // not approved / not joined

    Rooms.updateRoomCode(roomId, code);
    socket.to(roomId).emit("code-update", code);
  });

  // CHAT MESSAGES (only allowed if joined)
  socket.on("chat-message", ({ roomId, name, message }) => {
    if (!roomId || !message) return;
    if (socket.roomId !== roomId) return; // not approved / not joined

    const trimmed = message.toString().trim();
    if (!trimmed) return;

    io.to(roomId).emit("chat-message", {
      name,
      message: trimmed,
      timestamp: Date.now(),
    });
  });
  socket.on("typing", ({ roomId, name }) => {
  if (!roomId) return;
  if (socket.roomId !== roomId) return;

  socket.to(roomId).emit("user-typing", { name });
});


  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
    const roomId = socket.roomId;

    if (roomId) {
      const usersInRoom = Rooms.removeUserFromRoom(roomId, socket.id);
      io.to(roomId).emit("room-users", usersInRoom);
    }

    // If this socket was host of a room
    if (roomId && roomHosts[roomId] === socket.id) {
      console.log(`⚠️ Host left room ${roomId}`);
      delete roomHosts[roomId];
      pendingJoins[roomId] = [];
    }
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`✅ Backend + Socket.io running on http://localhost:${PORT}`);
});
