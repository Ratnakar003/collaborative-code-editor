// routes/roomRoutes.js
const express = require("express");
const router = express.Router();
const roomController = require("../controllers/roomController");

// /api/rooms/:roomId
router.get("/:roomId", roomController.getRoom);

module.exports = router;
