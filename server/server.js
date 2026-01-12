// 서버 기본 뼈대 (Express + HTTP + Socket.io)
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Socket.io 서버 생성
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
  },
});

// client 폴더의 index.html, css, js 제공
app.use(express.static(path.join(__dirname, "..", "client")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "index.html"));
});


//In-memory DB (서버가 기억하는 방/플레이어 상태)
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

// 프론트에 내려줄 "방 상태" 객체 생성
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

// 같은 방에 있는 모든 사람에게 상태 브로드캐스트
function emitRoomState(roomId) {
  const state = getRoomState(roomId);
  if (!state) return;
  io.to(roomId).emit("room:state", state);
}


// Socket.io 연결 처리
io.on("connection", (socket) => {
  console.log("connected:", socket.id);

 // 방 생성 
  socket.on("room:create", ({ name }, ack) => {
    try {
      const trimmed = String(name ?? "").trim();
      if (!trimmed) return ack?.({ ok: false, error: "NAME_REQUIRED" });
      // 방 생성
      const roomId = createRoomId();
      rooms[roomId] = {
        roomId,
        hostId: socket.id,
        phase: "lobby",
        createdAt: Date.now(),
        players: {},
      };
      // 소켓을 방에 참가시키고 플레이어 등록
      socket.join(roomId);
      rooms[roomId].players[socket.id] = {
        id: socket.id,
        name: trimmed,
        joinedAt: Date.now(),
      };
      // 소켓에 현재 방 ID 저장
      socket.data.roomId = roomId;
      // 요청자에게 응답 + 방 전체에 상태 알림
      ack?.({ ok: true, roomId, state: getRoomState(roomId) });
      emitRoomState(roomId);
    } catch (e) {
      console.error(e);
      ack?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

// 방 참가  
  socket.on("room:join", ({ roomId, name }, ack) => {
    try {
      const rid = String(roomId ?? "").trim();
      const trimmed = String(name ?? "").trim();

      if (!rid) return ack?.({ ok: false, error: "ROOM_ID_REQUIRED" });
      if (!trimmed) return ack?.({ ok: false, error: "NAME_REQUIRED" });

      const room = rooms[rid];
      if (!room) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });
      // 방 참가 + 플레이어 등록
      socket.join(rid);
      room.players[socket.id] = {
        id: socket.id,
        name: trimmed,
        joinedAt: Date.now(),
      };
      socket.data.roomId = rid;
      // 응답 + 상태 브로드캐스트
      ack?.({ ok: true, roomId: rid, state: getRoomState(rid) });
      emitRoomState(rid);
    } catch (e) {
      console.error(e);
      ack?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

// 방 나가기  
  socket.on("room:leave", (_payload, ack) => {
    const rid = socket.data.roomId;
    if (!rid || !rooms[rid]) return ack?.({ ok: true });
    // 플레이어 제거 + 소켓 방 탈퇴
    delete rooms[rid].players[socket.id];
    socket.leave(rid);
    socket.data.roomId = null;

    // 방 비었으면 삭제
    if (Object.keys(rooms[rid].players).length === 0) {
      delete rooms[rid];
      return ack?.({ ok: true });
    }

    emitRoomState(rid);
    ack?.({ ok: true });
  });


// 연결 끊김 처리  
  socket.on("disconnect", () => {
    const rid = socket.data.roomId;

    if (!rid || !rooms[rid]) return;
    // 플레이어 제거
    delete rooms[rid].players[socket.id];
    // 방장이 나갔으면 다른 사람을 방장으로
    if (rooms[rid].hostId === socket.id) {
      const nextHostId = Object.keys(rooms[rid].players)[0];
      rooms[rid].hostId = nextHostId ?? null;
    }
    // 방 비었으면 삭제
    if (Object.keys(rooms[rid].players).length === 0) {
      delete rooms[rid];
      return;
    }

    emitRoomState(rid);
  });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
