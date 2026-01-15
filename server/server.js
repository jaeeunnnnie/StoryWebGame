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
// In-memory DB (서버가 기억하는 방/플레이어 상태)
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
      timerInterval: null, // 타이머 interval ID
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
  room.game.totalRounds = Math.max(1, ids.length);

  room.game.promptPool = {};
  room.game.inboxPrompts = {};
  room.game.storyChains = {};
  room.game.chainForPlayer = {};
  room.game.submittedStory = {};
  room.game.usedCustomPromptSet = new Set(); // 커스텀 카드만 게임 전체에서 추적

  // 플레이어 상태 초기화
  for (const sid of ids) {
    const p = room.players[sid];
    p.submitted = { prompts: false, story: false };
    p.prompts = [];
    p.inboxPrompts = [];
  }
}

// ====================================================================
// 제시어 로직

// 기본 제공 제시어 리스트
const DEFAULT_PROMPTS = [
  "고무장갑", "편의점", "충전기", "엘리베이터", "수첩", "물컵", "비밀번호", "우산", "메모지", "형광펜",
  "이어폰", "종이봉투", "손목시계", "리모컨", "서랍", "단톡방", "캡처", "오해", "폭로", "비밀",
  "뒷담화", "삭제", "침묵", "편집", "전달", "왜곡", "확산", "눈치", "부인", "후폭풍",
  "범벅", "몰래스크린샷", "의문의알고리즘", "새벽감성", "과몰입", "주인없는양말", "갑분싸", "현타",
  "정체불명링크", "무한눈치게임", "카톡읽씹", "급발진", "뇌정지", "혼자북치고장구치기", "웃참실패",
];

// 모든 플레이어가 제시어 제출했는지 확인
function allPromptsSubmitted(room) {
  const ids = Object.keys(room.players);
  if (ids.length === 0) return false;
  return ids.every((sid) => room.players[sid].submitted?.prompts);
}

