
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./CreateRoom.css";

export default function CreateRoom() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    displayName: "",
    roomName: "",
    maxTeams: "10",
    purse: "120",
    squadSize: "18",
    bidTimer: "15",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const displayName = form.displayName.trim();

    if (!displayName) {
      setError("Please enter your name.");
      return;
    }

    // Persistent guest ID for this browser.
    let guestId = localStorage.getItem("bidxi_guest_id");

    if (!guestId) {
      guestId = crypto.randomUUID();
      localStorage.setItem("bidxi_guest_id", guestId);
    }

    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          guestId,
          displayName,
          roomName: form.roomName.trim() || "IPL Mega Auction",
          maxTeams: Number(form.maxTeams),
          purse: Number(form.purse),
          squadSize: Number(form.squadSize),
          bidTimer: Number(form.bidTimer),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Could not create room.");
      }

      navigate(`/room/${data.room.roomCode}`);
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Cannot connect to the server. Make sure the backend is running."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="create-page">
      <button className="create-back" onClick={() => navigate("/")}>
        ← Back home
      </button>

      <section className="create-card">
        <p className="create-eyebrow">BIDXI · ROOM SETUP</p>
        <h1>Create your room.</h1>
        <p className="create-description">
          Set up your auction and invite your friends.
        </p>

        <form onSubmit={handleSubmit} className="create-form">
          <label>
            Your display name
            <input
              name="displayName"
              value={form.displayName}
              onChange={handleChange}
              placeholder="Enter your name"
              maxLength={24}
              required
            />
          </label>

          <label>
            Room name <span>(optional)</span>
            <input
              name="roomName"
              value={form.roomName}
              onChange={handleChange}
              placeholder="IPL Mega Auction"
              maxLength={50}
            />
          </label>

          <div className="create-fields">
            <label>
              Maximum teams
              <select name="maxTeams" value={form.maxTeams} onChange={handleChange}>
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>{n} teams</option>
                ))}
              </select>
            </label>

            <label>
              Purse per team
              <select name="purse" value={form.purse} onChange={handleChange}>
                <option value="100">₹100 Cr</option>
                <option value="120">₹120 Cr</option>
                <option value="150">₹150 Cr</option>
              </select>
            </label>

            <label>
              Squad size
              <select name="squadSize" value={form.squadSize} onChange={handleChange}>
                <option value="15">15 players</option>
                <option value="18">18 players</option>
                <option value="25">25 players</option>
              </select>
            </label>

            <label>
              Bid timer
              <select name="bidTimer" value={form.bidTimer} onChange={handleChange}>
                <option value="10">10 seconds</option>
                <option value="15">15 seconds</option>
                <option value="20">20 seconds</option>
                <option value="30">30 seconds</option>
              </select>
            </label>
          </div>

          {error && <p className="create-error">{error}</p>}

          <button className="create-submit" type="submit" disabled={loading}>
            {loading ? "Creating room..." : "Create Room →"}
          </button>
        </form>
      </section>
    </main>
  );
}
