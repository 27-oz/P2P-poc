const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, { cors: { origin: "*" } });

let chimeraState = {
  nodes: {}, 
  lastCommand: null,
  logs: []
};

io.on("connection", (socket) => {
  socket.on("nodeSync", (data) => {
    chimeraState.nodes[data.nodeType] = {
      id: socket.id,
      stats: data.stats,
      lastSeen: new Date().toLocaleTimeString()
    };
    console.log(`Node Synced: ${data.nodeType}`);
    io.emit("stateUpdate", chimeraState);
  });

  socket.on("injectIntent", (intent) => {
    console.log("New Intent:", intent);
    io.emit("status", `Processing intent: ${intent}`);
  });

  socket.on("execute", (data) => {
    if(chimeraState.nodes[data.target]) {
        io.to(chimeraState.nodes[data.target].id).emit("runCode", data.code);
    }
  });

  socket.on("disconnect", () => {
    for (let type in chimeraState.nodes) {
      if (chimeraState.nodes[type].id === socket.id) delete chimeraState.nodes[type];
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log("Chimera Core Active"));
