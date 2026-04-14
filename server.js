const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });

const PROMPTS = [
  { word: "MARS", forbidden: ["planet", "red", "space", "elon"] },
  { word: "GUITAR", forbidden: ["music", "strings", "instrument", "rock"] }
];

let waitingQueue = [];

io.on("connection", (socket) => {
  socket.on("findMatch", (userData) => {
    const newUser = { id: socket.id, username: userData.username || "Guest", points: userData.points || 0 };
    let matchIndex = waitingQueue.findIndex(u => Math.abs(u.points - newUser.points) <= 100);

    if (matchIndex !== -1) {
      const opponent = waitingQueue.splice(matchIndex, 1)[0];
      const roomName = `room-${socket.id}-${opponent.id}`;
      const selectedPrompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
      socket.join(roomName);
      io.sockets.sockets.get(opponent.id).join(roomName);
      const isSocketDescriber = Math.random() > 0.5;

      io.to(socket.id).emit("matchFound", { room: roomName, role: isSocketDescriber ? "describer" : "guesser", opponent: opponent.username, prompt: isSocketDescriber ? selectedPrompt : null });
      io.to(opponent.id).emit("matchFound", { room: roomName, role: isSocketDescriber ? "guesser" : "describer", opponent: newUser.username, prompt: isSocketDescriber ? null : selectedPrompt });
    } else {
      waitingQueue.push(newUser);
      socket.emit("status", "Searching...");
    }
  });

  socket.on("chatMessage", (data) => {
    socket.to(data.room).emit("message", { user: data.username, text: data.text });
  });

  socket.on("disconnect", () => {
    waitingQueue = waitingQueue.filter(u => u.id !== socket.id);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log("Server Active"));
