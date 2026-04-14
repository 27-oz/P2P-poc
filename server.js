const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Setup Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

let waitingQueue = [];

async function generateGameData() {
  const prompt = `Generate a random object or concept for a guessing game. 
  Return JSON format: {"word": "THE_WORD", "forbidden": ["word1", "word2", "word3", "word4"]}. 
  The forbidden words should be the most obvious clues.`;
  
  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
  } catch (e) {
    return { word: "FIRE", forbidden: ["hot", "red", "burn", "flame"] }; // Fallback
  }
}

io.on("connection", (socket) => {
  socket.on("findMatch", async (userData) => {
    const newUser = { id: socket.id, username: userData.username, points: userData.points || 0 };
    let matchIndex = waitingQueue.findIndex(u => Math.abs(u.points - newUser.points) <= 150);

    if (matchIndex !== -1) {
      const opponent = waitingQueue.splice(matchIndex, 1)[0];
      const roomName = `room-${socket.id}-${opponent.id}`;
      const gameData = await generateGameData();
      
      socket.join(roomName);
      io.sockets.sockets.get(opponent.id).join(roomName);
      
      const isSocketDescriber = Math.random() > 0.5;
      const roles = {
        describer: isSocketDescriber ? socket.id : opponent.id,
        guesser: isSocketDescriber ? opponent.id : socket.id,
        prompt: gameData
      };

      io.to(roomName).emit("matchFound", {
        room: roomName,
        describer: isSocketDescriber ? newUser.username : opponent.username,
        guesser: isSocketDescriber ? opponent.username : newUser.username,
        roleData: roles // Simplified for PoC
      });

      // Send the secret info only to the describer
      io.to(roles.describer).emit("gameUpdate", { role: "describer", prompt: gameData });
      io.to(roles.guesser).emit("gameUpdate", { role: "guesser" });

    } else {
      waitingQueue.push(newUser);
      socket.emit("status", "Searching for someone at your skill level...");
    }
  });

  socket.on("chatMessage", async (data) => {
    // Relay message
    socket.to(data.room).emit("message", { user: data.username, text: data.text });

    // AI JUDGE LOGIC (Simple check first)
    if (data.text.toLowerCase().includes(data.promptWord?.toLowerCase())) {
        io.to(data.room).emit("status", `🎉 ${data.username} GUESSED IT! The word was ${data.promptWord}`);
    }
  });

  socket.on("disconnect", () => {
    waitingQueue = waitingQueue.filter(u => u.id !== socket.id);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log("AI Server Active"));
