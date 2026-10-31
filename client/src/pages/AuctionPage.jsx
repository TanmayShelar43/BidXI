import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import confetti from "canvas-confetti";
import AuctionResults from "./AuctionResults";
import {
  Pause,
  Play,
  Gavel,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  Radio,
  Shield,
  Wallet,
} from "lucide-react";
import "./AuctionPage.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const MIN_BID_INCREMENT = 0.25;
const DEFAULT_PLAYER_IMAGE = "/images/default-player.png";

const getPlayerImage = (imagePath) => {
  if (!imagePath) return DEFAULT_PLAYER_IMAGE;

  const filename = imagePath.split(/[\\/]/).pop();
  return `/images/${encodeURIComponent(filename)}`;
};

const formatCr = (value) => Number(value || 0).toFixed(2);

const getPlayerKey = (player) =>
  player?.playerId || player?.id || player?.playerName;

function PlayerImage({ imagePath, alt, className }) {
  const [src, setSrc] = useState(getPlayerImage(imagePath));

  useEffect(() => {
    setSrc(getPlayerImage(imagePath));
  }, [imagePath]);

  return (
    <img
      className={className}
      src={src}
      alt={alt || "Player"}
      onError={() => {
        if (src !== DEFAULT_PLAYER_IMAGE) {
          setSrc(DEFAULT_PLAYER_IMAGE);
        }
      }}
    />
  );
}

function celebrateSold() {
  const colors = ["#f5c451", "#ffffff", "#e84b3c", "#4ade80"];

  confetti({
    particleCount: 130,
    spread: 90,
    startVelocity: 48,
    origin: { y: 0.65 },
    colors,
  });

  const end = Date.now() + 1600;

  const interval = setInterval(() => {
    if (Date.now() > end) {
      clearInterval(interval);
      return;
    }

    confetti({
      particleCount: 35,
      angle: 60,
      spread: 65,
      startVelocity: 45,
      origin: { x: 0, y: 0.65 },
      colors,
    });

    confetti({
      particleCount: 35,
      angle: 120,
      spread: 65,
      startVelocity: 45,
      origin: { x: 1, y: 0.65 },
      colors,
    });
  }, 250);
}

