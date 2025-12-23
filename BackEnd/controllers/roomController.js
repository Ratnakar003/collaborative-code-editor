// controllers/roomController.js
const Rooms = require("../rooms");

// GET /api/rooms/:roomId
function getRoom(req, res) {
  const { roomId } = req.params;
  const code = Rooms.getRoomCode(roomId);
  return res.json({ roomId, code });
}

module.exports = {
  getRoom,
};
