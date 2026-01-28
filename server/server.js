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
    credentials: true,
  },
});

// Express 미들웨어: JSON 파싱
app.use(express.json());

// Express 미들웨어: CORS 헤더 설정
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
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

// ====================================================================
// 상태 브로드캐스트

// 프론트에 내려줄 방 상태 객체 생성
function getRoomState(roomId) {
  const room = rooms[roomId];
  if (!room) return null;

  // 플레이어 목록
  const playersArr = Object.values(room.players).map((p) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar || null,
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
    phase: room.phase, // lobby | prompt | story | result
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
// ====================================================================
// 게임 상태 객체 초기화

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
      usedCustomPromptSet: new Set(), // 커스텀 카드(플레이어 입력) 고유ID: sid_index
      usedDefaultPromptSet: new Set(), // 기본 카드: 게임 전체에서 사용된 카드(등장하면 다음 라운드부터 제외)
      timerInterval: null, // 타이머 interval ID
      inboxPromptCards: {}, // sid -> 이번 라운드에 받은 카드 객체들(판정용)
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
  room.game.inboxPromptCards = {};

  room.game.usedCustomPromptSet = new Set(); // 커스텀 카드만 게임 전체에서 추적
  room.game.usedDefaultPromptSet = new Set(); // 기본 카드: 게임 전체에서 1회만 등장

  // 타이머 정리
  if (room.game.timerInterval) {
    clearInterval(room.game.timerInterval);
    room.game.timerInterval = null;
  }

  // 플레이어 상태 초기화
  for (const sid of ids) {
    const p = room.players[sid];
    p.submitted = { prompts: false, story: false };
    p.prompts = [];
    p.inboxPrompts = [];
  }

  // 키워드 입력 타이머 시작 (60초)
  startPromptTimer(room.roomId);
}

// 키워드 입력 타이머
function startPromptTimer(roomId) {
  const room = getRoom(roomId);
  if (!room || room.phase !== "prompt") return;

  const PROMPT_TIMER_DURATION = 60; // 60초
  let secondsLeft = PROMPT_TIMER_DURATION;

  // 기존 타이머 정리
  if (room.game.timerInterval) {
    clearInterval(room.game.timerInterval);
    room.game.timerInterval = null;
  }

  // 시작 즉시 1회 전송
  io.to(roomId).emit("prompt:timer", { secondsLeft });

  room.game.timerInterval = setInterval(() => {
    secondsLeft -= 1;

    io.to(roomId).emit("prompt:timer", {
      secondsLeft: Math.max(0, secondsLeft),
    });

    if (secondsLeft <= 0) {
      clearInterval(room.game.timerInterval);
      room.game.timerInterval = null;

      const currentRoom = getRoom(roomId);
      if (!currentRoom || currentRoom.phase !== "prompt") return;

      // 타임아웃 시 제출하지 않은 플레이어는 빈 키워드 자동 제출
      const ids = Object.keys(currentRoom.players);
      for (const sid of ids) {
        const p = currentRoom.players[sid];
        if (!p.submitted.prompts) {
          // 빈 키워드로 자동 제출 (3개)
          p.prompts = ["기본", "단어", "제출"];
          p.submitted.prompts = true;
          currentRoom.game.promptPool[sid] = p.prompts;
        }
      }

      // 모두 제출 완료 처리
      if (allPromptsSubmitted(currentRoom)) {
        initStoryChains(currentRoom);
        currentRoom.phase = "story";
        currentRoom.game.round = 0;
        currentRoom.game.submittedStory = {};
        emitRoomState(roomId);
        startRound(roomId);
      }
    }
  }, 1000);
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
  const ids = Object.keys(room.players).filter((sid) => !room.players[sid].disconnected);
  if (ids.length === 0) return false;
  return ids.every((sid) => room.players[sid].submitted?.prompts);
}

const DEFAULT_SENTENCES_ROUND0 = [
  "옛날 옛적에, 말도 안 되는 일이 시작됐다.",
  "그날은 평범했는데, 갑자기 분위기가 이상해졌다.",
  "아무도 예상 못 했지만, 사건은 이미 벌어졌다.",
];

const DEFAULT_SENTENCES_LATER = [
  "그러자 상황은 더 이상해졌다.",
  "그 순간, 모두가 얼어붙었다.",
  "하지만 이야기는 멈추지 않았다.",
];



// ====================================================================
// 호칭 카드 생성
// - 일단 카드 구성 확인할라고: 기본1 + 커스텀1 + 이름1 로 해놨슈

// 한글 받침(종성) 유무 체크
function hasFinalConsonant(koreanWord) {
  const s = String(koreanWord ?? "").trim();
  if (!s) return false;

  const ch = s[s.length - 1];
  const code = ch.charCodeAt(0);

  // 한글 음절 범위: AC00(가) ~ D7A3(힣)
  if (code < 0xac00 || code > 0xd7a3) return false;

  const offset = code - 0xac00;
  const jong = offset % 28;
  return jong !== 0;
}

// 받침 여부에 따라 조사 선택해서 붙이기
function josa(word, withFinal, withoutFinal) {
  const base = String(word ?? "").trim();
  if (!base) return "";
  return base + (hasFinalConsonant(base) ? withFinal : withoutFinal);
}

// 호칭 카드 텍스트 생성
function buildNameCards(displayName) {
  const base = String(displayName ?? "").trim();
  if (!base) return [];

  return [
    josa(base, "이", "가"),   
    josa(base, "은", "는"), 
    josa(base, "의", "의"),    
    josa(base, "에게", "에게"), 
    josa(base, "이랑", "랑"), 
    josa(base, "이만의", "만의"), 
    josa(base, "이 때문에", " 때문에"),
    josa(base, "이보다", "보다"),
    josa(base, "이마저", "마저"),
    josa(base, "이 말에 따르면", " 말에 따르면"),   

    josa(base, "이를", "를"),
    josa(base, "이한테", "한테"),
    josa(base, "이와", "와"),
    josa(base, "으로", "로"),
    josa(base, "이까지", "까지"),
    josa(base, "이부터", "부터"),
    josa(base, "이조차", "조차"),
    josa(base, "이뿐", "뿐"),
    josa(base, "이 덕분에", " 덕분에"),
    josa(base, "이처럼", "처럼"),
    josa(base, "이 같이", " 같이"),
    
    `킹 갓 제너럴 ${base}`,
    `사랑에 빠진 ${base}`,
    `똥 씹은 표정을 하는 ${base}`,

    `${base} 손에`,
    `${base} 발에`,
    `${base} 마음속에`,
    `${base} 머릿속에는`,
    `${base} 주장에 따르면`,

    `화가 난 ${base}`,
    `기분 좋은 ${base}`,
    `심각한 ${base}`,
    `혼란스러운 ${base}`,
    `졸린 ${base}`,
    `배고픈 ${base}`,
    `지친 ${base}`,
    `신난 ${base}`,
    `초조한 ${base}`,
    `아무 생각 없는 ${base}`,
    `모든 걸 포기한 ${base}`,
    `괜히 당당한 ${base}`,
    `눈치 보는 ${base}`,
    `눈치 없는 ${base}`,
    `의욕만 넘치는 ${base}`,
    `멘탈이 나간 ${base}`,
    `아직 상황 파악 못 한 ${base}`,

    `전설의 ${base}`,
    `문제의 ${base}`,
    `소문의 ${base}`,
    `논란의 ${base}`,
    `자칭 천재 ${base}`,
    `자타공인 ${base}`,
    `동네에서 유명한 ${base}`,
    `괜히 유명한 ${base}`,
    `아무도 안 부른 ${base}`,
    `갑자기 튀어나온 ${base}`,
    `쓸데없이 진지한 ${base}`,
    `괜히 멋있는 척하는 ${base}`,

    `고개를 끄덕이는 ${base}`,
    `한숨 쉬는 ${base}`,
    `팔짱 낀 ${base}`,
    `눈을 피하는 ${base}`,
    `갑자기 일어난 ${base}`,
    `문을 박차고 나온 ${base}`,
    `조용히 웃는 ${base}`,
    `말없이 사라진 ${base}`,
    `괜히 박수치는 ${base}`,
    `주변을 둘러보는 ${base}`,

    `우리의 ${base}`,
    `문제의 인물 ${base}`,
    `이야기의 중심 ${base}`,
    `그날의 ${base}`,
    `사건의 시작 ${base}`,
    `모든 일의 원인 ${base}`,
    `아무도 몰랐던 ${base}`,
    `그때 그 ${base}`,
    `지나가던 ${base}`,

    `현실을 부정하는 ${base}`,
    `모든 걸 알고 있는 척하는 ${base}`,
    `아무 말이나 하는 ${base}`,
    `이유 없이 등장한 ${base}`,
    `설명은 안 해주는 ${base}`,
    `대충 넘어가려는 ${base}`,
    `왜 있는지 모르는 ${base}`,
    `끝내주는 타이밍의 ${base}`,

    `똥 씹은 표정의 ${base}`,
    `꼴 보기 싫은 ${base}`,
    `인상 더러운 ${base}`,
    `표정 관리 안 되는 ${base}`,
    `하품만 하는 ${base}`,
    `눈 풀린 ${base}`,
    `정신 반쯤 나간 ${base}`,
    `멍청해 보이는 ${base}`,
    `멍 때리는 ${base}`,
    `아무 생각 없는 ${base}`,
    `얼굴에 다 써 있는 ${base}`,
    `한숨만 쉬는 ${base}`,

    `꼴값 떠는 ${base}`,
    `괜히 설치는 ${base}`,
    `말만 많은 ${base}`,
    `일은 안 하는 ${base}`,
    `뒤에서 궁시렁대는 ${base}`,
    `괜히 참견하는 ${base}`,
    `일 크게 만드는 ${base}`,
    `아무 말이나 내뱉는 ${base}`,
    `대충 넘기려는 ${base}`,
    `일단 우기는 ${base}`,

    `모든 일의 원흉 ${base}`,
    `괜히 불 붙인 ${base}`,
    `사태를 키운 ${base}`,
    `시작만 해놓고 튄 ${base}`,
    `아무 설명 안 한 ${base}`,
    `중요할 때 없는 ${base}`,
  ];
}


// 방의 모든 플레이어 이름으로 호칭카드 만들기
function collectNameCardPool(room) {
  const ids = Object.keys(room.players || {});
  const pool = [];

  for (const sid of ids) {
    const name = room.players[sid]?.name;
    const cards = buildNameCards(name);

    // 각 카드에 고유 id 부여
    cards.forEach((text, idx) => {
      pool.push({
        id: `name_${sid}_${idx}`,
        text,
        type: "name",
        ownerId: sid,
      });
    });
  }
  return pool;
}

// ====================================================================
// 제시어를 모아서 셔플 후 각 플레이어에게 분배
// 라운드마다 호출되어 새로운 제시어를 뽑음
// 커스텀 카드(플레이어가 낸 카드)는 게임 전체에서 한 번만 사용
// 기본 카드는 매 라운드마다 리필됨 (한 라운드 내에서는 중복 X)
// ====================================================================
// 일단!!!!! 라운드마다 플레이어당 3장 고정 구성
// - 기본 카드 1장
// - 커스텀 카드 1장
// - 호칭 카드 1장
function assignPrompts(room) {
  const ids = Object.keys(room.players);
  if (ids.length === 0) return;

  ensureGame(room);

  const usedCustom = room.game.usedCustomPromptSet || new Set();
  const usedDefault = room.game.usedDefaultPromptSet || new Set();

  room.game.usedCustomPromptSet = usedCustom;
  room.game.usedDefaultPromptSet = usedDefault;

  // ----- 풀 구성: 커스텀 / 기본 / 호칭 -----
  const customPool = [];
  const defaultPool = [];
  const namePool = collectNameCardPool(room);

  // 1. 커스텀 카드 수집 (게임 전체에서 한 번만 사용, 중복 작성하면 여러 장)
  for (const sid of ids) {
    const p = room.players[sid];
    (p.prompts || []).forEach((textRaw, index) => {
      const text = String(textRaw ?? "").trim();
      if (!text) return;

      const uniqueId = `${sid}_${index}`;
      if (usedCustom.has(uniqueId)) return;

      customPool.push({ id: uniqueId, text, type: "custom" });
    });
  }

  // 2. 기본 카드 수집 (매 라운드 리필 - 한 라운드 내에서만 중복 방지)
    for (const base of DEFAULT_PROMPTS) {
    const text = String(base ?? "").trim();
    if (!text) continue;

    const uniqueId = `default_${text}`;
    if (usedDefault.has(uniqueId)) continue;

    defaultPool.push({ id: uniqueId, text, type: "default" });
  }

  shuffle(customPool);
  shuffle(defaultPool);
  shuffle(namePool);


  // 각 플레이어에게 분배
  for (const sid of ids) {
    const picked = [];

    // 기본 1
    const d = defaultPool.shift();
    if (d) {
      usedDefault.add(d.id);
      picked.push(d);
    }

    // 커스텀 1 (없으면 기본으로 대체)
    const c = customPool.shift();
    if (c) {
    // 제출 문장에 실제로 사용했을 때만 소진 처리
      picked.push(c);
    } else {
      const d2 = defaultPool.shift();
      if (d2) {
        usedDefault.add(d2.id);
        picked.push(d2);
      }
    }

    // 이름 1 (없으면 기본으로 대체)
    const n = namePool.shift();
    if (n) {
      // 제출 문장에 실제로 사용했을 때만 소진 처리
      picked.push(n);
    } else {
      const d3 = defaultPool.shift();
      if (d3) {
        usedDefault.add(d3.id);
        picked.push(d3);
      }
    }

    // 3장 못 채우면 기본으로 채움
    while (picked.length < 3 && defaultPool.length > 0) {
      const extra = defaultPool.shift();
      if (!extra) break;
      usedDefault.add(extra.id);
      picked.push(extra);
    }

    room.game.inboxPromptCards[sid] = picked;

    // 카드 객체를 텍스트로 변환
    const finalPrompts = picked.map((card) => {
      if (card.type === "default") return `${card.text}`;
      if (card.type === "custom") return `${card.text}`;
      if (card.type === "name") return `${card.text}`;
      return card.text;
    });

    room.game.inboxPrompts[sid] = finalPrompts;
    room.players[sid].inboxPrompts = finalPrompts;
  }
}
// ====================================================================
// 스토리 체인 계산 로직

// 각 플레이어의 스토리 체인 초기화'
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

// ====================================================================
// 라운드 시작 처리 + 타이머

function startRound(roomId) {
  const room = getRoom(roomId);
  if (!room) return;
  if (room.phase !== "story") return;
  if (!room.game) return;
  if (room.game.round > 0) {
    // 라운드 1부터 카드 분배
    assignPrompts(room);
  }

  const order = room.game.turnOrder;
  const round = room.game.round;

  room.game.submittedStory[round] = new Set();

  // 작성 상태 초기화
  room.writingStatus = {};
  io.to(roomId).emit("story:writingStatus", { writingStatus: {} });

  for (const sid of order) {
    const chainId = computeChainForPlayer(room, sid);
    if (!chainId) continue;

    room.game.chainForPlayer[sid] = chainId;

    const chain = room.game.storyChains[chainId];
    let chainEntries = [];
    if (chain?.entries && chain.entries.length > 0) {
      const last = chain.entries[chain.entries.length - 1];
      chainEntries = [
        {
          round: last.round,
          writerId: last.writerId,
          text: last.text,
          usedKeywords: last.usedKeywords || [],
        },
      ];
    }

    io.to(sid).emit("story:round", {
      roomId: room.roomId,
      round: room.game.round,
      totalRounds: room.game.totalRounds,
      chainId,
      chainOwnerId: chain?.ownerId || chainId,
      chainEntries,
      inboxPrompts: room.game.round === 0 ? [] : room.game.inboxPrompts[sid] || [],
    });

    // 플레이어 제출 상태 초기화
    if (room.players[sid]) {
      room.players[sid].submitted.story = false;
    }
  }

  emitRoomState(room.roomId);

  // ------------------------------------------------------------
  // 라운드 타이머
  const TIMER_DURATION = 60;
  let secondsLeft = TIMER_DURATION;

  // 기존 타이머 정리
  if (room.game.timerInterval) {
    clearInterval(room.game.timerInterval);
    room.game.timerInterval = null;
  }

  // 시작 즉시 1회 전송
  io.to(roomId).emit("story:timer", { secondsLeft });

  room.game.timerInterval = setInterval(() => {
    secondsLeft -= 1;

    io.to(roomId).emit("story:timer", {
      secondsLeft: Math.max(0, secondsLeft),
    });

    if (secondsLeft <= 0) {
      clearInterval(room.game.timerInterval);
      room.game.timerInterval = null;

      const currentRoom = getRoom(roomId);
      if (!currentRoom || currentRoom.phase !== "story" || !currentRoom.game) return;

      // 타임아웃: 미제출자 자동 제출 처리
      const r = currentRoom.game.round;
      const order = currentRoom.game.turnOrder;
      const submittedSet = currentRoom.game.submittedStory?.[r] || new Set();

      for (const sid of order) {
        if (submittedSet.has(sid)) continue; // 이미 제출한 사람은 스킵

        const chainId = currentRoom.game.chainForPlayer?.[sid];
        const chain = chainId ? currentRoom.game.storyChains?.[chainId] : null;
        if (!chain) continue;

        const p = currentRoom.players[sid];
        let finalText = "";
        let usedKeywords = [];

        // 1. 드래프트(작성 중이던 내용)가 있으면 우선 사용
        if (p && p.draftStory && typeof p.draftStory === "string" && p.draftStory.trim().length > 0) {
          finalText = p.draftStory.trim();
          
          // 키워드 분석
          const cards = currentRoom.game.inboxPromptCards?.[sid] || [];
          usedKeywords = getUsedKeywordsFromCards(finalText, cards);

          // 사용된 커스텀 카드 처리
          const normalize = (s) => String(s || "").replace(/\s+/g, "");
          const submittedText = normalize(finalText);
          
          for (const card of cards) {
            if (!card || card.type !== "custom") continue;
            const key = normalize(card.text);
            const used = key && submittedText.includes(key);
            if (used) currentRoom.game.usedCustomPromptSet.add(card.id);
          }

        } else {
          // 2. 드래프트도 없으면 랜덤 자동 생성
          // 라운드0이면 자유 시작 기본문장
          if (r === 0) {
            const base = DEFAULT_SENTENCES_ROUND0[Math.floor(Math.random() * DEFAULT_SENTENCES_ROUND0.length)];
            finalText = base;
          } else {
            // 라운드1+면 "왼쪽 카드 1개"를 강제로 끼워넣는 버전
            const prompts = currentRoom.game.inboxPrompts?.[sid] || [];
            const first = prompts[0] ? String(prompts[0]) : "";
            const keyword = first.includes(":") ? first.split(":").slice(1).join(":").trim() : first.trim();

            const base = DEFAULT_SENTENCES_LATER[Math.floor(Math.random() * DEFAULT_SENTENCES_LATER.length)];
            const autoText = keyword ? `${base} ${keyword}` : base;

            const normalize = (s) => String(s || "").replace(/\s+/g, "");
            const submittedText = normalize(autoText);

            const cards = currentRoom.game.inboxPromptCards?.[sid] || [];
            for (const card of cards) {
              if (!card || card.type !== "custom") continue;
              const key = normalize(card.text);
              const used = key && submittedText.includes(key);
              if (used) currentRoom.game.usedCustomPromptSet.add(card.id);
            }
            
            usedKeywords = getUsedKeywordsFromCards(autoText, cards);
            finalText = autoText;
          }
        }

        chain.entries.push({ round: r, writerId: sid, text: finalText, usedKeywords });

        submittedSet.add(sid);
        if (currentRoom.players[sid]) currentRoom.players[sid].submitted.story = true;
      }

      currentRoom.game.submittedStory[r] = submittedSet;
      emitRoomState(roomId);

      // 시간 종료 시: 다음 라운드 or 결과
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
  }, 1000);
}

// ====================================================================
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
        usedKeywords: e.usedKeywords || [],
      })),
    };
  });

  return { chains, hostId: room.hostId };
}

