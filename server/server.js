// 서버 기본 뼈대 (Express + HTTP + Socket.io)
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
// ====================================================================
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
// ====================================================================

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

// 배열 셔플
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getRoom(roomId) {
  const r = rooms[roomId];
  return r || null;
}

function getPlayers(room) {
  return Object.values(room.players);
}


// 프론트에 내려줄 방 상태 객체 생성
function getRoomState(roomId) {
  const room = rooms[roomId];
  if (!room) return null;

   // 플레이어 목록 
  const playersArr = Object.values(room.players).map((p) => ({
    id: p.id,
    name: p.name,
    joinedAt: p.joinedAt,
    submitted: p.submitted,
  }));

  const playerCount = playersArr.length;

  // 제시어 제출 인원 수
  let promptSubmittedCount = 0;
  for (const p of playersArr) if (p.submitted?.prompts) promptSubmittedCount++;

  // 현재 라운드 정보
  const round = room.game?.round ?? null;
  const totalRounds = room.game?.totalRounds ?? null;

  // 현재 라운드 스토리 제출 인원 수
  let roundSubmittedCount = 0;
  if (room.phase === "story" && room.game && typeof room.game.round === "number") {
    const set = room.game.submittedStory?.[room.game.round];
    roundSubmittedCount = set ? set.size : 0;
  }

  return {
    roomId: room.roomId,
    hostId: room.hostId,
    phase: room.phase,
    players: playersArr,
    playerCount,
    promptSubmittedCount,
    round,
    totalRounds,
    roundSubmittedCount,
  };
}

// 같은 방에 있는 모든 사람에게 상태 브로드캐스트
function emitRoomState(roomId) {
  const state = getRoomState(roomId);
  if (!state) return;
  io.to(roomId).emit("room:state", state);
}

// 게임 로직 함수들
function ensureGame(room) {
  if (!room.game) {
    room.game = {
      round: 0,
      totalRounds: 0,
      turnOrder: [],
      promptPool: {},
      inboxPrompts: {},
      storyChains: {},
      chainForPlayer: {},
      submittedStory: {},
    };
  }
}

// 게임 시작 시 초기화
function resetForNewGame(room) {
  room.phase = "prompt";
  ensureGame(room);

  const ids = Object.keys(room.players);
  room.game.round = 0;
  room.game.turnOrder = ids.slice(); // 플레이어 순서 고정
  room.game.totalRounds = Math.max(1, ids.length - 1);

  room.game.promptPool = {};
  room.game.inboxPrompts = {};
  room.game.storyChains = {};
  room.game.chainForPlayer = {};
  room.game.submittedStory = {};

  // 플레이어 상태 초기화
  for (const sid of ids) {
    const p = room.players[sid];
    p.submitted = { prompts: false, story: false };
    p.prompts = [];
    p.inboxPrompts = [];
  }
}

// 제시어 로직

// 모든 플레이어가 제시어 제출했는지 확인
function allPromptsSubmitted(room) {
  const ids = Object.keys(room.players);
  if (ids.length === 0) return false;
  return ids.every((sid) => room.players[sid].submitted?.prompts);
}

// 제시어를 모아서 셔플 후 각 플레이어에게 분배
function assignPrompts(room) {
  const ids = Object.keys(room.players);
  const all = [];
  
  // 모든 제시어 수집
  for (const sid of ids) {
    const p = room.players[sid];
    for (const s of p.prompts || []) all.push(s);
  }

  shuffle(all);

  // 플레이어에게 4개씩 분배(플레이어 수*4만큼 사용)
  const per = 4;
  for (let i = 0; i < ids.length; i++) {
    const sid = ids[i];
    const slice = all.slice(i * per, i * per + per);
    room.game.inboxPrompts[sid] = slice;
    room.players[sid].inboxPrompts = slice;
  }
}

// 스토리 체인 계산 로직

// 각 플레이어의 스토리 체인 초기화
function initStoryChains(room) {
  const order = room.game.turnOrder;
  room.game.storyChains = {};
  for (const ownerId of order) {
    room.game.storyChains[ownerId] = {
      ownerId,
      entries: [],
    };
  }
}

// 현재 라운드에서 플레이어가 맡을 체인 계산
function computeChainForPlayer(room, playerId) {
  const order = room.game.turnOrder;
  const n = order.length;
  const r = room.game.round;

  const i = order.indexOf(playerId);
  if (i === -1) return null;

  // 라운드 r에서 player i가 맡을 체인의 ownerIndex = (i - r + n) % n
  const ownerIndex = (i - r + n) % n;
  const chainId = order[ownerIndex]; // chainId = ownerId
  return chainId;
}