export default function AuctionPage({ roomCode, guestId }) {
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(30);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [activities, setActivities] = useState([]);

  const previousSnapshot = useRef(null);
  const activityId = useRef(0);

  // ACTIVITY FEED

  function addActivity(activity) {
    // Keep the newest activity at the top.
    setActivities((previous) =>
      [
        {
          id: ++activityId.current,
          time: new Date(),
          ...activity,
        },
        ...previous,
      ].slice(0, 100)
    );
  }

  // ROOM UPDATES

  function processRoomUpdate(updatedRoom) {
    if (!updatedRoom) return;

    const previous = previousSnapshot.current;
    const auction = updatedRoom.auction || {};
    const players = updatedRoom.players || [];
    const participants = updatedRoom.participants || [];

    if (previous) {
      const oldAuction = previous.auction || {};
      const oldPlayers = previous.players || [];

      const oldCurrentPlayer =
        oldPlayers[oldAuction.currentPlayerIndex];

      const currentPlayer =
        players[auction.currentPlayerIndex];

      // Announce when the auction moves to another player.
      const playerChanged =
        getPlayerKey(oldCurrentPlayer) &&
        getPlayerKey(oldCurrentPlayer) !== getPlayerKey(currentPlayer);

      if (playerChanged && currentPlayer) {
        addActivity({
          type: "player",
          playerName: currentPlayer.playerName || "Unknown player",
          role: currentPlayer.role || currentPlayer.category || "Player",
          basePrice: Number(currentPlayer.basePrice || 0),
        });
      }

      // Detect new bids only for the same player.
      const samePlayer =
        getPlayerKey(oldCurrentPlayer) &&
        getPlayerKey(oldCurrentPlayer) === getPlayerKey(currentPlayer);

      const oldBid = Number(oldAuction.currentBid || 0);
      const newBid = Number(auction.currentBid || 0);

      const bidChanged =
        samePlayer &&
        auction.highestBidder &&
        auction.highestBidder !== oldAuction.highestBidder &&
        newBid > oldBid;

      if (bidChanged) {
        const bidder = participants.find(
          (p) => p.guestId === auction.highestBidder
        );

        addActivity({
          type: "bid",
          franchise: bidder?.franchise || "Unknown franchise",
          playerName: currentPlayer?.playerName || "Unknown player",
          amount: newBid,
          guestId: auction.highestBidder,
        });
      }

      // Detect SOLD / UNSOLD transitions by player identity.
      const oldPlayersByKey = new Map(
        oldPlayers
          .filter((player) => getPlayerKey(player))
          .map((player) => [getPlayerKey(player), player])
      );

      players.forEach((player) => {
        const key = getPlayerKey(player);
        if (!key) return;

        const oldPlayer = oldPlayersByKey.get(key);
        if (!oldPlayer) return;

        if (
          oldPlayer.status !== player.status &&
          ["sold", "unsold"].includes(player.status)
        ) {
          addActivity({
            type: player.status,
            playerName: player.playerName,
            franchise: player.soldToFranchise || null,
            amount: Number(player.soldPrice || 0),
          });

          if (player.status === "sold") {
            celebrateSold();
          }
        }
      });
    }

    previousSnapshot.current = updatedRoom;
    setRoom(updatedRoom);
  }

  // SOCKET CONNECTION + INITIAL FETCH

  useEffect(() => {
    if (!roomCode || !guestId) {
      setLoading(false);
      return;
    }

    let active = true;
    const socket = io(API_URL);

    function handleRoomUpdate(updatedRoom) {
      if (!active) return;

      if (
        updatedRoom?.roomCode &&
        updatedRoom.roomCode.toUpperCase() !== roomCode.toUpperCase()
      ) {
        return;
      }

      processRoomUpdate(updatedRoom);
    }

    socket.on("connect", () => {
      socket.emit("joinRoom", roomCode);
    });

    socket.on("roomUpdated", handleRoomUpdate);
    socket.on("auctionUpdated", handleRoomUpdate);

    async function fetchRoom() {
      try {
        const response = await fetch(
          `${API_URL}/api/rooms/${roomCode}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Unable to fetch room.");
        }

        if (active) {
          const fetchedRoom = data.room || data;
          previousSnapshot.current = fetchedRoom;
          setRoom(fetchedRoom);
        }
      } catch (error) {
        if (active) setMessage(error.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchRoom();

    return () => {
      active = false;
      socket.disconnect();
    };
  }, [roomCode, guestId]);

  // BACKEND-SYNCED COUNTDOWN

  useEffect(() => {
    if (!room || room.status !== "auction") return;

    const updateTimer = () => {
      if (room.auction?.isPaused) return;

      if (!room.auction?.timerEndsAt) {
        setTimeLeft(0);
        return;
      }

      const remaining = Math.max(
        0,
        Math.ceil(
          (new Date(room.auction.timerEndsAt).getTime() -
            Date.now()) /
            1000
        )
      );

      setTimeLeft(remaining);
    };

    updateTimer();

    const interval = setInterval(updateTimer, 250);

    return () => clearInterval(interval);
  }, [
    room?.auction?.timerEndsAt,
    room?.auction?.isPaused,
    room?.status,
  ]);

  // COMMON API ACTION

  async function auctionAction(endpoint, body = {}) {
    if (!guestId || actionLoading) return;

    setActionLoading(true);
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/api/rooms/${roomCode}/auction/${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ guestId, ...body }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Action failed.");
      }

      if (data.room) processRoomUpdate(data.room);
    } catch (error) {
      console.error("Auction action failed:", error);
    } finally {
      setActionLoading(false);
    }
  }

  // PLACE BID

  function placeBid(amount) {
    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) return;

    const auction = room?.auction || {};
    const currentPlayer =
      room?.players?.[auction.currentPlayerIndex];

    if (!currentPlayer || currentPlayer.status !== "live") return;

    const participant = room.participants?.find(
      (p) => p.guestId === guestId
    );

    const highestBidder = room.participants?.find(
      (p) => p.guestId === auction.highestBidder
    );

    if (
      highestBidder?.franchise &&
      highestBidder.franchise === participant?.franchise
    ) {
      return;
    }

    const minimumBid = auction.highestBidder
      ? Number(auction.currentBid) + MIN_BID_INCREMENT
      : Number(currentPlayer.basePrice);

    const purse = Number(
      participant?.remainingPurse ?? room.settings?.purse ?? 0
    );

    if (value < minimumBid - 0.000001) return;
    if (value > purse) return;
    if (actionLoading) return;

    auctionAction("bid", { amount: value });
  }

  // LOADING / ERROR STATES

  if (loading) {
    return (
      <div className="auction-loading">
        <div className="loading-emblem">A</div>
        <p>PREPARING THE AUCTION ARENA</p>
        <span>Connecting to the auction room...</span>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="auction-loading">
        <Gavel size={38} />
        <h2>Unable to enter auction</h2>
        <p>{message || "Room not found."}</p>
      </div>
    );
  }

  if (room.status === "completed") {
    return <AuctionResults room={room} />;
  }

  // AUCTION DATA

  const auction = room.auction || {};
  const players = room.players || [];
  const participants = room.participants || [];

  const currentPlayer =
    players[auction.currentPlayerIndex];

  const myParticipant = participants.find(
    (p) => p.guestId === guestId
  );

  const highestBidder = participants.find(
    (p) => p.guestId === auction.highestBidder
  );

  const isPaused = Boolean(auction.isPaused);

  const isLive =
    room.status === "auction" &&
    currentPlayer?.status === "live";

  const isFinalized =
    currentPlayer &&
    ["sold", "unsold"].includes(currentPlayer.status);

  const isSold = currentPlayer?.status === "sold";

  const minimumBid = currentPlayer
    ? auction.highestBidder
      ? Number(auction.currentBid) + MIN_BID_INCREMENT
      : Number(currentPlayer.basePrice)
    : 0;

  const remainingPurse = Number(
    myParticipant?.remainingPurse ?? room.settings?.purse ?? 0
  );

  const mySquad = myParticipant?.squad || [];
  const squadSize = mySquad.length;
  const maxSquadSize = room.settings?.squadSize || 25;

  const sameFranchiseAsHighest =
    Boolean(highestBidder?.franchise) &&
    highestBidder.franchise === myParticipant?.franchise;

  const canBid =
    isLive &&
    !actionLoading &&
    !isPaused &&
    !sameFranchiseAsHighest &&
    squadSize < maxSquadSize &&
    remainingPurse >= minimumBid;

  const soldPlayers = players.filter(
    (p) => p.status === "sold"
  );

  const unsoldPlayers = players.filter(
    (p) => p.status === "unsold"
  );

  const completedPlayers =
    soldPlayers.length + unsoldPlayers.length;

  const progress = players.length
    ? (completedPlayers / players.length) * 100
    : 0;

  const resultFranchise = currentPlayer?.soldToFranchise;
  const resultPrice = currentPlayer?.soldPrice;

  const playerStats = currentPlayer
    ? [
        ["MATCHES", currentPlayer.matches ?? currentPlayer.matchesPlayed],
        ["RUNS", currentPlayer.runs],
        ["AVERAGE", currentPlayer.average ?? currentPlayer.battingAverage],
        ["STRIKE RATE", currentPlayer.strikeRate ?? currentPlayer.strike_rate],
        ["WICKETS", currentPlayer.wickets],
        ["ECONOMY", currentPlayer.economy],
      ].filter(
        ([, value]) =>
          value !== undefined &&
          value !== null &&
          value !== ""
      )
    : [];

  const purseLimit = Number(room.settings?.purse || 0);

  return (
    <div className="auction-page">

      {/* MAIN AUCTION LAYOUT */}

      <main className="auction-layout">

        {/* LEFT COLUMN */}

        <div className="auction-left-column">

          {/* PLAYER INFORMATION */}

          <section className="auction-stage">
            <div className="stage-heading">
              <div>
                <span className="stage-eyebrow">
                  THE BATTLE FOR THE BEST
                </span>
                <h1>
                  PLAYER <span>AUCTION</span>
                </h1>
              </div>

              <div className={`stage-live-tag ${isPaused ? "paused" : ""}`}>
                <span />
                {isPaused ? "PAUSED" : "ON THE BLOCK"}
              </div>
            </div>

            {currentPlayer ? (
              <div className="player-feature">

                <div className="player-feature-top">
                  <span>
                    LOT{" "}
                    {String(auction.currentPlayerIndex + 1).padStart(3, "0")}
                  </span>
                  <span>SET {currentPlayer.set || "--"}</span>
                  <span>{currentPlayer.category || "PLAYER"}</span>
                </div>

                <div className="player-feature-main">
                  <div className="player-portrait">
                    <PlayerImage
                      imagePath={currentPlayer.imagePath}
                      alt={currentPlayer.playerName}
                    />
                  </div>

                  <div className="player-information">
                    <span className="player-role">
                      {currentPlayer.role || "PLAYER"}
                    </span>

                    <h2>{currentPlayer.playerName}</h2>

                    <div className="player-country-line">
                      {currentPlayer.country || "International"}
                    </div>

                    <div className="player-base-price">
                      <span>BASE PRICE</span>
                      <strong>
                        ₹{formatCr(currentPlayer.basePrice)}
                        <small> CR</small>
                      </strong>
                    </div>

                    {playerStats.length > 0 && (
                      <div className="player-statistics">
                        {playerStats.map(([label, value]) => (
                          <div className="player-stat" key={label}>
                            <strong>{value}</strong>
                            <span>{label}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {isFinalized && (
                      <div className={`player-result ${isSold ? "sold" : "unsold"}`}>
                        {isSold ? (
                          <CheckCircle size={20} />
                        ) : (
                          <XCircle size={20} />
                        )}

                        <div>
                          <strong>{isSold ? "SOLD" : "UNSOLD"}</strong>
                          <span>
                            {isSold
                              ? `${resultFranchise || "Unknown"} · ₹${formatCr(resultPrice)} Cr`
                              : "This player went unsold"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="player-feature-bottom">
                  <div className="player-sequence">
                    <span>AUCTION PROGRESS</span>
                    <strong>
                      {String(auction.currentPlayerIndex + 1).padStart(2, "0")}
                      <small> / {players.length}</small>
                    </strong>
                  </div>

                  <div className="player-progress-track">
                    <div style={{ width: `${progress}%` }} />
                  </div>

                  <div className="player-sequence">
                    <span>COMPLETED</span>
                    <strong>{Math.round(progress)}%</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-stage">
                <Gavel size={48} />
                <h2>WAITING FOR NEXT PLAYER</h2>
                <p>
                  The auctioneer will introduce the next player shortly.
                </p>
              </div>
            )}
          </section>

          {/* LIVE ACTIVITY */}

          <section className="right-section activity-section top-activity-section">
            <div className="right-section-heading">
              <div>
                <Activity size={17} />
                <h3>LIVE ACTIVITY</h3>
              </div>
              <span>
                <span className="activity-live-indicator" />
                LIVE FEED
              </span>
            </div>

            <div className="activity-list">
              {activities.length > 0 ? (
                activities.map((activity) => {
                  let activityText = "";

                  if (activity.type === "player") {
                    activityText = `${activity.playerName} is now up for auction (${activity.role}) · Base price ₹${formatCr(activity.basePrice)} Cr`;
                  } else if (activity.type === "bid") {
                    activityText = `${activity.franchise} placed a bid of ₹${formatCr(activity.amount)} Cr for ${activity.playerName}`;
                  } else if (activity.type === "sold") {
                    activityText = `${activity.playerName} SOLD to ${activity.franchise || "Unknown franchise"} for ₹${formatCr(activity.amount)} Cr`;
                  } else if (activity.type === "unsold") {
                    activityText = `${activity.playerName} went UNSOLD`;
                  }

                  return (
                    <div className={`activity-message activity-${activity.type}`} key={activity.id}>
                      <span className="activity-message-dot" />
                      <p>{activityText}</p>
                      <time>
                        {activity.time.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                  );
                })
              ) : (
                <div className="empty-activity">
                  Waiting for auction activity...
                </div>
              )}
            </div>
          </section>

        </div>

        {/* RIGHT PANEL */}

        <aside className="auction-right-panel">

          <section className="current-bid-panel">
            <div className="current-bid-heading">
              <span>CURRENT HIGHEST BID</span>
              <span className={`bid-live-dot ${isPaused ? "paused" : ""}`} />
            </div>

            <div className="current-bid-amount">
              <span>₹</span>
              {formatCr(auction.currentBid)}
              <small>CR</small>
            </div>

            <div className="current-bid-footer">
              <div>
                <span>LEADING FRANCHISE</span>
                <strong>
                  {highestBidder?.franchise || "No bids yet"}
                </strong>
              </div>

              <div className={`stage-timer ${timeLeft <= 10 && !isPaused ? "timer-danger" : ""}`}>
                <Clock size={17} />
                <strong>
                  {isPaused || !auction.timerEndsAt ? "--" : timeLeft}
                </strong>
                <span>SEC</span>
              </div>
            </div>
          </section>

          {/* BIDDING */}

          <section className="bid-control-deck">
            <div className="bid-deck-heading">
              <div>
                <span>YOUR MOVE</span>
                <h3>PLACE YOUR BID</h3>
              </div>

              <div className="minimum-bid-tag">
                <span>MINIMUM</span>
                <strong>₹{formatCr(minimumBid)} Cr</strong>
              </div>
            </div>

            <button
              className="primary-raise-button"
              disabled={!canBid || actionLoading}
              onClick={() => placeBid(minimumBid)}
            >
              <Gavel size={19} />
              <span>
                {actionLoading ? "PROCESSING..." : "RAISE YOUR PADDLE"}
              </span>
              <strong>₹{formatCr(minimumBid)} Cr</strong>
            </button>

            <div className="auction-control-footer">
              <span>
                <Shield size={14} />
                Server-validated bidding
              </span>

              {!isPaused ? (
                <button
                  className="auction-pause-button"
                  disabled={!isLive || actionLoading}
                  onClick={() => auctionAction("pause")}
                >
                  <Pause size={14} />
                  PAUSE
                </button>
              ) : (
                <button
                  className="auction-resume-button"
                  disabled={actionLoading}
                  onClick={() => auctionAction("resume")}
                >
                  <Play size={14} />
                  RESUME
                </button>
              )}
            </div>
          </section>

          {/* YOUR PURSE */}

          <section className="my-purse-panel">
            <div className="purse-panel-top">
              <div>
                <Wallet size={17} />
                <span>YOUR REMAINING PURSE</span>
              </div>
              <span className="you-label">YOU</span>
            </div>

            <strong>
              ₹{formatCr(remainingPurse)} <small>CR</small>
            </strong>

            <div className="purse-track">
              <div
                style={{
                  width: `${
                    purseLimit
                      ? Math.max(
                          0,
                          Math.min(100, (remainingPurse / purseLimit) * 100)
                        )
                      : 0
                  }%`,
                }}
              />
            </div>

            <div className="my-purse-footer">
              <span>
                {myParticipant?.franchise || "No franchise selected"}
              </span>
              <span>
                {squadSize}/{maxSquadSize} players
              </span>
            </div>
          </section>

          {/* OPPONENT PURSES */}

          <section className="opponent-purses-panel">
            <div className="right-section-heading">
              <div>
                <Wallet size={16} />
                <h3>OPPONENT PURSES</h3>
              </div>
              <span>{Math.max(0, participants.length - 1)} TEAMS</span>
            </div>

            <div className="opponent-purse-list">
              {participants
                .filter((participant) => participant.guestId !== guestId)
                .sort(
                  (a, b) =>
                    Number(b.remainingPurse ?? purseLimit) -
                    Number(a.remainingPurse ?? purseLimit)
                )
                .map((participant) => (
                  <div
                    className="opponent-purse-row"
                    key={participant.guestId}
                  >
                    <div className="opponent-team-mark">
                      {participant.franchise?.slice(0, 1) || "?"}
                    </div>

                    <div className="opponent-team-name">
                      <strong>
                        {participant.franchise || "No team"}
                      </strong>
                      <span>
                        {participant.squad?.length || 0} players
                      </span>
                    </div>

                    <strong className="opponent-purse-value">
                      ₹{formatCr(participant.remainingPurse ?? purseLimit)} Cr
                    </strong>
                  </div>
                ))}

              {participants.length <= 1 && (
                <p className="empty-squad">
                  No opponent franchises yet.
                </p>
              )}
            </div>
          </section>
        </aside>
      </main>

      {/* TEAM SQUADS */}

      <section className="bottom-squads-section">
        <div className="bottom-squads-heading">
          <div>
            <span>THE AUCTION ROSTERS</span>
            <h2>TEAM SQUADS</h2>
          </div>

          <span>{participants.length} FRANCHISES</span>
        </div>

        <div className="bottom-squads-grid">
          {participants.map((participant) => {
            const squad = participant.squad || [];

            return (
              <article
                className={`bottom-squad-card ${
                  participant.guestId === guestId ? "my-squad-card" : ""
                }`}
                key={participant.guestId}
              >
                <div className="bottom-squad-card-heading">
                  <div className="bottom-squad-mark">
                    {participant.franchise?.slice(0, 1) || "?"}
                  </div>

                  <div>
                    <strong>
                      {participant.franchise || "No franchise"}
                    </strong>
                    <span>
                      {squad.length}/{maxSquadSize} PLAYERS
                    </span>
                  </div>

                  {participant.guestId === guestId && (
                    <span className="squad-you-label">YOU</span>
                  )}
                </div>

                <div className="bottom-squad-players">
                  {squad.length > 0 ? (
                    squad.map((player, index) => (
                      <div
                        className="bottom-squad-player"
                        key={player.playerId || player.playerName || index}
                      >
                        <PlayerImage
                          imagePath={player.imagePath}
                          alt={player.playerName}
                        />

                        <div>
                          <strong>{player.playerName}</strong>
                          <span>{player.role || "Player"}</span>
                        </div>

                        <b>
                          ₹{formatCr(player.purchasePrice)} Cr
                        </b>
                      </div>
                    ))
                  ) : (
                    <p className="empty-squad">
                      No players purchased yet
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <footer className="arena-broadcast-footer">
        <Radio size={13} />
        <span>LIVE AUCTION</span>
        <span className="broadcast-footer-dot" />
        <span>ROOM {room.roomCode}</span>
      </footer>
    </div>
  );
}