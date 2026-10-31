
const Room = require("../models/Room");

const MIN_BID_INCREMENT = 0.25;
const DEFAULT_BID_TIMER = 30;
const ANNOUNCEMENT_DELAY = 2500;

const roomTimers = new Map();
const roomQueues = new Map();

// Serialize operations for each room.
function runExclusive(roomCode, operation) {
  const key = roomCode.toUpperCase();
  const previous = roomQueues.get(key) || Promise.resolve();

  const current = previous.catch(() => {}).then(operation);

  roomQueues.set(key, current);

  return current.finally(() => {
    if (roomQueues.get(key) === current) {
      roomQueues.delete(key);
    }
  });
}

function emitRoomUpdate(io, room) {
  if (!io) return;

  io.to(room.roomCode).emit("roomUpdated", room);
  io.to(room.roomCode).emit("auctionUpdated", room);
}

function clearRoomTimer(roomCode) {
  const key = roomCode.toUpperCase();
  const timer = roomTimers.get(key);

  if (timer) {
    clearTimeout(timer);
    roomTimers.delete(key);
  }
}

// Auction timer is fixed at 30 seconds.
function getTimerDuration() {
  return DEFAULT_BID_TIMER;
}

function getCurrentPlayer(room) {
  const index = room.auction.currentPlayerIndex;

  if (index < 0 || index >= room.players.length) {
    return null;
  }

  return room.players[index];
}

// Schedule current live player's expiry.
function schedulePlayerExpiry(roomCode, io, timerEndsAt) {
  const key = roomCode.toUpperCase();

  clearRoomTimer(key);

  const expectedEnd = new Date(timerEndsAt).getTime();
  const delay = Math.max(0, expectedEnd - Date.now());

  const timer = setTimeout(() => {
    runExclusive(key, async () => {
      const room = await Room.findOne({ roomCode: key });

      if (!room || room.status !== "auction") return;
      if (room.auction.isPaused) return;

      const player = getCurrentPlayer(room);

      if (!player || player.status !== "live") return;

      const latestEnd = room.auction.timerEndsAt
        ? new Date(room.auction.timerEndsAt).getTime()
        : 0;

      // Ignore outdated timer callbacks.
      if (latestEnd !== expectedEnd) return;

      if (Date.now() < expectedEnd) {
        schedulePlayerExpiry(
          key,
          io,
          room.auction.timerEndsAt
        );
        return;
      }

      await finishCurrentPlayer(room, io);
    }).catch((error) => {
      console.error("Auction timer error:", error);
    });
  }, delay);

  roomTimers.set(key, timer);
}

// Schedule next player after SOLD/UNSOLD announcement.
function scheduleNextPlayer(roomCode, io) {
  const key = roomCode.toUpperCase();

  clearRoomTimer(key);

  const timer = setTimeout(() => {
    runExclusive(key, async () => {
      const room = await Room.findOne({ roomCode: key });

      if (!room || room.status !== "auction") return;
      if (room.auction.isPaused) return;

      const currentPlayer = getCurrentPlayer(room);

      if (
        !currentPlayer ||
        !["sold", "unsold"].includes(currentPlayer.status)
      ) {
        return;
      }

      await moveToNextPlayer(room, io);
    }).catch((error) => {
      console.error("Next player transition error:", error);
    });
  }, ANNOUNCEMENT_DELAY);

  roomTimers.set(key, timer);
}

// Start a fresh 30-second bidding timer.
function startPlayerTimer(room, io) {
  room.auction.timerEndsAt = new Date(
    Date.now() + getTimerDuration() * 1000
  );

  room.auction.isPaused = false;
  room.auction.pausedBy = null;

  schedulePlayerExpiry(
    room.roomCode,
    io,
    room.auction.timerEndsAt
  );
}

// Move to next player.
async function moveToNextPlayer(room, io) {
  const nextIndex = room.auction.currentPlayerIndex + 1;

  clearRoomTimer(room.roomCode);

  if (nextIndex >= room.players.length) {
    room.status = "completed";

    room.auction.currentPlayerIndex = -1;
    room.auction.currentBid = 0;
    room.auction.highestBidder = null;
    room.auction.timerEndsAt = null;
    room.auction.isPaused = false;
    room.auction.pausedBy = null;

    await room.save();
    emitRoomUpdate(io, room);

    return;
  }

  room.auction.currentPlayerIndex = nextIndex;

  const player = room.players[nextIndex];

  player.status = "live";
  player.soldTo = null;
  player.soldToFranchise = null;
  player.soldPrice = null;

  room.auction.currentBid = player.basePrice;
  room.auction.highestBidder = null;

  startPlayerTimer(room, io);

  await room.save();
  emitRoomUpdate(io, room);
}

