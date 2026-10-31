
const XLSX = require("xlsx");
const path = require("path");
const Room = require("../models/Room");

const importPlayers = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { guestId } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Please upload an Excel file." });
    }

    if (!guestId) {
      return res.status(400).json({ message: "Guest ID is required." });
    }

    const room = await Room.findOne({
      roomCode: roomCode.toUpperCase(),
    });

    if (!room) {
      return res.status(404).json({ message: "Room not found." });
    }

    if (room.hostId !== guestId) {
      return res.status(403).json({
        message: "Only the room creator can upload players.",
      });
    }

    if (room.status !== "waiting") {
      return res.status(400).json({
        message: "Players cannot be changed after the auction starts.",
      });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json(firstSheet, {
      defval: "",
      raw: false,
    });

    if (rows.length === 0) {
      return res.status(400).json({ message: "Excel file is empty." });
    }

    const requiredColumns = [
      "Set",
      "Category",
      "Player Name",
      "Role",
      "Country",
      "Base Price (Cr)",
      "Image Path",
    ];

    const actualColumns = Object.keys(rows[0]).map((column) =>
      column.trim()
    );

    const missingColumns = requiredColumns.filter(
      (column) => !actualColumns.includes(column)
    );

    if (missingColumns.length > 0) {
      return res.status(400).json({
        message: "Excel columns are missing.",
        missingColumns,
      });
    }

    const players = [];
    const seenNames = new Set();
    const errors = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;

      const set = String(row["Set"]).trim();
      const category = String(row["Category"]).trim();
      const playerName = String(row["Player Name"]).trim();
      const role = String(row["Role"]).trim();
      const country = String(row["Country"]).trim();
      const basePrice = Number(
        String(row["Base Price (Cr)"]).replace(/,/g, "").trim()
      );
      const imagePath = path.basename(
        String(row["Image Path"]).trim()
      );

      if (
        !set ||
        !category ||
        !playerName ||
        !role ||
        !country ||
        !imagePath
      ) {
        errors.push(`Row ${rowNumber}: One or more fields are empty.`);
        return;
      }

      if (!Number.isFinite(basePrice) || basePrice <= 0) {
        errors.push(`Row ${rowNumber}: Invalid base price.`);
        return;
      }

      if (!/\.(jpg|jpeg|png|webp)$/i.test(imagePath)) {
        errors.push(`Row ${rowNumber}: Invalid image file format.`);
        return;
      }

      const normalizedName = playerName.toLowerCase();

      if (seenNames.has(normalizedName)) {
        errors.push(`Row ${rowNumber}: Duplicate player ${playerName}.`);
        return;
      }

      seenNames.add(normalizedName);

      players.push({
        set,
        category,
        playerName,
        role,
        country,
        basePrice,
        imagePath,
        status: "upcoming",
      });
    });

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Please fix the following Excel errors.",
        errors,
      });
    }

    if (players.length === 0) {
      return res.status(400).json({
        message: "No valid players found in the Excel file.",
      });
    }

    // Replace the existing player list while the room is waiting.
    room.players = players;
    room.auction = {
      currentPlayerIndex: -1,
      currentBid: 0,
      highestBidder: null,
      timerEndsAt: null,
      startedAt: null,
    };

    await room.save();

    const io = req.app.get("io");
    if (io) {
      io.to(room.roomCode).emit("roomUpdated", room);
    }

    const setSummary = {};

    players.forEach((player) => {
      setSummary[player.set] = (setSummary[player.set] || 0) + 1;
    });

    return res.status(200).json({
      message: "Players imported successfully!",
      totalPlayers: players.length,
      setSummary,
    });
  } catch (error) {
    console.error("Player import error:", error);
    return res.status(500).json({
      message: "Failed to import players.",
    });
  }
};

module.exports = { importPlayers };
