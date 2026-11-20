const http = require("http");
const { Server } = require("socket.io");

const httpServer = http.createServer((req, res) => { res.writeHead(200); res.end("ok"); });
const io = new Server(httpServer, { cors: { origin: "*" } });
let waiting = [];

function leave(s) {
  waiting = waiting.filter(w => w.id !== s.id);
  if (s.partner) {
    const p = io.sockets.sockets.get(s.partner);
    if (p) { p.partner = null; p.emit("partner_left"); }
    s.partner = null;
  }
}

io.on("connection", (s) => {
  s.on("find", ({ gender, want }) => {
    leave(s);
    const i = waiting.findIndex(w =>
      (want === "any" || w.gender === want) &&
      (w.want === "any" || w.want === gender));
    if (i >= 0) {
      const p = waiting.splice(i, 1)[0];
      const ps = io.sockets.sockets.get(p.id);
      if (!ps) { waiting.push({ id: s.id, gender, want }); return; }
      s.partner = p.id; ps.partner = s.id;
      ps.emit("matched", { initiator: true });
      s.emit("matched", { initiator: false });
    } else {
      waiting.push({ id: s.id, gender, want });
    }
  });
  s.on("signal", d => { if (s.partner) io.to(s.partner).emit("signal", d); });
  s.on("chat", m => { if (s.partner) io.to(s.partner).emit("chat", m); });
  s.on("next", () => leave(s));
  s.on("disconnect", () => leave(s));
});

httpServer.listen(process.env.PORT || 3000);
