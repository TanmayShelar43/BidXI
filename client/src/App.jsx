
import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useParams,
} from "react-router-dom";

import "./App.css";
import CreateRoom from "./pages/CreateRoom";
import RoomPage from "./pages/RoomPage";
import AuctionPage from "./pages/AuctionPage";

// Auction route wrapper
function AuctionRoute() {
  const { roomCode } = useParams();
  const guestId = localStorage.getItem("bidxi_guest_id");

  return (
    <AuctionPage
      roomCode={roomCode}
      guestId={guestId}
    />
  );
}

function Home() {
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [joining, setJoining] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  async function joinRoom(e) {
    e.preventDefault();
    setError("");

    const code = roomCode.trim().toUpperCase();
    const name = displayName.trim();

    if (!name) {
      setError("Please enter your display name.");
      return;
    }

    if (!code) {
      setError("Please enter a room code.");
      return;
    }

    let guestId = localStorage.getItem("bidxi_guest_id");

    if (!guestId) {
      guestId = crypto.randomUUID();
      localStorage.setItem("bidxi_guest_id", guestId);
    }

    setJoining(true);

    try {
      const response = await fetch(
        `http://localhost:5000/api/rooms/${code}/join`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            guestId,
            displayName: name,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not join this room.");
      }

      navigate(`/room/${code}`);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Cannot connect to the server. Please check if the backend is running."
          : err.message
      );
    } finally {
      setJoining(false);
    }
  }

  return (
    <main className="page">
      {/* Navbar */}
      <nav className="navbar">
        <div className="logo">
          Bid<span>XI</span>
        </div>

        <span className="nav-label">IPL MEGA AUCTION</span>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <p className="eyebrow">
          YOUR FRIENDS. YOUR FRANCHISE. YOUR AUCTION.
        </p>

        <h1>
          The auction
          <br />
          <span>starts here.</span>
        </h1>

        <p className="subtitle">
          Create a room, bring your friends together, and build your
          ultimate IPL squad.
        </p>

        {/* Main Actions */}
        <div className="room-actions">
          <button
            className="primary-btn"
            onClick={() => navigate("/create-room")}
          >
            Create a Room
            <span>↗</span>
          </button>

          <button
            className={`secondary-btn ${showJoinForm ? "active" : ""}`}
            onClick={() => {
              setShowJoinForm(!showJoinForm);
              setError("");
            }}
          >
            {showJoinForm ? "Close" : "Join a Room"}
            <span>{showJoinForm ? "×" : "→"}</span>
          </button>
        </div>

        {/* Join Form - Only visible after clicking Join a Room */}
        {showJoinForm && (
          <div className="join-panel">
            <div className="join-heading">
              <h3>Join an existing room</h3>
              <p>
                Enter your name and the room code shared by your host.
              </p>
            </div>

            <form className="join-form" onSubmit={joinRoom}>
              <div className="input-group">
                <label htmlFor="displayName">Your name</label>

                <input
                  id="displayName"
                  type="text"
                  placeholder="Enter your display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={24}
                />
              </div>

              <div className="input-group">
                <label htmlFor="roomCode">Room code</label>

                <input
                  id="roomCode"
                  type="text"
                  placeholder="Enter 6-character room code"
                  value={roomCode}
                  onChange={(e) =>
                    setRoomCode(e.target.value.toUpperCase())
                  }
                  maxLength={6}
                />
              </div>

              <button type="submit" disabled={joining}>
                {joining ? "Joining..." : "Join Room"}
                {!joining && <span>→</span>}
              </button>
            </form>

            {error && (
              <p className="join-error" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </section>

      {/* How It Works */}
      <section className="how-section">
        <p className="eyebrow">
          THREE STEPS. ONE WINNING SQUAD.
        </p>

        <h2>HOW BIDXI WORKS</h2>

        <div className="steps">
          <article className="step">
            <span className="step-number">01</span>
            <h3>Create a room</h3>
            <p>
              Create your private auction room and invite your friends.
            </p>
          </article>

          <article className="step">
            <span className="step-number">02</span>
            <h3>Pick your team</h3>
            <p>
              Each participant chooses a unique IPL franchise.
            </p>
          </article>

          <article className="step">
            <span className="step-number">03</span>
            <h3>Start bidding</h3>
            <p>
              Manage your purse, compete on bids, and build your squad.
            </p>
          </article>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="logo">
          Bid<span>XI</span>
        </div>

        <p>Built for the love of the auction.</p>
      </footer>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create-room" element={<CreateRoom />} />
        <Route path="/room/:roomCode" element={<RoomPage />} />
        <Route
          path="/room/:roomCode/auction"
          element={<AuctionRoute />}
        />
      </Routes>
    </BrowserRouter>
  );
}
