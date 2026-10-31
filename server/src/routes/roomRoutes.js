
const express = require("express");
const multer = require("multer");

const {
  createRoom,
  joinRoom,
  getRoom,
  selectFranchise,
} = require("../controllers/roomController");

const { importPlayers } = require("../controllers/playerController");

const {
  startAuction,
  placeBid,
  pauseAuction,
  resumeAuction,
} = require("../services/auctionService");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isExcel =
      file.originalname.toLowerCase().endsWith(".xlsx") ||
      file.originalname.toLowerCase().endsWith(".xls");

    if (isExcel) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel files (.xlsx, .xls) are allowed."));
    }
  },
});

// CREATE AND JOIN ROOM
router.post("/", createRoom);
router.post("/:roomCode/join", joinRoom);

// FRANCHISE
router.patch("/:roomCode/franchise", selectFranchise);

// PLAYER IMPORT
router.post(
  "/:roomCode/players/upload",
  upload.single("playersFile"),
  importPlayers
);

// AUCTION START
router.post("/:roomCode/auction/start", async (req, res) => {
  try {
    const { guestId } = req.body;
    const io = req.app.get("io");

    const room = await startAuction(
      req.params.roomCode,
      guestId,
      io
    );

    res.status(200).json({
      message: "Auction started successfully.",
      room,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
});

// PLACE BID
router.post("/:roomCode/auction/bid", async (req, res) => {
  try {
    const { guestId, amount } = req.body;
    const io = req.app.get("io");

    const room = await placeBid(
      req.params.roomCode,
      guestId,
      amount,
      io
    );

    res.status(200).json({
      message: "Bid placed successfully.",
      room,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
});

// PAUSE AUCTION
router.post("/:roomCode/auction/pause", async (req, res) => {
  try {
    const { guestId } = req.body;
    const io = req.app.get("io");

    const room = await pauseAuction(
      req.params.roomCode,
      guestId,
      io
    );

    res.status(200).json({
      message: "Auction paused successfully.",
      room,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
});

// RESUME AUCTION
router.post("/:roomCode/auction/resume", async (req, res) => {
  try {
    const { guestId } = req.body;
    const io = req.app.get("io");

    const room = await resumeAuction(
      req.params.roomCode,
      guestId,
      io
    );

    res.status(200).json({
      message: "Auction resumed successfully.",
      room,
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
    });
  }
});

// GET ROOM — keep this after the specific routes
router.get("/:roomCode", getRoom);

module.exports = router;