// Finalize current player as SOLD or UNSOLD.
async function finishCurrentPlayer(room, io) {
  if (!room || room.status !== "auction") return;
  if (room.auction.isPaused) return;

  const player = getCurrentPlayer(room);

  if (!player || player.status !== "live") return;

  if (
    room.auction.timerEndsAt &&
    Date.now() < new Date(room.auction.timerEndsAt).getTime()
  ) {
    schedulePlayerExpiry(
      room.roomCode,
      io,
      room.auction.timerEndsAt
    );
    return;
  }

  clearRoomTimer(room.roomCode);

  if (room.auction.highestBidder) {
    const winner = room.participants.find(
      (participant) =>
        participant.guestId === room.auction.highestBidder
    );

    if (!winner) {
      player.status = "unsold";
    } else {
      player.status = "sold";
      player.soldTo = winner.guestId;
      player.soldToFranchise = winner.franchise;
      player.soldPrice = room.auction.currentBid;

      winner.remainingPurse =
        Number(winner.remainingPurse ?? room.settings.purse) -
        Number(room.auction.currentBid);

      winner.squad.push({
        playerId: player._id,
        playerName: player.playerName,
        role: player.role,
        country: player.country,
        imagePath: player.imagePath,
        purchasePrice: room.auction.currentBid,
      });
    }
  } else {
    player.status = "unsold";
  }

  room.auction.timerEndsAt = null;

  await room.save();
  emitRoomUpdate(io, room);

  // Keep SOLD/UNSOLD announcement visible.
  scheduleNextPlayer(room.roomCode, io);
}

// START AUCTION
async function startAuction(roomCode, guestId, io) {
  const key = roomCode.toUpperCase();

  return runExclusive(key, async () => {
    const room = await Room.findOne({ roomCode: key });

    if (!room) {
      throw new Error("Room not found.");
    }

    if (room.hostId !== guestId) {
      throw new Error(
        "Only the room creator can start the auction."
      );
    }

    if (room.status !== "waiting") {
      throw new Error("Auction has already started.");
    }

    if (!room.players.length) {
      throw new Error(
        "Upload the player list before starting."
      );
    }

    const missingFranchise = room.participants.some(
      (participant) => !participant.franchise
    );

    if (missingFranchise) {
      throw new Error(
        "Every participant must select a franchise."
      );
    }

    // Ensure the saved room setting is also 30 seconds.
    room.settings.bidTimer = DEFAULT_BID_TIMER;

    room.status = "auction";
    room.auction.currentPlayerIndex = -1;
    room.auction.currentBid = 0;
    room.auction.highestBidder = null;
    room.auction.startedAt = new Date();
    room.auction.timerEndsAt = null;
    room.auction.isPaused = false;
    room.auction.pausedBy = null;

    await moveToNextPlayer(room, io);

    return room;
  });
}

// PLACE BID
async function placeBid(roomCode, guestId, amount, io) {
  const key = roomCode.toUpperCase();

  return runExclusive(key, async () => {
    const room = await Room.findOne({ roomCode: key });

    if (!room) {
      throw new Error("Room not found.");
    }

    if (room.status !== "auction") {
      throw new Error("Auction is not active.");
    }

    const player = getCurrentPlayer(room);

    if (!player || player.status !== "live") {
      throw new Error("No player is currently live.");
    }

    const bidder = room.participants.find(
      (participant) => participant.guestId === guestId
    );

    if (!bidder || !bidder.franchise) {
      throw new Error(
        "Select a franchise before bidding."
      );
    }

    // Reject consecutive bids from the same franchise.
    if (room.auction.highestBidder) {
      const previousBidder = room.participants.find(
        (participant) =>
          participant.guestId === room.auction.highestBidder
      );

      if (
        previousBidder &&
        previousBidder.franchise === bidder.franchise
      ) {
        throw new Error(
          "Another franchise must bid before you can bid again."
        );
      }
    }

    // During pause, bids remain open.
    // During normal bidding, reject expired bids.
    if (
      !room.auction.isPaused &&
      room.auction.timerEndsAt &&
      Date.now() >= new Date(room.auction.timerEndsAt).getTime()
    ) {
      throw new Error("Bidding time has expired.");
    }

    const remainingPurse = Number(
      bidder.remainingPurse ?? room.settings.purse
    );

    const maxSquadSize = Number(
      room.settings?.squadSize || 25
    );

    if (bidder.squad.length >= maxSquadSize) {
      throw new Error("Your squad is already full.");
    }

    const bidAmount = Number(amount);

    if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
      throw new Error("Invalid bid amount.");
    }

    const minimumBid = room.auction.highestBidder
      ? Number(room.auction.currentBid) + MIN_BID_INCREMENT
      : Number(player.basePrice);

    if (bidAmount < minimumBid - 0.000001) {
      throw new Error(
        `Minimum valid bid is ${minimumBid.toFixed(2)} Cr.`
      );
    }

    if (bidAmount > remainingPurse) {
      throw new Error("Insufficient purse balance.");
    }

    room.auction.currentBid = bidAmount;
    room.auction.highestBidder = guestId;

    // Every valid bid resets timer to 30 seconds,
    // except when auction is paused.
    if (!room.auction.isPaused) {
      startPlayerTimer(room, io);
    }

    await room.save();
    emitRoomUpdate(io, room);

    return room;
  });
}

