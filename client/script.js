const socket = io();

// ---- DOM helper ----
const $ = (id) => document.getElementById(id);

// ---- Screens ----
const screenEntry = $("screen-entry");
const screenJoin = $("screen-join");
const screenLobby = $("screen-lobby");
const screenPrompts = $("screen-prompts");
const screenStory = $("screen-story");
const screenResults = $("screen-results");

// ---- Entry ----
const nicknameInput = $("input-nickname");
const btnCreate = $("btn-create");
const btnGoJoin = $("btn-go-join");

// ---- Join ----
const roomCodeInput = $("input-room-code");
const btnJoin = $("btn-join");

// ---- Lobby ----
const roomCodeText = $("room-code");
const playerList = $("player-list");
const hostControls = $("host-controls");
const btnCopy = $("btn-copy");
const btnStart = $("btn-start");
const waitMsgLobby = $("wait-msg-lobby");

// ---- Prompts ----
const btnSubmitPrompts = $("btn-submit-prompts");
const waitMsgPrompts = $("wait-msg-prompts");

// ---- Story ----
const displayRound = $("display-round");
const displayTotalRounds = $("display-total-rounds");
const myInboxPrompts = $("my-inbox-prompts");
const storySoFar = $("story-so-far");
const inputStoryText = $("input-story-text");
const btnSubmitStory = $("btn-submit-story");
const storyWaitMsg = $("story-wait-msg");

// ---- Results ----
const finalResults = $("final-results");

// ---- Local state ----
let app = {
  nickname: "",
  role: null, // "host" | "guest"
  roomId: null,
  lastRoomState: null
};

let currentRoundPayload = null;

// ---- UI helpers ----
function showScreen(target) {
  [screenEntry, screenJoin, screenLobby, screenPrompts, screenStory, screenResults].forEach((s) =>
    s?.classList.add("hidden")
  );
  target?.classList.remove("hidden");
}

function alertError(msg) {
  alert(msg);
}

function renderPlayers(players = [], hostId) {
  if (!playerList) return;
  playerList.innerHTML = "";
  players.forEach((p) => {
    const div = document.createElement("div");
    div.className = "player-item";
    div.textContent = `${p.name}${p.id === hostId ? " (방장)" : ""}`;
    playerList.appendChild(div);
  });
}

function updateLobbyUI(state) {
  const isHost = socket.id === state.hostId;

  if (hostControls && waitMsgLobby) {
    if (isHost) {
      hostControls.classList.remove("hidden");
      waitMsgLobby.classList.add("hidden");
    } else {
      hostControls.classList.add("hidden");
      waitMsgLobby.classList.remove("hidden");
    }
  }

  if (btnStart) btnStart.disabled = !isHost;
}

function enterLobby(state) {
  const roomId = state.roomId ?? state.roomID ?? state.id;
  app.roomId = roomId;

  if (roomCodeText) roomCodeText.textContent = `#${roomId || "----"}`;

  renderPlayers(state.players || [], state.hostId);
  updateLobbyUI(state);

  showScreen(screenLobby);
}

function renderPromptChips(container, items) {
  if (!container) return;
  container.innerHTML = "";
  (items || []).forEach((t) => {
    const chip = document.createElement("div");
    chip.className = "result-item";
    chip.textContent = String(t ?? "");
    container.appendChild(chip);
  });
}

function renderStorySoFar(entries) {
  if (!storySoFar) return;

  if (!entries || entries.length === 0) {
    storySoFar.textContent = "아직 아무도 작성하지 않았어.";
    return;
  }

  storySoFar.innerHTML = entries
    .map((e, idx) => {
      const safe = String(e?.text ?? "");
      return `<div style="margin-bottom:8px;"><b>${idx + 1}.</b> ${safe}</div>`;
    })
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
    wrap.className = "card wide";
    wrap.style.textAlign = "left";
    wrap.style.marginBottom = "12px";

    const owner = String(chain?.ownerName ?? "익명");

    const title = document.createElement("h3");
    title.style.margin = "0 0 8px 0";
    title.textContent = `${owner}의 이야기`;
    wrap.appendChild(title);

    const body = document.createElement("div");
    body.innerHTML = (chain?.entries || [])
      .map((e, idx) => `<div style="margin-bottom:8px;"><b>${idx + 1}.</b> ${String(e?.text ?? "")}</div>`)
      .join("");
    wrap.appendChild(body);

    finalResults.appendChild(wrap);
  }
}

