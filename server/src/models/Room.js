
const mongoose = require("mongoose");

const squadPlayerSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    playerName: { type: String, required: true },
    role: { type: String, required: true },
    country: { type: String, required: true },
    imagePath: { type: String, required: true },
    purchasePrice: { type: Number, required: true },
  },
  { _id: false }
);

const participantSchema = new mongoose.Schema(
  {
    guestId: { type: String, required: true },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 24,
    },
    isHost: { type: Boolean, default: false },
    isReady: { type: Boolean, default: false },
    franchise: { type: String, default: null },

    remainingPurse: {
      type: Number,
      required: true,
      min: 0,
    },

    squad: {
      type: [squadPlayerSchema],
      default: [],
    },

    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const auctionPlayerSchema = new mongoose.Schema({
  set: { type: String, required: true },
  category: { type: String, required: true },
  playerName: { type: String, required: true, trim: true },
  role: { type: String, required: true },
  country: { type: String, required: true },
  basePrice: { type: Number, required: true, min: 0 },
  imagePath: { type: String, required: true },

  status: {
    type: String,
    enum: ["upcoming", "live", "sold", "unsold"],
    default: "upcoming",
  },

  soldTo: { type: String, default: null },
  soldToFranchise: { type: String, default: null },
  soldPrice: { type: Number, default: null },
});

const roomSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },

    roomName: {
      type: String,
      default: "IPL Mega Auction",
      trim: true,
      maxlength: 50,
    },

    hostId: { type: String, required: true },

    maxTeams: { type: Number, default: 10, min: 2, max: 10 },

    settings: {
      purse: { type: Number, default: 120 },
      squadSize: { type: Number, default: 18 },
      bidTimer: { type: Number, default: 30 },
    },

    status: {
      type: String,
      enum: ["waiting", "auction", "completed"],
      default: "waiting",
    },

    participants: {
      type: [participantSchema],
      default: [],
    },

    players: {
      type: [auctionPlayerSchema],
      default: [],
    },

    auction: {
      currentPlayerIndex: { type: Number, default: -1 },
      currentBid: { type: Number, default: 0 },
      highestBidder: { type: String, default: null },
      timerEndsAt: { type: Date, default: null },
      startedAt: { type: Date, default: null },
      isPaused: { type: Boolean, default: false },
      pausedBy: { type: String, default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Room", roomSchema);
