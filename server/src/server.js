
require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const connectDB = require("./config/db");
const { resumeActiveAuctions } = require("./services/auctionService");

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Make Socket.IO available to Express controllers.
app.set("io", io);

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("joinRoom", (roomCode) => {
    if (typeof roomCode !== "string") return;

    const code = roomCode.trim().toUpperCase();

    if (!/^[A-F0-9]{6}$/.test(code)) return;

    socket.join(code);
    console.log(`Socket ${socket.id} joined room ${code}`);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// Start server
async function startServer() {
  try {
    // Connect to MongoDB first
    await connectDB();

    // Recover active auctions after server restart
    await resumeActiveAuctions(io);

    // Start listening
    server.listen(PORT, () => {
      console.log(`BidXI server running on http://localhost:${PORT}`);
      console.log("Socket.IO is ready!");
    });
  } catch (error) {
    console.error("Failed to start BidXI server:", error);
    process.exit(1);
  }
}

startServer();
