const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const roomRoutes = require("./routes/roomRoutes");
const Rooms = require("./rooms");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// REST API
app.use("/api/rooms", roomRoutes);

// Serve frontend
const frontendPath = path.join(__dirname, "../frontend");
app.use(express.static(frontendPath));

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// roomId -> hostSocketId
const roomHosts = {};
// roomId -> pending joins
const pendingJoins = {};

io.on("connection", (socket) => {
  console.log("🔌 Connected:", socket.id);

  // REQUEST JOIN
  socket.on("request-join", ({ roomId, name }) => {
    if (!roomId || !name) return;

    // FIRST USER = HOST
    if (!roomHosts[roomId]) {
      roomHosts[roomId] = socket.id;

      socket.join(roomId);
      socket.roomId = roomId;
      socket.userName = name;

      const users = Rooms.addUserToRoom(roomId, socket.id, name);
      io.to(roomId).emit("room-users", users);

      socket.emit("join-approved", { roomId, isHost: true });
      console.log(`⭐ Host created: ${name}`);
      return;
    }

    // SEND REQUEST TO HOST
    pendingJoins[roomId] ||= [];
    pendingJoins[roomId].push({ socketId: socket.id, name });

    io.to(roomHosts[roomId]).emit("join-request", {
      roomId,
      socketId: socket.id,
      name,
    });
  });

  // APPROVE JOIN
  socket.on("approve-join", ({ roomId, socketId }) => {
    if (roomHosts[roomId] !== socket.id) return;

    const pending = pendingJoins[roomId] || [];
    const req = pending.find((p) => p.socketId === socketId);
    if (!req) return;

    pendingJoins[roomId] = pending.filter(p => p.socketId !== socketId);

    const target = io.sockets.sockets.get(socketId);
    if (!target) return;

    target.join(roomId);
    target.roomId = roomId;
    target.userName = req.name;

    const users = Rooms.addUserToRoom(roomId, socketId, req.name);
    io.to(roomId).emit("room-users", users);

    target.emit("join-approved", { roomId, isHost: false });
  });

  // REJECT JOIN (FIXED – NO AUTO REJECT)
  socket.on("reject-join", ({ roomId, socketId }) => {
    if (roomHosts[roomId] !== socket.id) return;

    pendingJoins[roomId] = (pendingJoins[roomId] || [])
      .filter(p => p.socketId !== socketId);

    const target = io.sockets.sockets.get(socketId);
    if (target) target.emit("join-rejected", { roomId });
  });

  // CODE SYNC
  socket.on("code-change", ({ roomId, code }) => {
    if (socket.roomId !== roomId) return;
    Rooms.updateRoomCode(roomId, code);
    socket.to(roomId).emit("code-update", code);
  });

  // CHAT
  socket.on("chat-message", ({ roomId, name, message }) => {
    if (socket.roomId !== roomId) return;
    io.to(roomId).emit("chat-message", { name, message });
  });

  // TYPING
  socket.on("typing", ({ roomId, name }) => {
    if (socket.roomId !== roomId) return;
    socket.to(roomId).emit("user-typing", { name });
  });

  socket.on("disconnect", () => {
    const roomId = socket.roomId;
    if (!roomId) return;

    const users = Rooms.removeUserFromRoom(roomId, socket.id);
    io.to(roomId).emit("room-users", users);

    if (roomHosts[roomId] === socket.id) {
      delete roomHosts[roomId];
      pendingJoins[roomId] = [];
    }
  });
});

server.listen(PORT, () =>
  console.log(`✅ Server running http://localhost:${PORT}`)
);
