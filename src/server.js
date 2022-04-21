import http from "http"; /*already installed in nodejs" */
import express from "express";
import SocketIO from "socket.io";
import { parse } from "path";
import { SocketAddress } from "net";
/* express 객체를 가져와라*/
const app = express();
const port = 3000;
const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer);

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (_, res) => res.render("home"));
app.get("/*", (_, res) => res.redirect("/"));

wsServer.on("connection", (socket) => {
  socket.on("join_room", (roomName) => {
    socket.join(roomName);
    socket.to(roomName).emit("welcome");
  });
  socket.on("offer", (offer, roomName) => {
    socket.to(roomName).emit("offer", offer);
  });
  socket.on("answer", (answer, roomName) => {
    socket.to(roomName).emit("answer", answer);
  });
  socket.on("ice", (ice, roomName) => {
    socket.to(roomName).emit("ice", ice);
  });
  socket.on("disconnect", (roomName) => {
    wsServer.sockets.emit("left");
  });
});

const listenHandler = () =>
  console.log(`Now listening on http://localhost:${port}`);

httpServer.listen(port, listenHandler);
