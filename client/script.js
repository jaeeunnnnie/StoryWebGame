// script.js (full, fixed)

const socket = io();

// ---- DOM ----
const $ = (id) => document.getElementById(id);

const screenName = $("screen-name");
const screenLobby = $("screen-lobby");
const screenWaiting = $("screen-waiting");
const screenPrompts = $("screen-prompts");
const screenStory = $("screen-story");
const screenResults = $("screen-results");

const nicknameInput = $("input-nickname");
//const btnNext = $("btn-next");

// entry buttons
const btnCreateRoom = $("btn-create-room");
const btnJoinRoom = $("btn-join-room");

// join screen
const roomCodeInput = $("input-room-code");
const btnJoin = $("btn-join"); // Go! 버튼 (중요)
const hostControls = $("host-controls");
const btnCopy = $("btn-copy");
const waitMsgLobby = $("wait-msg-lobby");


// lobby
const displayRoomCode = $("display-room-code");
const playerList = $("player-list");

const btnLeave = $("btn-leave");
const btnStart = $("btn-start");

// prompts
const btnSubmitPrompts = $("btn-submit-prompts");
const waitMsg = $("wait-msg");

// story
const displayRound = $("display-round");
const displayTotalRounds = $("display-total-rounds");
const myInboxPrompts = $("my-inbox-prompts");
const storySoFar = $("story-so-far");
const inputStoryText = $("input-story-text");
const btnSubmitStory = $("btn-submit-story");
const storyWaitMsg = $("story-wait-msg");
const displayTimer = $("display-timer");

// results
const finalResults = $("final-results");

// ---- Local state ----
let myName = "";
let currentRoomState = null;
let currentRoundPayload = null;

// ---- UI helpers ----
function showScreen(which) {
  [screenName, screenLobby, screenWaiting, screenPrompts, screenStory, screenResults].forEach((s) =>
    s?.classList.add("hidden")
  );
  if (which) which.classList.remove("hidden");
}

function alertError(msg) {
  alert(msg);
}

// 닉네임을 매번 안전하게 확보 (버튼 누르는 순간 읽어서 myName 갱신)
function ensureName() {
  const trimmed = String(nicknameInput?.value || "").trim();
  if (!trimmed) {
    alertError("닉네임을 입력해줘!");
    return null;
  }
  myName = trimmed;
  return myName;
}

function renderPlayers(players, hostId) {
  if (!playerList) return;
  playerList.innerHTML = "";

  (players || []).forEach((p) => {
    const div = document.createElement("div");
    div.className = "player-card";
    const isHost = p.id === hostId;
    const promptDone = p.submitted?.prompts ? " (제시어 완료)" : "";
    div.textContent = `${p.name}${isHost ? " (방장)" : ""}${promptDone}`;
    playerList.appendChild(div);
  });
}

function renderPromptChips(container, items) {
  if (!container) return;
  container.innerHTML = "";
  for (const t of items || []) {
    const chip = document.createElement("div");
    chip.className = "result-item";
    chip.textContent = t;
    container.appendChild(chip);
  }
}

function renderStorySoFar(entries, round) {
  if (!storySoFar) return;

  if (round === 0) {
    storySoFar.innerHTML = "";
    storySoFar.classList.add("hidden");
    return;
  }

  storySoFar.classList.remove("hidden");

  if (!entries || entries.length === 0) {
    storySoFar.textContent = "아직 아무도 작성하지 않았어.";
    return;
  }

  storySoFar.innerHTML = (entries || [])
    .map((e) => `<div style="margin-bottom:8px;">${String(e.text || "")}</div>`)
    .join("");
}

function renderFinalResults(payload) {
  if (!finalResults) return;
  finalResults.innerHTML = "";

  const chains = payload?.chains || [];
  if (chains.length === 0) {
    finalResults.textContent = "결과가 없어.";
    return;
  }

  for (const chain of chains) {
    const wrap = document.createElement("div");
    wrap.className = "card";
    wrap.style.width = "100%";
    wrap.style.textAlign = "left";
    wrap.style.marginBottom = "12px";

    const title = document.createElement("div");
    title.innerHTML = `<h3 style="margin:0 0 8px 0;">${chain.ownerName}의 이야기</h3>`;
    wrap.appendChild(title);

    const body = document.createElement("div");
    body.innerHTML = (chain.entries || [])
      .map((e) => `<div style="margin-bottom:8px;">${String(e.text || "")}</div>`)
      .join("");
    wrap.appendChild(body);

    finalResults.appendChild(wrap);
  }
}

function goByPhase(state) {
  if (!state) return;

  if (displayRoomCode) displayRoomCode.textContent = `#${state.roomId}`;
  renderPlayers(state.players || [], state.hostId);

  

  if (btnStart) btnStart.disabled = socket.id !== state.hostId;

if (state.phase === "lobby") {
  showScreen(screenLobby);

  const isHost = socket.id === state.hostId;

  // 방장/게스트 UI 토글
  if (hostControls) hostControls.classList.toggle("hidden", !isHost);
  if (waitMsgLobby) waitMsgLobby.classList.toggle("hidden", isHost);

  // 방장만 시작 가능
  if (btnStart) btnStart.disabled = !isHost;

  return;
}


  if (state.phase === "prompt") {
    showScreen(screenPrompts);

    if (btnSubmitPrompts) btnSubmitPrompts.disabled = false;
    if (waitMsg) waitMsg.classList.add("hidden");

    const me = (state.players || []).find((p) => p.id === socket.id);
    if (me?.submitted?.prompts) {
      if (btnSubmitPrompts) btnSubmitPrompts.disabled = true;
      if (waitMsg) waitMsg.classList.remove("hidden");
    }
    return;
  }

  if (state.phase === "story") {
    showScreen(screenStory);
    return;
  }

  if (state.phase === "result") {
    showScreen(screenResults);
    return;
  }

  // fallback
  showScreen(screenLobby);
}

