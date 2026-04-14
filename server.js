const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

let nodes = {};

io.on("connection", (socket) => {
  socket.on("nodeSync", (data) => {
    nodes[data.nodeType] = { id: socket.id };
    console.log(`${data.nodeType} Linked.`);
  });

  socket.on("injectIntent", async (intent) => {
    const prompt = `System: Chimera OS. Context: Win and Termux connected. Intent: "${intent}". 
    If Win command needed: "WIN:command". If Termux command: "TRM:command". Else: chat.`;
    try {
      const result = await model.generateContent(prompt);
      const res = result.response.text();
      if (res.startsWith("WIN:") && nodes["WINDOWS_NODE"]) {
        io.to(nodes["WINDOWS_NODE"].id).emit("runCode", res.replace("WIN:", "").trim());
      } else if (res.startsWith("TRM:") && nodes["TERMUX_NODE"]) {
        io.to(nodes["TERMUX_NODE"].id).emit("runCode", res.replace("TRM:", "").trim());
      } else {
        io.emit("message", { user: "CHIMERA_AI", text: res });
      }
    } catch (e) { io.emit("status", "Brain Error (Check Key)"); }
  });

  socket.on("execute", (data) => {
    if(nodes[data.target]) io.to(nodes[data.target].id).emit("runCode", data.code);
  });

  socket.on("chatMessage", (data) => socket.broadcast.emit("message", data));
});

http.listen(process.env.PORT || 3000, () => console.log("Core Online"));