// ====================================================================
// 게임 중단 처리

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

  if (room.startCountdownInterval) {
  clearInterval(room.startCountdownInterval);
  room.startCountdownInterval = null;
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
// 문장 내 카드 키워드 사용 여부 체크(하이라이트용)
function normalizeNoSpace(s) {
  return String(s || "").replace(/\s+/g, "");
}

function getUsedKeywordsFromCards(submittedText, cards) {
  const text = normalizeNoSpace(submittedText);
  const list = [];
  const arr = Array.isArray(cards) ? cards : [];

  for (const card of arr) {
    if (!card || !card.text) continue;
    const key = normalizeNoSpace(card.text);
    if (!key) continue;
    if (text.includes(key)) list.push(card.text);
  }

  // 중복 제거
  return Array.from(new Set(list));
}

// ====================================================================
// Socket.io 연결 처리

io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  // ------------------------------------------------------------
  // 방 생성
  socket.on("room:create", ({ name, avatar }, ack) => {
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
        startCountdownInterval: null,
      };

      socket.join(roomId);
      rooms[roomId].players[socket.id] = {
        id: socket.id,
        name: trimmed,
        avatar: avatar || null,
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

  // ------------------------------------------------------------
  // 방 참가
  socket.on("room:join", ({ roomId, name, avatar }, ack) => {
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
        avatar: avatar || null,
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

  // ------------------------------------------------------------
  // 방 나가기
  socket.on("room:leave", (_payload, ack) => {
    const rid = socket.data.roomId;
    if (!rid || !rooms[rid]) return ack?.({ ok: true });

    const room = rooms[rid];
    const wasInGame = room.phase !== "lobby";

    const player = room.players[socket.id];

    // 게임 중이 아니면 바로 삭제, 게임 중이면 disconnected 처리(방 유지)
    if (!wasInGame) {
      delete room.players[socket.id];
    } else {
      if (player) player.disconnected = true;
    }

    socket.leave(rid);
    socket.data.roomId = null;

    // 실제 활성 플레이어 수(연결된 사람만)
    const activePlayers = Object.values(room.players).filter((p) => !p.disconnected);
    const remainingCount = activePlayers.length;

    // 방장 위임
    if (room.hostId === socket.id) {
      room.hostId = remainingCount > 0 ? activePlayers[0].id : null;
    }

    // 아무도 없으면 방 삭제 (게임 중이라도 0명이면 삭제)
    if (Object.keys(room.players).length === 0 || (wasInGame && remainingCount === 0)) {
      delete rooms[rid];
      return ack?.({ ok: true });
    }

    // 방/게임 유지
    emitRoomState(rid);
    ack?.({ ok: true });
  });

  // ------------------------------------------------------------
  // 게임 시작
  socket.on("game:start", (_payload, ack) => {
    try {
      const rid = socket.data.roomId;
      const room = rid ? rooms[rid] : null;
      if (!room) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });

      if (socket.id !== room.hostId) return ack?.({ ok: false, error: "NOT_HOST" });
      if (Object.keys(room.players).length < 2) return ack?.({ ok: false, error: "2명 이상의 플레이어가 필요합니다!" });
    // 이미 카운트다운 중이면 중복 방지
    if (room.startCountdownInterval) {
      return ack?.({ ok: false, error: "COUNTDOWN_ALREADY_RUNNING" });
    }

    // phase를 countdown으로 전환
    room.phase = "countdown";
    emitRoomState(rid);

    ack?.({ ok: true });

    // 3초 카운트다운
    let secondsLeft = 3;

    // 시작 즉시 1회 전송
    io.to(rid).emit("game:countdown", { secondsLeft });

    room.startCountdownInterval = setInterval(() => {
      secondsLeft -= 1;

      if (secondsLeft > 0) {
        io.to(rid).emit("game:countdown", { secondsLeft });
        return;
      }

      // 0 도달: 종료
      clearInterval(room.startCountdownInterval);
      room.startCountdownInterval = null;

      // 실제 게임 시작(기존 로직)
      resetForNewGame(room);
      emitRoomState(rid);

      // 프론트가 필요하면 끝 이벤트도 보냄(선택)
      io.to(rid).emit("game:countdownEnd");
    }, 1000);

  } catch (e) {
    console.error(e);
    ack?.({ ok: false, error: "SERVER_ERROR" });
  }
});

  // ------------------------------------------------------------
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

  // ------------------------------------------------------------
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

      let finalText = String(text ?? "").trim();
      if (!finalText) return ack?.({ ok: false, error: "TEXT_REQUIRED" });

      const round = room.game.round;
      const chainId = room.game.chainForPlayer[socket.id];
      if (!chainId) return ack?.({ ok: false, error: "CHAIN_NOT_ASSIGNED" });

      const set = room.game.submittedStory[round];
      if (!set) room.game.submittedStory[round] = new Set();

      if (room.game.submittedStory[round].has(socket.id)) {
        return ack?.({ ok: false, error: "ALREADY_SUBMITTED" });
      }

      const chain = room.game.storyChains[chainId];
      if (!chain) return ack?.({ ok: false, error: "CHAIN_NOT_FOUND" });

      const playerCards = room.game.inboxPromptCards?.[socket.id] || [];
      let usedKeywords = getUsedKeywordsFromCards(finalText, playerCards);

      if (round > 0 && usedKeywords.length === 0 && playerCards.length > 0) {
        const randomCard = playerCards[Math.floor(Math.random() * playerCards.length)];
        if (randomCard && randomCard.text) {
          finalText += ` ${randomCard.text}`; // 띄어쓰기 후 키워드 추가
          usedKeywords = getUsedKeywordsFromCards(finalText, playerCards);
        }
      }

      // 사용된 '커스텀' 카드 ID를 usedCustomPromptSet에 기록
      if (round > 0) {
        const usedKeywordTexts = new Set(usedKeywords);
        for (const card of playerCards) {
          if (card.type === 'custom' && usedKeywordTexts.has(card.text)) {
            room.game.usedCustomPromptSet.add(card.id);
          }
        }
      }

      chain.entries.push({
        round,
        writerId: socket.id,
        text: finalText,
        usedKeywords,
      });

      room.game.submittedStory[round].add(socket.id);
      p.submitted.story = true;

      // 작성 상태 해제
      if (room.writingStatus) {
        room.writingStatus[socket.id] = false;
        io.to(rid).emit("story:writingStatus", { writingStatus: room.writingStatus });
      }

      emitRoomState(rid);
      ack?.({ ok: true });

      // 모든 플레이어가 제출했는지 확인 (유령 플레이어 방지: 현재 players 기준)
      const need = Object.values(room.players).filter((p) => !p.disconnected).length;

      if (room.game.submittedStory[round].size < need) return;

      // 타이머 정리(전원 제출로 라운드 종료)
      if (room.game.timerInterval) {
        clearInterval(room.game.timerInterval);
        room.game.timerInterval = null;
      }

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

// ------------------------------------------------------------
  // 결과 화면 네비게이션 (방장만 조작, 모두에게 동기화)
  socket.on("result:navigate", ({ chainIndex }, ack) => {
    try {
      const rid = socket.data.roomId;
      const room = rid ? rooms[rid] : null;
      if (!room) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });
      if (room.phase !== "result") return ack?.({ ok: false, error: "NOT_RESULT_PHASE" });
      if (socket.id !== room.hostId) return ack?.({ ok: false, error: "NOT_HOST" });

      // 모든 플레이어에게 현재 스토리 인덱스 브로드캐스트
      io.to(rid).emit("result:sync", { chainIndex });
      ack?.({ ok: true });
    } catch (e) {
      console.error(e);
      ack?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  // ------------------------------------------------------------
  // 다시하기 (방장이 누르면 모두 로비로 복귀)
  socket.on("game:restart", (_payload, ack) => {
    try {
      const rid = socket.data.roomId;
      const room = rid ? rooms[rid] : null;
      if (!room) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });
      if (socket.id !== room.hostId) return ack?.({ ok: false, error: "NOT_HOST" });

      // 타이머 정리
      if (room.game && room.game.timerInterval) {
        clearInterval(room.game.timerInterval);
        room.game.timerInterval = null;
      }

      // 로비로 복귀
      room.phase = "lobby";
      room.game = null;

      for (const sid of Object.keys(room.players)) {
        room.players[sid].submitted = { prompts: false, story: false };
        room.players[sid].prompts = [];
        room.players[sid].inboxPrompts = [];
      }

      // 모든 플레이어에게 로비 복귀 알림
      io.to(rid).emit("game:restarted");
      emitRoomState(rid);

      ack?.({ ok: true });
    } catch (e) {
      console.error(e);
      ack?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  // ------------------------------------------------------------
  // 키워드 작성 중 상태 업데이트
  socket.on("prompt:writing", ({ writing }, ack) => {
    try {
      const rid = socket.data.roomId;
      const room = rid ? rooms[rid] : null;
      if (!room) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });
      if (room.phase !== "prompt") return ack?.({ ok: false, error: "NOT_PROMPT_PHASE" });

      // 작성 상태 저장
      if (!room.promptWritingStatus) room.promptWritingStatus = {};
      room.promptWritingStatus[socket.id] = writing;

      // 모든 플레이어에게 작성 상태 브로드캐스트
      io.to(rid).emit("prompt:writingStatus", { writingStatus: room.promptWritingStatus });

      ack?.({ ok: true });
    } catch (e) {
      console.error(e);
      ack?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  // ------------------------------------------------------------
  // 스토리 작성 중 상태 업데이트 + 드래프트 저장 (Auto-Save)
  socket.on("story:writing", ({ writing, text }, ack) => {
    try {
      const rid = socket.data.roomId;
      const room = rid ? rooms[rid] : null;
      if (!room) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });
      if (room.phase !== "story") return ack?.({ ok: false, error: "NOT_STORY_PHASE" });

      // 작성 상태 저장
      if (!room.writingStatus) room.writingStatus = {};
      room.writingStatus[socket.id] = writing;

      // 드래프트 저장 (연결 끊김 대비)
      if (text !== undefined) {
        const p = room.players[socket.id];
        if (p) p.draftStory = text;
      }

      // 모든 플레이어에게 작성 상태 브로드캐스트
      io.to(rid).emit("story:writingStatus", { writingStatus: room.writingStatus });

      ack?.({ ok: true });
    } catch (e) {
      console.error(e);
      ack?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  // ------------------------------------------------------------
  // 이모티콘 전송
  socket.on("emoji:send", ({ emojiId }, ack) => {
    try {
      const rid = socket.data.roomId;
      const room = rid ? rooms[rid] : null;
      if (!room) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });

      const player = room.players[socket.id];
      if (!player) return ack?.({ ok: false, error: "PLAYER_NOT_FOUND" });

      // 모든 플레이어에게 이모티콘 브로드캐스트
      io.to(rid).emit("emoji:received", {
        senderId: socket.id,
        senderName: player.name,
        emojiId,
      });

      ack?.({ ok: true });
    } catch (e) {
      console.error(e);
      ack?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  // ------------------------------------------------------------
  // 결과 화면 문장 좋아요
  socket.on("sentence:like", ({ chainIndex, entryIndex }, ack) => {
    try {
      const rid = socket.data.roomId;
      const room = rid ? rooms[rid] : null;
      if (!room) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });

      const player = room.players[socket.id];
      if (!player) return ack?.({ ok: false, error: "PLAYER_NOT_FOUND" });

      // 결과 화면에서만 사용 가능
      if (room.phase !== "result") return ack?.({ ok: false, error: "NOT_RESULT_PHASE" });

      // 좋아요 데이터 초기화
      if (!room.sentenceLikes) room.sentenceLikes = {};
      const likeKey = `${chainIndex}_${entryIndex}`;
      if (!room.sentenceLikes[likeKey]) room.sentenceLikes[likeKey] = new Set();

      // 토글 방식: 이미 좋아요 했으면 취소, 아니면 추가
      if (room.sentenceLikes[likeKey].has(socket.id)) {
        room.sentenceLikes[likeKey].delete(socket.id);
      } else {
        room.sentenceLikes[likeKey].add(socket.id);
      }

      // 좋아요 수 계산
      const likeCount = room.sentenceLikes[likeKey].size;
      const totalPlayers = Object.keys(room.players).filter(pid => !room.players[pid].disconnected).length;

      // 모든 플레이어에게 좋아요 상태 브로드캐스트
      io.to(rid).emit("sentence:likeUpdated", {
        chainIndex,
        entryIndex,
        likeCount,
        totalPlayers,
        likedBy: Array.from(room.sentenceLikes[likeKey])
      });

      ack?.({ ok: true, likeCount, totalPlayers });
    } catch (e) {
      console.error(e);
      ack?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  // ------------------------------------------------------------
  // 결과 화면 이모티콘 전송 (따봉/박수 애니메이션)
  socket.on("result:emoji", ({ emojiType }, ack) => {
    try {
      const rid = socket.data.roomId;
      const room = rid ? rooms[rid] : null;
      if (!room) return ack?.({ ok: false, error: "ROOM_NOT_FOUND" });

      const player = room.players[socket.id];
      if (!player) return ack?.({ ok: false, error: "PLAYER_NOT_FOUND" });

      // 결과 화면에서만 사용 가능
      if (room.phase !== "result") return ack?.({ ok: false, error: "NOT_RESULT_PHASE" });

      // 모든 플레이어에게 이모티콘 브로드캐스트
      io.to(rid).emit("result:emojiReceived", {
        senderId: socket.id,
        senderName: player.name,
        emojiType,
      });

      ack?.({ ok: true });
    } catch (e) {
      console.error(e);
      ack?.({ ok: false, error: "SERVER_ERROR" });
    }
  });

  // ------------------------------------------------------------
  // 연결 끊김 처리
  socket.on("disconnect", () => {
    const rid = socket.data.roomId;
    if (!rid || !rooms[rid]) return;

    const room = rooms[rid];
    const wasInGame = room.phase !== "lobby";
    const player = room.players[socket.id];
    const playerName = player?.name || "Unknown";

    // 게임 중이 아니면 바로 삭제
    if (!wasInGame) {
      delete room.players[socket.id];
    } else {
      // 게임 중이면 disconnected 플래그 설정
      if (player) {
        player.disconnected = true;
      }
    }

    // 실제 활성 플레이어 수 계산 (연결된 사람만)
    const activePlayers = Object.values(room.players).filter(p => !p.disconnected);
    const remainingCount = activePlayers.length;

    // 방장 위임 로직
    if (room.hostId === socket.id) {
      if (remainingCount > 0) {
        room.hostId = activePlayers[0].id;
      } else {
        room.hostId = null;
      }
    }

    // 방 비었으면 삭제 (게임 중이라도 모두 나가면 삭제)
    if (Object.keys(room.players).length === 0 || (wasInGame && remainingCount === 0)) {
      console.log(`Room ${rid} deleted (no players left).`);
      delete rooms[rid];
      return;
    }

    // 게임 중 이탈 처리
    if (wasInGame) {
      console.log(`Player ${playerName} disconnected during game. ${remainingCount} active player(s) remaining.`);
      // 1명 이상 남아있으면 게임 유지.
      // 나간 플레이어의 처리는 타이머/라운드 로직에서 담당 (draft 사용 등)
      emitRoomState(rid);
      return;
    }

    emitRoomState(rid);
  });
});

// ====================================================================
// 서버 실행
const PORT = 3000;
server.listen(PORT, () => console.log(`http://localhost:${PORT}`));