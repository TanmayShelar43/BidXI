
import { useMemo, useState } from "react";
import {
  Trophy,
  Users,
  Wallet,
  TrendingUp,
  Search,
  UserX,
  Crown,
  IndianRupee,
} from "lucide-react";
import "./AuctionResults.css";

const DEFAULT_PLAYER_IMAGE = "/images/default-player.png";

const getPlayerImage = (imagePath) => {
  if (!imagePath) return DEFAULT_PLAYER_IMAGE;

  const filename = imagePath.split(/[\\/]/).pop();
  return `/images/${encodeURIComponent(filename)}`;
};

function PlayerImage({ imagePath, alt }) {
  const [src, setSrc] = useState(getPlayerImage(imagePath));

  return (
    <img
      src={src}
      alt={alt || "Player"}
      className="results-player-image"
      onError={() => {
        if (src !== DEFAULT_PLAYER_IMAGE) {
          setSrc(DEFAULT_PLAYER_IMAGE);
        }
      }}
    />
  );
}

const formatCr = (value) =>
  `₹${Number(value || 0).toFixed(2).replace(/\.?0+$/, "")} Cr`;

export default function AuctionResults({ room }) {
  const [search, setSearch] = useState("");

  const players = room?.players || [];
  const participants = room?.participants || [];

  const soldPlayers = players.filter(
    (player) => player.status === "sold"
  );

  const unsoldPlayers = players.filter(
    (player) => player.status === "unsold"
  );

  const totalSpend = soldPlayers.reduce(
    (sum, player) => sum + Number(player.soldPrice || 0),
    0
  );

  const averagePrice = soldPlayers.length
    ? totalSpend / soldPlayers.length
    : 0;

  const mostExpensivePlayer = soldPlayers.reduce(
    (highest, player) =>
      !highest ||
      Number(player.soldPrice || 0) >
        Number(highest.soldPrice || 0)
        ? player
        : highest,
    null
  );

  const franchiseData = useMemo(() => {
    return participants
      .map((participant) => {
        const squad = participant.squad || [];

        const spent = squad.reduce(
          (sum, player) =>
            sum + Number(player.purchasePrice || 0),
          0
        );

        return {
          ...participant,
          squad,
          spent,
          playerCount: squad.length,
        };
      })
      .sort((a, b) => b.spent - a.spent);
  }, [participants]);

  const highestSpendingFranchise = franchiseData[0];

  const filteredUnsoldPlayers = unsoldPlayers.filter((player) =>
    `${player.playerName} ${player.role} ${player.country}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const statCards = [
    {
      label: "TOTAL PLAYERS",
      value: players.length,
      icon: Users,
      color: "blue",
    },
    {
      label: "PLAYERS SOLD",
      value: soldPlayers.length,
      icon: Trophy,
      color: "green",
    },
    {
      label: "UNSOLD PLAYERS",
      value: unsoldPlayers.length,
      icon: UserX,
      color: "red",
    },
    {
      label: "TOTAL SPENT",
      value: formatCr(totalSpend),
      icon: Wallet,
      color: "gold",
    },
  ];

  return (
    <div className="results-page">
      <nav className="results-navbar">
        <div className="results-brand">
          <span className="results-brand-mark">B</span>
          <span>BID<span>XI</span></span>
        </div>

        <div className="results-nav-right">
          <span className="results-room-code">
            ROOM: {room?.roomCode}
          </span>
          <span className="results-completed-badge">
            <span />
            AUCTION COMPLETED
          </span>
        </div>
      </nav>

      <main className="results-container">
        {/* AUCTION STATISTICS */}
        <section className="results-section">
          <div className="results-section-heading">
            <div>
              <span className="results-eyebrow">AUCTION SUMMARY</span>
              <h1>Auction Statistics</h1>
              <p>Complete breakdown of the auction.</p>
            </div>
          </div>

          <div className="results-stats-grid">
            {statCards.map((stat) => {
              const Icon = stat.icon;

              return (
                <div
                  className={`results-stat-card ${stat.color}`}
                  key={stat.label}
                >
                  <div className="results-stat-top">
                    <span>{stat.label}</span>
                    <Icon size={19} />
                  </div>

                  <strong>{stat.value}</strong>
                </div>
              );
            })}
          </div>

          <div className="results-highlights-grid">
            <div className="results-highlight-card">
              <div className="results-highlight-icon gold">
                <Crown size={21} />
              </div>
              <div>
                <span>MOST EXPENSIVE PLAYER</span>
                <h3>
                  {mostExpensivePlayer?.playerName || "—"}
                </h3>
                <strong>
                  {mostExpensivePlayer
                    ? formatCr(mostExpensivePlayer.soldPrice)
                    : "No sales"}
                </strong>
              </div>
            </div>

            <div className="results-highlight-card">
              <div className="results-highlight-icon purple">
                <TrendingUp size={21} />
              </div>
              <div>
                <span>HIGHEST SPENDING FRANCHISE</span>
                <h3>
                  {highestSpendingFranchise?.franchise || "—"}
                </h3>
                <strong>
                  {highestSpendingFranchise
                    ? formatCr(highestSpendingFranchise.spent)
                    : "—"}
                </strong>
              </div>
            </div>

            <div className="results-highlight-card">
              <div className="results-highlight-icon blue">
                <IndianRupee size={21} />
              </div>
              <div>
                <span>AVERAGE SELLING PRICE</span>
                <h3>{formatCr(averagePrice)}</h3>
                <strong>Per sold player</strong>
              </div>
            </div>
          </div>
        </section>

        {/* FRANCHISE-WISE SQUADS */}
        <section className="results-section">
          <div className="results-section-heading">
            <div>
              <span className="results-eyebrow">TEAM BREAKDOWN</span>
              <h2>Final Squads</h2>
              <p>Every franchise and its purchased players.</p>
            </div>

            <span className="results-section-count">
              {participants.length} FRANCHISES
            </span>
          </div>

          <div className="results-franchise-grid">
            {franchiseData.map((team, index) => (
              <article
                className="results-franchise-card"
                key={team.guestId || team.franchise}
              >
                <div className="results-franchise-header">
                  <div className="results-franchise-title">
                    <span className="results-team-rank">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3>{team.franchise}</h3>
                      <span>
                        {team.playerCount} PLAYERS PURCHASED
                      </span>
                    </div>
                  </div>

                  <div className="results-team-spent">
                    <span>TOTAL SPENT</span>
                    <strong>{formatCr(team.spent)}</strong>
                  </div>
                </div>

                <div className="results-team-finances">
                  <div>
                    <span>Remaining Purse</span>
                    <strong>
                      {formatCr(team.remainingPurse)}
                    </strong>
                  </div>
                  <div>
                    <span>Squad Size</span>
                    <strong>
                      {team.playerCount}/
                      {room?.settings?.squadSize || "—"}
                    </strong>
                  </div>
                </div>

                <div className="results-squad-list">
                  {team.squad.length > 0 ? (
                    team.squad.map((player, playerIndex) => (
                      <div
                        className="results-squad-player"
                        key={
                          player.playerId ||
                          `${player.playerName}-${playerIndex}`
                        }
                      >
                        <PlayerImage
                          imagePath={player.imagePath}
                          alt={player.playerName}
                        />

                        <div className="results-squad-player-info">
                          <strong>{player.playerName}</strong>
                          <span>
                            {player.role || "Player"}
                            {player.country
                              ? ` · ${player.country}`
                              : ""}
                          </span>
                        </div>

                        <strong className="results-player-price">
                          {formatCr(player.purchasePrice)}
                        </strong>
                      </div>
                    ))
                  ) : (
                    <div className="results-empty-squad">
                      No players purchased
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* UNSOLD PLAYERS */}
        <section className="results-section results-unsold-section">
          <div className="results-section-heading">
            <div>
              <span className="results-eyebrow">AVAILABLE PLAYERS</span>
              <h2>Unsold Players</h2>
              <p>Players who remained unsold during the auction.</p>
            </div>

            <span className="results-unsold-count">
              {unsoldPlayers.length} UNSOLD
            </span>
          </div>

          {unsoldPlayers.length > 0 ? (
            <>
              <div className="results-search">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Search player, role or country..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <div className="results-unsold-grid">
                {filteredUnsoldPlayers.map((player, index) => (
                  <div
                    className="results-unsold-player"
                    key={player._id || `${player.playerName}-${index}`}
                  >
                    <PlayerImage
                      imagePath={player.imagePath}
                      alt={player.playerName}
                    />

                    <div className="results-unsold-info">
                      <strong>{player.playerName}</strong>
                      <span>
                        {player.role || "Player"}
                        {player.country ? ` · ${player.country}` : ""}
                      </span>
                    </div>

                    <div className="results-base-price">
                      <span>BASE PRICE</span>
                      <strong>{formatCr(player.basePrice)}</strong>
                    </div>
                  </div>
                ))}
              </div>

              {filteredUnsoldPlayers.length === 0 && (
                <div className="results-empty-state">
                  No players match your search.
                </div>
              )}
            </>
          ) : (
            <div className="results-empty-state">
              <Trophy size={30} />
              <h3>All players were sold!</h3>
              <p>There are no unsold players in this auction.</p>
            </div>
          )}
        </section>

        <footer className="results-footer">
          <span>BIDXI</span>
          <p>AUCTION RESULTS · {room?.roomCode}</p>
        </footer>
      </main>
    </div>
  );
}