// 라운드 시작 처리
function startRound(roomId) {
  const room = getRoom(roomId);
  if (!room) return;
  if (room.phase !== "story") return;
  if (!room.game) return;

  const order = room.game.turnOrder;
  const round = room.game.round;

  room.game.submittedStory[round] = new Set();

  for (const sid of order) {
    const chainId = computeChainForPlayer(room, sid);
    if (!chainId) continue;

    room.game.chainForPlayer[sid] = chainId;

    const chain = room.game.storyChains[chainId];
    const chainEntries = (chain?.entries || []).map((e) => ({
      round: e.round,
      writerId: e.writerId,
      text: e.text,
    }));

    io.to(sid).emit("story:round", {
      roomId: room.roomId,
      round: room.game.round,
      totalRounds: room.game.totalRounds,
      chainId,
      chainOwnerId: chain?.ownerId || chainId,
      chainEntries,
      inboxPrompts: room.game.inboxPrompts[sid] || [],
    });

    // player 제출 상태 초기화
    room.players[sid].submitted.story = false;
  }

  emitRoomState(room.roomId);
}

// 결과 정리

function buildResultPayload(room) {
  const order = room.game.turnOrder;

  const idToName = {};
  for (const sid of order) {
    idToName[sid] = room.players[sid]?.name || sid;
  }

  const chains = order.map((ownerId) => {
    const chain = room.game.storyChains[ownerId];
    return {
      chainId: ownerId,
      ownerId,
      ownerName: idToName[ownerId],
      entries: (chain?.entries || []).map((e) => ({
        round: e.round,
        writerId: e.writerId,
        writerName: idToName[e.writerId] || e.writerId,
        text: e.text,
      })),
    };
  });

  return { chains };
}

