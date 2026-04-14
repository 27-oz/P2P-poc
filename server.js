const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

let chimeraState = { nodes: {} };

io.on("connection", (socket) => {
  socket.on("nodeSync", (data) => {
    chimeraState.nodes[data.nodeType] = { id: socket.id };
    console.log(`Node Connected: ${data.nodeType}`);
  });

  socket.on("injectIntent", async (intent) => {
    console.log("Intent Received:", intent);
    const prompt = `You are the Chimera OS Brain. User intent: "${intent}". 
    If this requires a Windows command, respond "WIN:command". 
    If it requires a Termux command, respond "TRM:command". 
    Otherwise, just chat.`;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        if (responseText.startsWith("WIN:")) {
            const code = responseText.replace("WIN:", "").trim();
            if(chimeraState.nodes["WINDOWS_NODE"]) io.to(chimeraState.nodes["WINDOWS_NODE"].id).emit("runCode", code);
        } else if (responseText.startsWith("TRM:")) {
            const code = responseText.replace("TRM:", "").trim();
            if(chimeraState.nodes["TERMUX_NODE"]) io.to(chimeraState.nodes["TERMUX_NODE"].id).emit("runCode", code);
        } else {
            io.emit("message", { user: "CHIMERA_AI", text: responseText });
        }
    } catch (e) {
        io.emit("status", "Brain Error: Check API Key.");
    }
  });

  socket.on("execute", (data) => {
    if(chimeraState.nodes[data.target]) {
        io.to(chimeraState.nodes[data.target].id).emit("runCode", data.code);
    }
  });

  socket.on("chatMessage", (data) => {
    socket.broadcast.emit("message", data); 
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log("Chimera Core Live"));
