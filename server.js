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
    
    // THE BRAIN: Gemini processes the intent
    const prompt = `You are the Chimera OS Brain. The user intent is: "${intent}". 
    If this requires a Windows command, respond ONLY with the command prefixed with "CMD:". 
    If it's a question, answer concisely. Windows is connected.`;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        if (responseText.startsWith("CMD:")) {
            const code = responseText.replace("CMD:", "").trim();
            if(chimeraState.nodes["WINDOWS_NODE"]) {
                io.to(chimeraState.nodes["WINDOWS_NODE"].id).emit("runCode", code);
                io.emit("status", `Brain executing: ${code}`);
            }
        } else {
            io.emit("message", { user: "CHIMERA_AI", text: responseText });
        }
    } catch (e) {
        io.emit("status", "Brain Error: Check API Key.");
    }
  });

  socket.on("execute", (data) => {
    if(chimeraState.nodes["WINDOWS_NODE"]) {
        io.to(chimeraState.nodes["WINDOWS_NODE"].id).emit("runCode", data.code);
    }
  });

  socket.on("chatMessage", (data) => {
    socket.broadcast.emit("message", data); 
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log("Chimera Core Live"));