// ---- Debug ----
socket.on("connect", () => console.log("connected:", socket.id));
socket.on("disconnect", () => console.log("disconnected"));

// ---- Entry actions ----
btnCreate?.addEventListener("click", () => {
  console.log("[UI] btn-create clicked");
  const name = nicknameInput?.value?.trim() ?? "";
  if (!name) return alertError("닉네임을 입력해줘!");

  app.nickname = name;
  app.role = "host";

  socket.emit("room:create", { name: app.nickname });
});

btnGoJoin?.addEventListener("click", () => {
  console.log("[UI] btn-go-join clicked");
  const name = nicknameInput?.value?.trim() ?? "";
  if (!name) return alertError("닉네임을 입력해줘!");

  app.nickname = name;
  app.role = "guest";
  showScreen(screenJoin);
});

// ---- Join actions ----
btnJoin?.addEventListener("click", () => {
  console.log("[UI] btn-join clicked");
  const code = roomCodeInput?.value?.trim() ?? "";
  if (!code) return alertError("방 코드를 입력해줘!");

  socket.emit("room:join", { roomId: code, name: app.nickname });
});

// ---- Room state (single source of truth) ----
socket.on("room:state", (state) => {
  console.log("room:state", state);
  app.lastRoomState = state;

  if (state.phase === "lobby") return enterLobby(state);

  if (state.phase === "prompt") {
    showScreen(screenPrompts);
    if (btnSubmitPrompts) btnSubmitPrompts.disabled = false;
    if (waitMsgPrompts) waitMsgPrompts.classList.add("hidden");
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
  enterLobby(state);
});

// ---- Host actions ----
btnCopy?.addEventListener("click", () => {
  if (!app.roomId) return alertError("방 코드가 아직 없어.");
  navigator.clipboard.writeText(String(app.roomId));
  alert("방 코드가 복사되었습니다!");
});

btnStart?.addEventListener("click", () => {
  socket.emit("game:start");
});

// ---- Prompts ----
btnSubmitPrompts?.addEventListener("click", () => {
  const inputs = Array.from(document.querySelectorAll(".input-prompt"));
  const prompts = inputs.map((i) => (i?.value ?? "").trim()).filter(Boolean);

  if (prompts.length !== 3) return alertError("제시어 3개를 모두 입력해줘!");

  if (btnSubmitPrompts) btnSubmitPrompts.disabled = true;
  if (waitMsgPrompts) waitMsgPrompts.classList.remove("hidden");

  socket.emit("prompt:submit", { prompts });
});

// ---- Story round payload ----
socket.on("story:round", (payload) => {
  currentRoundPayload = payload;

  const roundIndex = payload?.round ?? 0;
  const totalRounds = payload?.totalRounds ?? 0;

  if (displayRound) displayRound.textContent = String(roundIndex + 1);
  if (displayTotalRounds) displayTotalRounds.textContent = String(totalRounds);

  renderPromptChips(myInboxPrompts, payload?.inboxPrompts || []);
  renderStorySoFar(payload?.chainEntries || []);

  if (inputStoryText) inputStoryText.value = "";
  if (btnSubmitStory) btnSubmitStory.disabled = false;
  if (storyWaitMsg) storyWaitMsg.classList.add("hidden");

  showScreen(screenStory);
});

// ---- Submit story ----
btnSubmitStory?.addEventListener("click", () => {
  const text = inputStoryText?.value?.trim() ?? "";
  if (!text) return alertError("문장을 입력해줘!");

  if (btnSubmitStory) btnSubmitStory.disabled = true;
  if (storyWaitMsg) storyWaitMsg.classList.remove("hidden");

  socket.emit("story:submit", { text });
});

// ---- Results payload ----
socket.on("game:result", (payload) => {
  renderFinalResults(payload);
  showScreen(screenResults);
});

// ---- 초기 화면 ----
showScreen(screenEntry);