function abortGame(roomId, reason) {
  const room = getRoom(roomId);
  if (!room) return;

  if (room.phase !== "lobby") {
    io.to(roomId).emit("game:aborted", { reason });
  }

  room.phase = "lobby";
  room.game = null;

  for (const sid of Object.keys(room.players)) {
    room.players[sid].submitted = { prompts: false, story: false };
    room.players[sid].prompts = [];
    room.players[sid].inboxPrompts = [];
  }

  emitRoomState(roomId);
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
        game: null,
      };

      // 소켓을 방에 참가시키고 플레이어 등록
      socket.join(roomId);
      rooms[roomId].players[socket.id] = {
        id: socket.id,
        name: trimmed,
        joinedAt: Date.now(),
        submitted: { prompts: false, story: false },
        prompts: [],
        inboxPrompts: [],
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
      // 게임 중 입장 막기
      if (room.phase !== "lobby") return ack?.({ ok: false, error: "GAME_ALREADY_STARTED" });

      // 방 참가 + 플레이어 등록
      socket.join(rid);
      room.players[socket.id] = {
        id: socket.id,
        name: trimmed,
        joinedAt: Date.now(),
        submitted: { prompts: false, story: false },
        prompts: [],
        inboxPrompts: [],
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

    const room = rooms[rid];

    // 게임 중 나가면 게임 중단(간단 정책)
    const wasInGame = room.phase !== "lobby";

    delete room.players[socket.id];
    socket.leave(rid);
    socket.data.roomId = null;

    if (Object.keys(room.players).length === 0) {
      delete rooms[rid];
      return ack?.({ ok: true });
    }

    if (room.hostId === socket.id) {
      const nextHostId = Object.keys(room.players)[0];
      room.hostId = nextHostId ?? null;
    }

    if (wasInGame) {
      abortGame(rid, "PLAYER_LEFT");
    } else {
      emitRoomState(rid);
    }

    ack?.({ ok: true });
  });

    socket.on("game:start", (_payload, ack) => {
    try {
      const rid = socket.data.roomId;
      const room = rid ? rooms[rid] : null;
      if (!room) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });

      if (socket.id !== room.hostId) return ack?.({ ok: false, error: "NOT_HOST" });
      if (Object.keys(room.players).length < 2) return ack?.({ ok: false, error: "NEED_2_PLAYERS" });

      resetForNewGame(room);
      emitRoomState(rid);

      ack?.({ ok: true });
    } catch (e) {
      console.error(e);
      ack?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  socket.on("prompt:submit", ({ prompts }, ack) => {
    try {
      const rid = socket.data.roomId;
      const room = rid ? rooms[rid] : null;
      if (!room) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });
      if (room.phase !== "prompt") return ack?.({ ok: false, error: "NOT_PROMPT_PHASE" });

      const p = room.players[socket.id];
      if (!p) return ack?.({ ok: false, error: "PLAYER_NOT_FOUND" });

      const arr = Array.isArray(prompts) ? prompts : [];
      const cleaned = arr.map((x) => String(x ?? "").trim()).filter(Boolean);

      if (cleaned.length !== 4) return ack?.({ ok: false, error: "NEED_4_PROMPTS" });

      p.prompts = cleaned;
      p.submitted.prompts = true;

      ensureGame(room);
      room.game.promptPool[socket.id] = cleaned;

      emitRoomState(rid);
      ack?.({ ok: true });

      if (!allPromptsSubmitted(room)) return;

      // 모두 제출 완료
      assignPrompts(room);
      initStoryChains(room);

      room.phase = "story";
      room.game.round = 0;
      room.game.submittedStory = {};

      emitRoomState(rid);
      startRound(rid);
    } catch (e) {
      console.error(e);
      ack?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  socket.on("story:submit", ({ text }, ack) => {
    try {
      const rid = socket.data.roomId;
      const room = rid ? rooms[rid] : null;
      if (!room) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });
      if (room.phase !== "story") return ack?.({ ok: false, error: "NOT_STORY_PHASE" });
      if (!room.game) return ack?.({ ok: false, error: "GAME_NOT_READY" });

      const p = room.players[socket.id];
      if (!p) return ack?.({ ok: false, error: "PLAYER_NOT_FOUND" });

      const t = String(text ?? "").trim();
      if (!t) return ack?.({ ok: false, error: "TEXT_REQUIRED" });

      const round = room.game.round;
      const chainId = room.game.chainForPlayer[socket.id];
      if (!chainId) return ack?.({ ok: false, error: "CHAIN_NOT_ASSIGNED" });

      const set = room.game.submittedStory[round];
      if (!set) room.game.submittedStory[round] = new Set();

      // 중복 제출 방지
      if (room.game.submittedStory[round].has(socket.id)) {
        return ack?.({ ok: false, error: "ALREADY_SUBMITTED" });
      }

      const chain = room.game.storyChains[chainId];
      if (!chain) return ack?.({ ok: false, error: "CHAIN_NOT_FOUND" });

      chain.entries.push({
        round,
        writerId: socket.id,
        text: t,
      });

      room.game.submittedStory[round].add(socket.id);
      p.submitted.story = true;

      emitRoomState(rid);
      ack?.({ ok: true });

      const need = room.game.turnOrder.length;
      if (room.game.submittedStory[round].size < need) return;

      // 라운드 종료 -> 다음 라운드 or 결과
      const nextRound = round + 1;
      if (nextRound >= room.game.totalRounds) {
        room.phase = "result";
        emitRoomState(rid);

        const payload = buildResultPayload(room);
        io.to(rid).emit("game:result", payload);
        return;
      }

      room.game.round = nextRound;
      startRound(rid);
    } catch (e) {
      console.error(e);
      ack?.({ ok: false, error: "SERVER_ERROR" });
    }
  });


// 연결 끊김 처리  
  socket.on("disconnect", () => {
    const rid = socket.data.roomId;

    if (!rid || !rooms[rid]) return;
<<<<<<< Updated upstream
    // 플레이어 제거
    delete rooms[rid].players[socket.id];
    // 방장이 나갔으면 다른 사람을 방장으로
    if (rooms[rid].hostId === socket.id) {
      const nextHostId = Object.keys(rooms[rid].players)[0];
      rooms[rid].hostId = nextHostId ?? null;
    }
    // 방 비었으면 삭제
    if (Object.keys(rooms[rid].players).length === 0) {
=======

    const room = rooms[rid];

    // ?????? ???
    delete room.players[socket.id];

    // ??????????? ??? ???????????
    if (room.hostId === socket.id) {
      const nextHostId = Object.keys(room.players)[0];
      room.hostId = nextHostId ?? null;
    }

    // ???????? ???
    if (Object.keys(room.players).length === 0) {
>>>>>>> Stashed changes
      delete rooms[rid];
      return;
    }

    if (room.phase !== "lobby") {
      abortGame(rid, "PLAYER_LEFT");
      return;
    }

    emitRoomState(rid);
  });
});

const PORT = 3000;
server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