// 제시어를 모아서 셔플 후 각 플레이어에게 분배
// 라운드마다 호출되어 새로운 제시어를 뽑음
// 커스텀 카드(플레이어가 낸 카드)는 게임 전체에서 한 번만 사용
// 기본 카드는 매 라운드마다 리필됨 (한 라운드 내에서는 중복 X)
// ====================================================================
function assignPrompts(room) {
  const ids = Object.keys(room.players);
  const per = 3; // 플레이어당 카드 수
  if (ids.length === 0) return;

  // 게임 전체에서 사용된 커스텀 제시어 ID Set (기본 카드는 매 라운드 리필)
  if (!room.game.usedCustomPromptSet) {
    room.game.usedCustomPromptSet = new Set();
  }
  const usedCustomPromptSet = room.game.usedCustomPromptSet;

  // ----- 풀 구성: 커스텀 / 기본 -----
  const customPool = [];
  const defaultPool = [];

  // 1. 커스텀 카드 수집 (게임 전체에서 한 번만 사용, 중복 작성하면 여러 장)
  for (const sid of ids) {
    const p = room.players[sid];
    (p.prompts || []).forEach((textRaw, index) => {
      const text = String(textRaw ?? "").trim();
      if (!text) return;

      // 카드 고유 ID 생성 (누가 냈는지 + 몇 번째 카드인지)
      // 같은 텍스트여도 다른 인덱스면 다른 카드로 취급
      const uniqueId = `${sid}_${index}`;
      if (usedCustomPromptSet.has(uniqueId)) return;

      customPool.push({ id: uniqueId, text: text, type: 'custom' });
    });
  }

  // 2. 기본 카드 수집 (매 라운드 리필 - 한 라운드 내에서만 중복 방지)
  for (const base of DEFAULT_PROMPTS) {
    const text = String(base ?? "").trim();
    if (!text) continue;
    
    const uniqueId = `default_${text}`;
    defaultPool.push({ id: uniqueId, text: text, type: 'default' });
  }

  // 섞기
  shuffle(customPool);
  shuffle(defaultPool);

  // 디버깅: 커스텀 풀 상태 확인
  console.log(
    `[assignPrompts] 라운드 ${room.game.round}, 커스텀풀 크기: ${customPool.length}, 내용:`,
    customPool.map(c => `${c.text}(${c.id})`).join(", ")
  );

  // ----- 전략: 커스텀 카드를 최대한 분배, 부족하면 기본으로 채우기 -----
  // 목표: 커스텀 카드 최우선으로 전부 분배하고, 필요하면 기본 카드로 채우기
  
  console.log(`[assignPrompts 시작] 커스텀풀: ${customPool.length}, 기본풀: ${defaultPool.length}`);
  
  // 각 플레이어에게 분배
  for (let playerIdx = 0; playerIdx < ids.length; playerIdx++) {
    const sid = ids[playerIdx];
    const sliceObjs = [];
    
    // 1단계: 커스텀 카드를 먼저 2개 분배
    // 커스텀이 부족하면 일부 플레이어는 2개 못 받을 수 있음
    for (let i = 0; i < 2 && customPool.length > 0; i++) {
      sliceObjs.push(customPool.shift());
    }
    
    console.log(`[분배] 플레이어 ${playerIdx}: 커스텀 ${sliceObjs.length}개 받음, 남은 커스텀풀: ${customPool.length}`);
    
    // 2단계: 부족한 만큼 기본 카드로 채우기
    const needed = per - sliceObjs.length;
    for (let i = 0; i < needed && defaultPool.length > 0; i++) {
      sliceObjs.push(defaultPool.shift());
    }
    
    console.log(`[분배] 플레이어 ${playerIdx}: 기본 ${needed}개 중 ${sliceObjs.length - (per - needed)}개 받음`);

    // 3단계: 실제 데이터 처리
    const finalPrompts = [];
    for (const card of sliceObjs) {
      // 커스텀 카드는 게임 전체에서 사용됨 표시
      if (card.type === 'custom') {
        usedCustomPromptSet.add(card.id);
      }
      // 플레이어에게는 텍스트만 전달
      finalPrompts.push(card.text);
    }

    // 경고 로그
    if (finalPrompts.length < per) {
      console.warn(
        `[assignPrompts] 플레이어 ${playerIdx}(${sid})에게 제시어 ${finalPrompts.length}개만 할당됨 (라운드 ${room.game.round}, 인원 ${ids.length}, 커스텀남음 ${customPool.length}, 기본남음 ${defaultPool.length})`
      );
    }

    room.game.inboxPrompts[sid] = finalPrompts;
    room.players[sid].inboxPrompts = finalPrompts;
  }
}
// ====================================================================
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

  // 라운드 1부터 제시어 분배 (라운드 0에는 분배 안 함)
  if (room.game.round > 0) {
    assignPrompts(room);
  }

  const order = room.game.turnOrder;
  const round = room.game.round;

  room.game.submittedStory[round] = new Set();

  for (const sid of order) {
    const chainId = computeChainForPlayer(room, sid);
    if (!chainId) continue;

    room.game.chainForPlayer[sid] = chainId;

    const chain = room.game.storyChains[chainId];
    let chainEntries = [];
    if (chain?.entries && chain.entries.length > 0) {
      const last = chain.entries[chain.entries.length - 1];
      chainEntries = [{
        round: last.round,
        writerId: last.writerId,
        text: last.text,
      }];
    }

    io.to(sid).emit("story:round", {
      roomId: room.roomId,
      round: room.game.round,
      totalRounds: room.game.totalRounds,
      chainId,
      chainOwnerId: chain?.ownerId || chainId,
      chainEntries,
      inboxPrompts: room.game.round === 0 ? [] : (room.game.inboxPrompts[sid] || []),
    });

    // player 제출 상태 초기화
    room.players[sid].submitted.story = false;
  }

  emitRoomState(room.roomId);

  // 타이머 시작 (20초)
  const TIMER_DURATION = 20;
  let secondsLeft = TIMER_DURATION;

  // 기존 타이머가 있으면 정리
  if (room.game.timerInterval) {
    clearInterval(room.game.timerInterval);
  }

  // 타이머 매 초마다 실행
  room.game.timerInterval = setInterval(() => {
    secondsLeft--;

    // 모든 플레이어에게 타이머 정보 전송
    io.to(roomId).emit("story:timer", {
      secondsLeft: Math.max(0, secondsLeft),
    });

    // 타이머 종료 시
    if (secondsLeft <= 0) {
      clearInterval(room.game.timerInterval);
      room.game.timerInterval = null;

      // 다음 라운드로 진행
      const currentRoom = getRoom(roomId);
      if (currentRoom && currentRoom.phase === "story") {
        const nextRound = currentRoom.game.round + 1;
        if (nextRound >= currentRoom.game.totalRounds) {
          currentRoom.phase = "result";
          emitRoomState(roomId);

          const payload = buildResultPayload(currentRoom);
          io.to(roomId).emit("game:result", payload);
        } else {
          currentRoom.game.round = nextRound;
          startRound(roomId);
        }
      }
    }
  }, 1000);
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

  // 타이머 정리
  if (room.game && room.game.timerInterval) {
    clearInterval(room.game.timerInterval);
    room.game.timerInterval = null;
  }

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


// ====================================================================
// Socket.io 연결 처리
io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  // 방 생성 
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
        game: null,
      };

      socket.join(roomId);
      rooms[roomId].players[socket.id] = {
        id: socket.id,
        name: trimmed,
        joinedAt: Date.now(),
        submitted: { prompts: false, story: false },
        prompts: [],
        inboxPrompts: [],
      };

      socket.data.roomId = roomId;

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
      if (room.phase !== "lobby") return ack?.({ ok: false, error: "GAME_ALREADY_STARTED" });

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

  // 게임 시작
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

  // 제시어 제출
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

      if (cleaned.length !== 3) return ack?.({ ok: false, error: "NEED_3_PROMPTS" });

      p.prompts = cleaned;
      p.submitted.prompts = true;

      ensureGame(room);
      room.game.promptPool[socket.id] = cleaned;

      emitRoomState(rid);
      ack?.({ ok: true });

      if (!allPromptsSubmitted(room)) return;

      // 모두 제출 완료 시 처리
      // assignPrompts는 startRound에서 라운드마다 호출됨
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

  // 스토리 제출
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