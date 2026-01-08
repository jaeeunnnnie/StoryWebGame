// 서ㅏ버 기본 뼈대
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const path = require("path");


app.use(express.static(path.join(__dirname, "..", "client")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "index.html"));
});



//서버가 기억하는 방 목록
// =========================
// In-memory DB
// rooms[roomId] = {
//   roomId,
//   hostId,
//   phase: "lobby" | "prompt" | "waiting",
//   createdAt,
//   players: {
//     [socketId]: { id, name, joinedAt }
//   }
// }
// =========================
const rooms = {};


// 5자리 방 번호 생성 (중복 방지)
function createRoomId() {
  while (true) {
    const id = Math.floor(10000 + Math.random() * 90000).toString(); // 10000~99999
    if (!rooms[id]) return id;
  }
}

function getRoomState(roomId) {
  const room = rooms[roomId];
  if (!room) return null;

  return {
    roomId: room.roomId,
    hostId: room.hostId,
    phase: room.phase,
    players: Object.values(room.players).map((p) => ({
      id: p.id,
      name: p.name,
      joinedAt: p.joinedAt,
    })),
    playerCount: Object.keys(room.players).length,
  };
}

function emitRoomState(roomId) {
  const state = getRoomState(roomId);
  if (!state) return;
  io.to(roomId).emit("room:state", state);
}

io.on("connection", (socket) => {
  console.log("✅ connected:", socket.id);

  // --- room:create ---
  socket.on("room:create", ({ name }, ack) => {
    try {
      const trimmed = String(name ?? "").trim();
      if (!trimmed) return ack?.({ ok: false, error: "NAME_REQUIRED" });

      const roomId = createRoomId();
      rooms[roomId] = {
        roomId,
        hostId: socket.id,
        phase: "lobby",
        createdAt: Date.now(),
        players: {},
      };

      // join room + add player
      socket.join(roomId);
      rooms[roomId].players[socket.id] = {
        id: socket.id,
        name: trimmed,
        joinedAt: Date.now(),
      };

      // socket에 현재 roomId 붙여두기(편의)
      socket.data.roomId = roomId;

      console.log(`🏠 room created: ${roomId} by ${socket.id}`);

      ack?.({ ok: true, roomId, state: getRoomState(roomId) });
      emitRoomState(roomId);
    } catch (e) {
      console.error(e);
      ack?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  // --- room:join ---
  socket.on("room:join", ({ roomId, name }, ack) => {
    try {
      const rid = String(roomId ?? "").trim();
      const trimmed = String(name ?? "").trim();

      if (!rid) return ack?.({ ok: false, error: "ROOM_ID_REQUIRED" });
      if (!trimmed) return ack?.({ ok: false, error: "NAME_REQUIRED" });

      const room = rooms[rid];
      if (!room) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });

      // join room + add player
      socket.join(rid);
      room.players[socket.id] = {
        id: socket.id,
        name: trimmed,
        joinedAt: Date.now(),
      };
      socket.data.roomId = rid;

      console.log(`🚪 room joined: ${rid} by ${socket.id}`);

      ack?.({ ok: true, roomId: rid, state: getRoomState(rid) });
      emitRoomState(rid);
    } catch (e) {
      console.error(e);
      ack?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  // --- optional: room:leave (프론트가 나가기 버튼 만들 때 쓰기 좋음) ---
  socket.on("room:leave", (_payload, ack) => {
    const rid = socket.data.roomId;
    if (!rid || !rooms[rid]) return ack?.({ ok: true });

    // remove player
    delete rooms[rid].players[socket.id];
    socket.leave(rid);
    socket.data.roomId = null;

    // 방 비었으면 삭제
    if (Object.keys(rooms[rid].players).length === 0) {
      delete rooms[rid];
      console.log(`🧹 room deleted: ${rid}`);
      return ack?.({ ok: true });
    }

    emitRoomState(rid);
    ack?.({ ok: true });
  });

  socket.on("disconnect", () => {
    const rid = socket.data.roomId;
    console.log("❌ disconnected:", socket.id);

    if (!rid || !rooms[rid]) return;

    // remove player
    delete rooms[rid].players[socket.id];

    // host 나가면 hostId 갱신(남아있는 첫 사람을 host로)
    if (rooms[rid].hostId === socket.id) {
      const nextHostId = Object.keys(rooms[rid].players)[0];
      rooms[rid].hostId = nextHostId ?? null;
    }

    // 방 비었으면 삭제
    if (Object.keys(rooms[rid].players).length === 0) {
      delete rooms[rid];
      console.log(`🧹 room deleted: ${rid}`);
      return;
    }

    emitRoomState(rid);
  });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
