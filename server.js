const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });

let chimeraState = { nodes: {} };

io.on("connection", (socket) => {
  socket.on("nodeSync", (data) => {
    chimeraState.nodes[data.nodeType] = { id: socket.id };
    console.log(`Node Connected: ${data.nodeType}`);
  });

  socket.on("injectIntent", (intent) => {
    // This is where Gemini will eventually live. For now, it just logs.
    console.log("Intent Received:", intent);
    io.emit("status", `Processing intent: ${intent}`);
  });

  socket.on("execute", (data) => {
    if(chimeraState.nodes["WINDOWS_NODE"]) {
        io.to(chimeraState.nodes["WINDOWS_NODE"].id).emit("runCode", data.code);
    }
  });

  // THIS IS THE FIX: It catches the output from Windows and sends it to Termux
  socket.on("chatMessage", (data) => {
    console.log("Relaying result...");
    socket.broadcast.emit("message", data); 
  });

  socket.on("disconnect", () => {
    for (let type in chimeraState.nodes) {
      if (chimeraState.nodes[type].id === socket.id) delete chimeraState.nodes[type];
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log("Chimera Core Live"));