// ---- Socket events ----
socket.on("connect", () => {
  console.log("connected:", socket.id);
});

socket.on("disconnect", () => {
  console.log("disconnected");
  // 연결 끊기면 안전하게 입장 화면으로
  showScreen(screenName);
});

socket.on("room:state", (state) => {
  console.log("room:state", state);
  currentRoomState = state;
  goByPhase(state);
});

socket.on("game:aborted", ({ reason }) => {
  alertError(`게임이 중단됐어: ${reason}`);
  showScreen(screenLobby);
});

socket.on("story:round", (payload) => {
  currentRoundPayload = payload;
  const currentRound = payload.round ?? 0;

  if (displayRound) displayRound.textContent = String(currentRound + 1);
  if (displayTotalRounds) displayTotalRounds.textContent = String(payload.totalRounds ?? 0);

  renderPromptChips(myInboxPrompts, payload.inboxPrompts || []);

  if (currentRound === 0) {
    if (storySoFar) {
      storySoFar.innerHTML = "";
      storySoFar.classList.add("hidden");
    }
  } else {
    if (storySoFar) storySoFar.classList.remove("hidden");
    renderStorySoFar(payload.chainEntries || [], currentRound);
  }

  if (inputStoryText) inputStoryText.value = "";
  if (btnSubmitStory) btnSubmitStory.disabled = false;
  if (storyWaitMsg) storyWaitMsg.classList.add("hidden");

  showScreen(screenStory);
});

socket.on("story:timer", ({ secondsLeft }) => {
  if (displayTimer) {
    displayTimer.textContent = `${secondsLeft}s`;
  }
});

socket.on("game:result", (payload) => {
  renderFinalResults(payload);
  showScreen(screenResults);
});

// ---- Button handlers ----

// (옵션) Next 버튼: 닉네임 저장하고 join 화면으로 이동
//btnNext?.addEventListener("click", () => {
 // if (!ensureName()) return;
 // showScreen(screenWaiting);
 // setTimeout(() => roomCodeInput?.focus(), 0);
//});

// 방 만들기: 닉네임 확인 후 바로 생성
btnCreateRoom?.addEventListener("click", () => {
  if (!ensureName()) return;

  socket.emit("room:create", { name: myName }, (res) => {
    if (!res?.ok) return alertError(`방 생성 실패: ${res?.error || "UNKNOWN"}`);
    if (res.state) {
      currentRoomState = res.state;
      goByPhase(res.state);
    }
  });
});

// 방 들어가기: 닉네임 확인 후 방 코드 입력 화면으로 이동만
btnJoinRoom?.addEventListener("click", () => {
  if (!ensureName()) return;

  showScreen(screenWaiting);
  setTimeout(() => roomCodeInput?.focus(), 0);
});

// Go!: 실제 방 입장
btnJoin?.addEventListener("click", () => {
  if (!ensureName()) return;

  const roomId = String(roomCodeInput?.value || "").trim();
  if (!roomId) return alertError("방 코드를 입력해줘!");

  socket.emit("room:join", { roomId, name: myName }, (res) => {
    if (!res?.ok) return alertError(`방 입장 실패: ${res?.error || "UNKNOWN"}`);
    if (res.state) {
      currentRoomState = res.state;
      goByPhase(res.state);
    }
  });
});

btnLeave?.addEventListener("click", () => {
  socket.emit("room:leave", {}, (res) => {
    if (!res?.ok) return alertError(`나가기 실패: ${res?.error || "UNKNOWN"}`);

    if (displayRoomCode) displayRoomCode.textContent = "#----";
    if (playerList) playerList.innerHTML = "";
    if (roomCodeInput) roomCodeInput.value = "";

    showScreen(screenName);
  });
});

btnStart?.addEventListener("click", () => {
  socket.emit("game:start", {}, (res) => {
    if (!res?.ok) return alertError(`시작 실패: ${res?.error || "UNKNOWN"}`);
  });
});

btnSubmitPrompts?.addEventListener("click", () => {
  const inputs = Array.from(document.querySelectorAll(".input-prompt"));
  const prompts = inputs.map((el) => String(el.value || "").trim()).filter(Boolean);

  if (prompts.length !== 3) return alertError("제시어 3개를 모두 입력해줘!");

  btnSubmitPrompts.disabled = true;
  if (waitMsg) waitMsg.classList.remove("hidden");

  socket.emit("prompt:submit", { prompts }, (res) => {
    if (!res?.ok) {
      btnSubmitPrompts.disabled = false;
      if (waitMsg) waitMsg.classList.add("hidden");
      return alertError(`제시어 제출 실패: ${res?.error || "UNKNOWN"}`);
    }
  });
});

btnSubmitStory?.addEventListener("click", () => {
  const text = String(inputStoryText?.value || "").trim();
  if (!text) return alertError("문장을 입력해줘!");

  btnSubmitStory.disabled = true;
  if (storyWaitMsg) storyWaitMsg.classList.remove("hidden");

  socket.emit("story:submit", { text }, (res) => {
    if (!res?.ok) {
      btnSubmitStory.disabled = false;
      if (storyWaitMsg) storyWaitMsg.classList.add("hidden");
      return alertError(`제출 실패: ${res?.error || "UNKNOWN"}`);
    }
  });
});

// ---- 초기 화면 ----
showScreen(screenName);
