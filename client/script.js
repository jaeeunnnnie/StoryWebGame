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
const btnNext = $("btn-next");

const btnCreateRoom = $("btn-create-room");
const roomCodeInput = $("input-room-code");
const btnJoinRoom = $("btn-join-room");

const displayRoomCode = $("display-room-code");
const playerList = $("player-list");

const btnLeave = $("btn-leave");
const btnStart = $("btn-start");

const btnSubmitPrompts = $("btn-submit-prompts");
const waitMsg = $("wait-msg");

const displayRound = $("display-round");
const displayTotalRounds = $("display-total-rounds");
const myInboxPrompts = $("my-inbox-prompts");
const storySoFar = $("story-so-far");
const inputStoryText = $("input-story-text");
const btnSubmitStory = $("btn-submit-story");
const storyWaitMsg = $("story-wait-msg");

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

function renderPlayers(players, hostId) {
  if (!playerList) return;
  playerList.innerHTML = "";

  players.forEach((p) => {
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

  storySoFar.innerHTML = entries
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
      .map((e, idx) => `<div style="margin-bottom:8px;">${e.text}</div>`)
      .join("");
    wrap.appendChild(body);

    finalResults.appendChild(wrap);
  }
}

function goByPhase(state) {
  if (!state) return;

  if (displayRoomCode) displayRoomCode.textContent = `#${state.roomId}`;
  renderPlayers(state.players || [], state.hostId);

  if (btnStart) {
    btnStart.disabled = socket.id !== state.hostId;
  }

  if (state.phase === "lobby") {
    showScreen(screenWaiting);
    return;
  }

  if (state.phase === "prompt") {
    showScreen(screenPrompts);

    if (btnSubmitPrompts) btnSubmitPrompts.disabled = false;
    if (waitMsg) waitMsg.classList.add("hidden");

    // 이미 제출한 사람은 버튼 잠그고 대기 메시지
    const me = (state.players || []).find((p) => p.id === socket.id);
    if (me?.submitted?.prompts) {
      if (btnSubmitPrompts) btnSubmitPrompts.disabled = true;
      if (waitMsg) waitMsg.classList.remove("hidden");
    }
    return;
  }

  if (state.phase === "story") {
    showScreen(screenStory);
    // round payload는 story:round 이벤트에서 갱신됨
    return;
  }

  if (state.phase === "result") {
    showScreen(screenResults);
    return;
  }

  showScreen(screenWaiting);
}

// ---- Socket events ----
socket.on("connect", () => {
  console.log("connected:", socket.id);
});

socket.on("disconnect", () => {
  console.log("disconnected");
  showScreen(screenLobby);
});

socket.on("room:state", (state) => {
  console.log("room:state", state);
  currentRoomState = state;
  goByPhase(state);
});

socket.on("game:aborted", ({ reason }) => {
  alertError(`게임이 중단됐어: ${reason}`);
  showScreen(screenWaiting);
});

socket.on("story:round", (payload) => {
  currentRoundPayload = payload;
  const currentRound = payload.round ?? 0;

  if (displayRound) displayRound.textContent = String(currentRound + 1);
  if (displayTotalRounds) displayTotalRounds.textContent = String(payload.totalRounds ?? 0);

  renderPromptChips(myInboxPrompts, payload.inboxPrompts || []);

  // 1라운드면 "지금까지 이야기" 영역 숨기기
  if (currentRound === 0) {
    if (storySoFar) {
      storySoFar.innerHTML = "";
      storySoFar.classList.add("hidden"); // CSS에 hidden이 display:none 이면 OK
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

socket.on("game:result", (payload) => {
  renderFinalResults(payload);
  showScreen(screenResults);
});

// ---- Button handlers ----
btnNext?.addEventListener("click", () => {
  const trimmed = String(nicknameInput?.value || "").trim();
  if (!trimmed) return alertError("닉네임을 입력해줘!");
  myName = trimmed;
  showScreen(screenLobby);
});

btnCreateRoom?.addEventListener("click", () => {
  if (!myName) return alertError("먼저 닉네임을 입력해줘!");

  socket.emit("room:create", { name: myName }, (res) => {
    if (!res?.ok) return alertError(`방 생성 실패: ${res?.error || "UNKNOWN"}`);
    if (res.state) {
      currentRoomState = res.state;
      goByPhase(res.state);
    }
  });
});

btnJoinRoom?.addEventListener("click", () => {
  if (!myName) return alertError("먼저 닉네임을 입력해줘!");

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

    showScreen(screenLobby);
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
