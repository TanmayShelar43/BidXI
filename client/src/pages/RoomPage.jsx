
import { io } from "socket.io-client";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Copy,
  Check,
  Users,
  ShieldCheck,
  ArrowLeft,
  LoaderCircle,
  CheckCircle2,
  LockKeyhole,
  Upload,
  FileSpreadsheet,
} from "lucide-react";
import "./RoomPage.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function RoomPage() {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const [selectingFranchise, setSelectingFranchise] = useState(false);
  const [franchiseError, setFranchiseError] = useState("");
  const [franchiseSuccess, setFranchiseSuccess] = useState("");

  const [guestId] = useState(() =>
    localStorage.getItem("bidxi_guest_id")
  );

  // Excel upload states
  const [excelFile, setExcelFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  // Start auction states
  const [startingAuction, setStartingAuction] = useState(false);
  const [startError, setStartError] = useState("");

  // Socket connection and room fetching
  useEffect(() => {
    let active = true;

    const socket = io(API_URL);

    socket.on("connect", () => {
      socket.emit("joinRoom", roomCode);
    });

    socket.on("roomUpdated", (updatedRoom) => {
      if (
        active &&
        updatedRoom?.roomCode === roomCode.toUpperCase()
      ) {
        setRoom(updatedRoom);
        setError("");
        setLoading(false);

        // Automatically redirect every participant
        // when the host starts the auction.
        if (updatedRoom.status === "auction") {
          navigate(`/room/${roomCode}/auction`);
        }
      }
    });

    async function fetchRoom() {
      try {
        const response = await fetch(
          `${API_URL}/api/rooms/${roomCode}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Room not found.");
        }

        if (active) {
          setRoom(data.room);
          setError("");

          // If auction has already started,
          // directly open the auction page.
          if (data.room.status === "auction") {
            navigate(`/room/${roomCode}/auction`);
          }
        }
      } catch (err) {
        if (active) {
          setError(
            err.message === "Failed to fetch"
              ? "Cannot connect to the server. Is the backend running?"
              : err.message
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchRoom();

    return () => {
      active = false;
      socket.disconnect();
    };
  }, [roomCode, navigate]);

  // Copy room code
  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setError("Room code copy nahi hua. Code manually copy kar lo.");
    }
  }

  // Select franchise
  async function chooseFranchise(franchise) {
    setFranchiseError("");
    setFranchiseSuccess("");

    if (!guestId) {
      setFranchiseError(
        "Guest ID nahi mili. Home page se dobara join karo."
      );
      return;
    }

    setSelectingFranchise(true);

    try {
      const response = await fetch(
        `${API_URL}/api/rooms/${roomCode}/franchise`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            guestId,
            franchise,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not select franchise."
        );
      }

      setRoom(data.room);
      setFranchiseSuccess(`${franchise} selected successfully!`);
    } catch (err) {
      setFranchiseError(err.message);
    } finally {
      setSelectingFranchise(false);
    }
  }

  // Select Excel file
  function handleExcelChange(event) {
    const file = event.target.files?.[0];

    setUploadError("");
    setUploadSuccess("");
    setExcelFile(null);

    if (!file) return;

    const validExtension = /\.(xlsx|xls)$/i.test(file.name);

    if (!validExtension) {
      setUploadError("Please select an Excel file (.xlsx or .xls).");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File size must be less than 5 MB.");
      event.target.value = "";
      return;
    }

    setExcelFile(file);
  }

  // Upload Excel to backend
  async function uploadExcel() {
    if (!excelFile) {
      setUploadError("Please select an Excel file first.");
      return;
    }

    if (!guestId) {
      setUploadError("Guest ID not found. Please rejoin the room.");
      return;
    }

    setUploading(true);
    setUploadError("");
    setUploadSuccess("");

    try {
      const formData = new FormData();

      formData.append("playersFile", excelFile);
      formData.append("guestId", guestId);

      const response = await fetch(
        `${API_URL}/api/rooms/${roomCode}/players/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const details = data.errors?.join("\n");

        throw new Error(
          details || data.message || "Player upload failed."
        );
      }

      setUploadSuccess(
        `Successfully imported ${data.totalPlayers} players!`
      );

      // Refresh actual room data from backend.
      const roomResponse = await fetch(
        `${API_URL}/api/rooms/${roomCode}`
      );

      const roomData = await roomResponse.json();

      if (roomResponse.ok) {
        setRoom(roomData.room);
      }

      setExcelFile(null);

      const fileInput = document.getElementById("players-excel");

      if (fileInput) {
        fileInput.value = "";
      }
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  // Start auction
  async function startAuction() {
    if (!guestId) {
      setStartError("Guest ID not found. Please rejoin the room.");
      return;
    }

    setStartingAuction(true);
    setStartError("");

    try {
      const response = await fetch(
        `${API_URL}/api/rooms/${roomCode}/auction/start`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ guestId }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not start auction."
        );
      }

      if (data.room) {
        setRoom(data.room);
      }

      navigate(`/room/${roomCode}/auction`);
    } catch (err) {
      setStartError(err.message);
    } finally {
      setStartingAuction(false);
    }
  }

  // Loading screen
  if (loading) {
    return (
      <main className="lobby-page lobby-center">
        <LoaderCircle className="lobby-spinner" size={32} />
        <p>Opening your room...</p>
      </main>
    );
  }

  // Error screen
  if (error || !room) {
    return (
      <main className="lobby-page lobby-center">
        <h2>Room nahi mila.</h2>

        <p className="lobby-error">
          {error || "Invalid room code."}
        </p>

        <button
          className="lobby-primary"
          onClick={() => navigate("/")}
        >
          <ArrowLeft size={17} />
          Back home
        </button>
      </main>
    );
  }

  const participants = room.participants || [];
  const players = room.players || [];

  const franchises = [
    { code: "CSK", name: "Chennai Super Kings", color: "#F5C542" },
    { code: "DC", name: "Delhi Capitals", color: "#5B9BFF" },
    { code: "GT", name: "Gujarat Titans", color: "#8FA3B8" },
    { code: "KKR", name: "Kolkata Knight Riders", color: "#A78BFA" },
    { code: "LSG", name: "Lucknow Super Giants", color: "#55C9D8" },
    { code: "MI", name: "Mumbai Indians", color: "#5799FF" },
    { code: "PBKS", name: "Punjab Kings", color: "#F87171" },
    { code: "RR", name: "Rajasthan Royals", color: "#F472B6" },
    { code: "RCB", name: "Royal Challengers Bengaluru", color: "#FB7185" },
    { code: "SRH", name: "Sunrisers Hyderabad", color: "#FB923C" },
  ];

  const currentParticipant = participants.find(
    (participant) => participant.guestId === guestId
  );

  const isRoomCreator = room.hostId === guestId;

  const selectedFranchises = participants
    .filter((participant) => participant.franchise)
    .map((participant) => participant.franchise);

  const allFranchisesSelected =
    participants.length > 0 &&
    participants.every((participant) => participant.franchise);

  const canStartAuction =
    isRoomCreator &&
    room.status === "waiting" &&
    players.length > 0 &&
    allFranchisesSelected;

  // Group players by set
  const setSummary = players.reduce((summary, player) => {
    if (player.set) {
      summary[player.set] = (summary[player.set] || 0) + 1;
    }

    return summary;
  }, {});

  return (
    <main className="lobby-page">
      <header className="lobby-navbar">
        <button
          className="lobby-brand"
          onClick={() => navigate("/")}
        >
          <span className="lobby-brand-icon">B</span>
          BidXI<span className="lobby-brand-dot">.</span>
        </button>

        <span className="lobby-status">
          <span className="lobby-live-dot" />
          WAITING LOBBY
        </span>
      </header>

      <section className="lobby-content">
        <p className="lobby-eyebrow">YOUR AUCTION STARTS HERE</p>

        <h1>{room.roomName || "IPL Mega Auction"}</h1>

        <p className="lobby-subtitle">
          Invite your friends. Pick your franchises. Own the auction.
        </p>

        {/* Room code */}
        <section className="lobby-code-card">
          <div>
            <p className="lobby-label">YOUR ROOM CODE</p>

            <div className="lobby-room-code">
              {room.roomCode || roomCode}
            </div>

            <p className="lobby-hint">
              Share this code with your friends to join.
            </p>
          </div>

          <button
            className="lobby-copy-button"
            onClick={copyRoomCode}
          >
            {copied ? <Check size={17} /> : <Copy size={17} />}
            {copied ? "Copied!" : "Copy code"}
          </button>
        </section>

        {/* Excel Player Upload */}
        {isRoomCreator && room.status === "waiting" && (
          <section className="lobby-panel">
            <div className="lobby-panel-heading">
              <div>
                <h2>Upload auction players</h2>
                <p>Import your player list using an Excel file.</p>
              </div>

              <FileSpreadsheet size={25} />
            </div>

            <label
              htmlFor="players-excel"
              className="lobby-label"
            >
              Select Excel file
            </label>

            <input
              id="players-excel"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelChange}
              disabled={uploading}
            />

            {excelFile && (
              <p className="lobby-hint">
                Selected: {excelFile.name}
              </p>
            )}

            <button
              className="lobby-primary"
              type="button"
              onClick={uploadExcel}
              disabled={!excelFile || uploading}
            >
              {uploading ? (
                <>
                  <LoaderCircle
                    size={17}
                    className="lobby-spinner"
                  />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={17} />
                  Upload players
                </>
              )}
            </button>

            {uploadError && (
              <p
                className="lobby-error"
                style={{ whiteSpace: "pre-line" }}
              >
                {uploadError}
              </p>
            )}

            {uploadSuccess && (
              <p className="franchise-success">
                {uploadSuccess}
              </p>
            )}
          </section>
        )}

        {/* Imported player summary */}
        <section className="lobby-panel">
          <div className="lobby-panel-heading">
            <div>
              <h2>Auction player pool</h2>
              <p>Players available for this room's auction</p>
            </div>

            <span className="lobby-count">
              {players.length} players
            </span>
          </div>

          {players.length > 0 ? (
            <div className="lobby-participants">
              {Object.entries(setSummary).map(([set, count]) => {
                const setPlayers = players.filter(
                  (player) => player.set === set
                );

                return (
                  <div
                    key={set}
                    style={{ marginBottom: "24px" }}
                  >
                    <div className="lobby-setting-row">
                      <strong>{set}</strong>
                      <span>{count} players</span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(220px, 1fr))",
                        gap: "12px",
                        marginTop: "12px",
                      }}
                    >
                      {setPlayers.map((player) => (
                        <div
                          key={player._id || player.playerName}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            padding: "12px",
                            borderRadius: "12px",
                            background: "rgba(255,255,255,0.05)",
                          }}
                        >
                          <img
                            src={`/players/${encodeURIComponent(
                              player.imagePath || ""
                            )}`}
                            alt={player.playerName}
                            style={{
                              width: "58px",
                              height: "65px",
                              objectFit: "cover",
                              borderRadius: "8px",
                            }}
                            onError={(e) => {
                              e.currentTarget.style.visibility = "hidden";
                            }}
                          />

                          <div style={{ minWidth: 0 }}>
                            <strong>{player.playerName}</strong>

                            <p
                              style={{
                                margin: "4px 0",
                                fontSize: "12px",
                              }}
                            >
                              {player.role}
                            </p>

                            <p
                              style={{
                                margin: 0,
                                fontSize: "12px",
                              }}
                            >
                              {player.country} · ₹{player.basePrice} Cr
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="lobby-hint">
              No players uploaded yet. The room creator can upload
              the Excel list.
            </p>
          )}
        </section>

        {/* Franchise selection */}
        <section className="lobby-panel franchise-panel">
          <div className="lobby-panel-heading">
            <div>
              <h2>Choose your franchise</h2>
              <p>
                Every franchise can belong to only one participant.
              </p>
            </div>

            <span className="lobby-count">
              {selectedFranchises.length}/10 selected
            </span>
          </div>

          {currentParticipant?.franchise && (
            <div className="franchise-selected-banner">
              <CheckCircle2 size={18} />
              You're representing {currentParticipant.franchise}
            </div>
          )}

          <div className="franchise-grid">
            {franchises.map((franchise) => {
              const owner = participants.find(
                (participant) =>
                  participant.franchise === franchise.code
              );

              const isMine = owner?.guestId === guestId;
              const isTaken = Boolean(owner);

              const isDisabled =
                selectingFranchise ||
                (isTaken && !isMine) ||
                room.status !== "waiting";

              return (
                <button
                  key={franchise.code}
                  type="button"
                  className={`franchise-card ${
                    isMine ? "is-mine" : ""
                  } ${isTaken && !isMine ? "is-taken" : ""}`}
                  style={{
                    "--franchise-color": franchise.color,
                  }}
                  disabled={isDisabled}
                  onClick={() => chooseFranchise(franchise.code)}
                >
                  <span className="franchise-code">
                    {franchise.code}
                  </span>

                  <strong>{franchise.name}</strong>

                  {isMine ? (
                    <span className="franchise-state">
                      <CheckCircle2 size={14} />
                      YOUR TEAM
                    </span>
                  ) : isTaken ? (
                    <span className="franchise-state">
                      <LockKeyhole size={13} />
                      {owner.displayName}
                    </span>
                  ) : (
                    <span className="franchise-state">
                      AVAILABLE
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {franchiseError && (
            <p className="lobby-error">{franchiseError}</p>
          )}

          {franchiseSuccess && (
            <p className="franchise-success">
              {franchiseSuccess}
            </p>
          )}
        </section>

        {/* Participants and settings */}
        <div className="lobby-grid">
          <section className="lobby-panel">
            <div className="lobby-panel-heading">
              <div>
                <h2>Players in the room</h2>
                <p>Everyone joining your auction</p>
              </div>

              <span className="lobby-count">
                <Users size={15} />
                {participants.length}/{room.maxTeams}
              </span>
            </div>

            <div className="lobby-participants">
              {participants.map((participant, index) => (
                <div
                  className="lobby-participant"
                  key={participant.guestId || index}
                >
                  <div className="lobby-avatar">
                    {(participant.displayName || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="lobby-player-info">
                    <strong>{participant.displayName}</strong>

                    <span>
                      {participant.isHost
                        ? "Room host"
                        : "Participant"}
                    </span>
                  </div>

                  {participant.isHost && (
                    <span className="lobby-host-badge">
                      <ShieldCheck size={13} />
                      HOST
                    </span>
                  )}
                </div>
              ))}

              {participants.length < room.maxTeams && (
                <div className="lobby-empty-slot">
                  <Users size={17} />
                  Waiting for more players...
                </div>
              )}
            </div>
          </section>

          <aside className="lobby-panel lobby-settings">
            <h2>Room settings</h2>
            <p>Your auction rules</p>

            <div className="lobby-setting-row">
              <span>Team slots</span>
              <strong>{room.maxTeams} teams</strong>
            </div>

            <div className="lobby-setting-row">
              <span>Team purse</span>
              <strong>
                ₹{room.settings?.purse ?? 120} Cr
              </strong>
            </div>

            <div className="lobby-setting-row">
              <span>Squad size</span>
              <strong>
                {room.settings?.squadSize ?? 18} players
              </strong>
            </div>

            <div className="lobby-setting-row">
              <span>Bid timer</span>
              <strong>
                {room.settings?.bidTimer ?? 30} sec
              </strong>
            </div>

            <div className="lobby-waiting-note">
              <span className="lobby-live-dot" />
              Auction hasn't started yet
            </div>
          </aside>
        </div>

        {/* Start Auction - Only room creator */}
        {isRoomCreator && room.status === "waiting" && (
          <section
            className="lobby-panel"
            style={{ textAlign: "center" }}
          >
            <h2>Ready to start the auction?</h2>

            <p>
              Make sure your players are uploaded and all
              participants have selected their franchises.
            </p>

            <button
              className="lobby-primary"
              onClick={startAuction}
              disabled={!canStartAuction || startingAuction}
              style={{
                margin: "20px auto 0",
                minWidth: "220px",
                justifyContent: "center",
              }}
            >
              {startingAuction ? (
                <>
                  <LoaderCircle
                    size={17}
                    className="lobby-spinner"
                  />
                  Starting Auction...
                </>
              ) : (
                <>
                  <ShieldCheck size={17} />
                  START AUCTION
                </>
              )}
            </button>

            {!canStartAuction && (
              <p className="lobby-hint">
                {players.length === 0
                  ? "Upload the player list first."
                  : !allFranchisesSelected
                    ? "Every participant must select a franchise."
                    : "Auction is not ready yet."}
              </p>
            )}

            {startError && (
              <p className="lobby-error">
                {startError}
              </p>
            )}
          </section>
        )}

        <div className="lobby-bottom-note">
          <span className="lobby-live-dot" />

          <span>
            You're in the lobby. Waiting for the auction to begin.
          </span>
        </div>
      </section>
    </main>
  );
}