// GLOBAL PAUSE
async function pauseAuction(roomCode, guestId, io) {
  const key = roomCode.toUpperCase();

  return runExclusive(key, async () => {
    const room = await Room.findOne({ roomCode: key });

    if (!room) {
      throw new Error("Room not found.");
    }

    if (room.status !== "auction") {
      throw new Error("Auction is not active.");
    }

    if (room.auction.isPaused) {
      throw new Error("Auction is already paused.");
    }

    const participant = room.participants.find(
      (p) => p.guestId === guestId
    );

    if (!participant) {
      throw new Error("Participant not found.");
    }

    clearRoomTimer(key);

    room.auction.isPaused = true;
    room.auction.pausedBy = participant.franchise;

    await room.save();
    emitRoomUpdate(io, room);

    return room;
  });
}

// GLOBAL RESUME
async function resumeAuction(roomCode, guestId, io) {
  const key = roomCode.toUpperCase();

  return runExclusive(key, async () => {
    const room = await Room.findOne({ roomCode: key });

    if (!room) {
      throw new Error("Room not found.");
    }

    if (room.status !== "auction") {
      throw new Error("Auction is not active.");
    }

    if (!room.auction.isPaused) {
      throw new Error("Auction is not paused.");
    }

    const participant = room.participants.find(
      (p) => p.guestId === guestId
    );

    if (!participant) {
      throw new Error("Participant not found.");
    }

    const currentPlayer = getCurrentPlayer(room);

    room.auction.isPaused = false;
    room.auction.pausedBy = null;

    if (
      currentPlayer &&
      ["sold", "unsold"].includes(currentPlayer.status)
    ) {
      room.auction.timerEndsAt = null;

      await room.save();
      emitRoomUpdate(io, room);

      scheduleNextPlayer(key, io);

      return room;
    }

    if (!currentPlayer || currentPlayer.status !== "live") {
      throw new Error("No active player to resume.");
    }

    // Resume with a fresh 30-second timer.
    startPlayerTimer(room, io);

    await room.save();
    emitRoomUpdate(io, room);

    return room;
  });
}

// Recover active auctions after server restart.
async function resumeActiveAuctions(io) {
  const rooms = await Room.find({ status: "auction" });

  let biddingRooms = 0;
  let announcementRooms = 0;
  let pausedRooms = 0;

  for (const room of rooms) {
    const key = room.roomCode.toUpperCase();

    if (room.auction.isPaused) {
      pausedRooms++;
      continue;
    }

    const currentPlayer = getCurrentPlayer(room);

    if (
      currentPlayer &&
      ["sold", "unsold"].includes(currentPlayer.status)
    ) {
      scheduleNextPlayer(key, io);
      announcementRooms++;
      continue;
    }

    if (currentPlayer && currentPlayer.status === "live") {
      if (!room.auction.timerEndsAt) {
        startPlayerTimer(room, io);
        await room.save();
      } else {
        schedulePlayerExpiry(
          key,
          io,
          room.auction.timerEndsAt
        );
      }

      biddingRooms++;
    }
  }

  console.log(
    `Auction recovery: ${biddingRooms} bidding, ` +
    `${announcementRooms} announcement, ` +
    `${pausedRooms} paused.`
  );
}

module.exports = {
  startAuction,
  placeBid,
  pauseAuction,
  resumeAuction,
  resumeActiveAuctions,
};
