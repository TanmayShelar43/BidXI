
const crypto = require("crypto");
const Room = require("../models/Room");

const IPL_FRANCHISES = [
  "CSK",
  "DC",
  "GT",
  "KKR",
  "LSG",
  "MI",
  "PBKS",
  "RR",
  "RCB",
  "SRH",
];

function generateRoomCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

// Helper: Initialize missing participant data in old rooms
function initializeParticipantData(room) {
  const startingPurse = Number(room.settings?.purse) || 120;

  room.participants.forEach((participant) => {
    if (
      participant.remainingPurse === undefined ||
      participant.remainingPurse === null
    ) {
      participant.remainingPurse = startingPurse;
    }

    if (!Array.isArray(participant.squad)) {
      participant.squad = [];
    }
  });
}

// CREATE ROOM
const createRoom = async (req, res) => {
  try {
    const {
      guestId,
      displayName,
      maxTeams = 10,
      purse = 120,
      squadSize = 18,
      bidTimer = 30,
      roomName = "IPL Mega Auction",
    } = req.body;

    if (!guestId || !displayName?.trim()) {
      return res.status(400).json({
        message: "Guest ID and display name are required.",
      });
    }

    if (
      !Number.isInteger(Number(maxTeams)) ||
      Number(maxTeams) < 2 ||
      Number(maxTeams) > 10
    ) {
      return res.status(400).json({
        message: "Maximum teams must be between 2 and 10.",
      });
    }

    if (!Number.isFinite(Number(purse)) || Number(purse) <= 0) {
      return res.status(400).json({
        message: "Invalid purse amount.",
      });
    }

    if (
      !Number.isInteger(Number(squadSize)) ||
      Number(squadSize) < 1
    ) {
      return res.status(400).json({
        message: "Invalid squad size.",
      });
    }

    if (
      !Number.isInteger(Number(bidTimer)) ||
      Number(bidTimer) < 5 ||
      Number(bidTimer) > 60
    ) {
      return res.status(400).json({
        message: "Bid timer must be between 5 and 60 seconds.",
      });
    }

    let roomCode;
    let existingRoom;

    do {
      roomCode = generateRoomCode();
      existingRoom = await Room.findOne({ roomCode });
    } while (existingRoom);

    const startingPurse = Number(purse);

    const room = await Room.create({
      roomCode,
      roomName: roomName.trim() || "IPL Mega Auction",
      hostId: guestId,
      maxTeams: Number(maxTeams),

      settings: {
        purse: startingPurse,
        squadSize: Number(squadSize),
        bidTimer: Number(bidTimer),
      },

      participants: [
        {
          guestId,
          displayName: displayName.trim(),
          isHost: true,
          remainingPurse: startingPurse,
          squad: [],
        },
      ],
    });

    return res.status(201).json({
      message: "Room created successfully.",
      room,
    });
  } catch (error) {
    console.error("Create room error:", error);

    return res.status(500).json({
      message: "Failed to create room.",
    });
  }
};

// JOIN ROOM
const joinRoom = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { guestId, displayName } = req.body;

    if (!guestId || !displayName?.trim()) {
      return res.status(400).json({
        message: "Guest ID and display name are required.",
      });
    }

    const room = await Room.findOne({
      roomCode: roomCode.toUpperCase(),
    });

    if (!room) {
      return res.status(404).json({
        message: "Room not found.",
      });
    }

    // Repair old room data before saving
    initializeParticipantData(room);

    const existingParticipant = room.participants.find(
      (participant) => participant.guestId === guestId
    );

    if (existingParticipant) {
      await room.save();

      return res.status(200).json({
        message: "Rejoined room successfully.",
        room,
      });
    }

    if (room.status !== "waiting") {
      return res.status(400).json({
        message: "Auction has already started.",
      });
    }

    if (room.participants.length >= room.maxTeams) {
      return res.status(400).json({
        message: "Room is full.",
      });
    }

    room.participants.push({
      guestId,
      displayName: displayName.trim(),
      isHost: false,
      remainingPurse: Number(room.settings?.purse) || 120,
      squad: [],
    });

    await room.save();

    const io = req.app.get("io");

    if (io) {
      io.to(room.roomCode).emit("roomUpdated", room);
    }

    return res.status(200).json({
      message: "Joined room successfully.",
      room,
    });
  } catch (error) {
    console.error("Join room error:", error);

    return res.status(500).json({
      message: "Failed to join room.",
    });
  }
};

// SELECT FRANCHISE
const selectFranchise = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { guestId, franchise } = req.body;

    if (!guestId || !franchise) {
      return res.status(400).json({
        message: "Guest ID and franchise are required.",
      });
    }

    const room = await Room.findOne({
      roomCode: roomCode.toUpperCase(),
    });

    if (!room) {
      return res.status(404).json({
        message: "Room not found.",
      });
    }

    if (room.status !== "waiting") {
      return res.status(400).json({
        message: "Franchise selection is closed.",
      });
    }

    // IMPORTANT: Fix missing fields in existing MongoDB rooms
    initializeParticipantData(room);

    const participant = room.participants.find(
      (p) => p.guestId === guestId
    );

    if (!participant) {
      return res.status(404).json({
        message: "Participant not found.",
      });
    }

    const selectedFranchise = franchise.toUpperCase();

    if (!IPL_FRANCHISES.includes(selectedFranchise)) {
      return res.status(400).json({
        message: "Invalid IPL franchise.",
      });
    }

    const alreadySelected = room.participants.some(
      (p) =>
        p.guestId !== guestId &&
        p.franchise === selectedFranchise
    );

    if (alreadySelected) {
      return res.status(400).json({
        message: "This franchise has already been selected.",
      });
    }

    participant.franchise = selectedFranchise;

    await room.save();

    const io = req.app.get("io");

    if (io) {
      io.to(room.roomCode).emit("roomUpdated", room);
    }

    return res.status(200).json({
      message: "Franchise selected successfully.",
      room,
    });
  } catch (error) {
    console.error("Select franchise error:", error);

    return res.status(500).json({
      message: "Failed to select franchise.",
    });
  }
};

// GET ROOM
const getRoom = async (req, res) => {
  try {
    const { roomCode } = req.params;

    const room = await Room.findOne({
      roomCode: roomCode.toUpperCase(),
    });

    if (!room) {
      return res.status(404).json({
        message: "Room not found.",
      });
    }

    // Repair missing participant fields in response
    initializeParticipantData(room);

    return res.status(200).json({ room });
  } catch (error) {
    console.error("Get room error:", error);

    return res.status(500).json({
      message: "Failed to fetch room.",
    });
  }
};

module.exports = {
  createRoom,
  joinRoom,
  getRoom,
  selectFranchise,
};
