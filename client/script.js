const socket = io(); // 같은 서버(origin)로 연결 (http://localhost:3000)

// ---- DOM ----
const $ = (id) => document.getElementById(id);

const screenName = $("screen-name");
const screenLobby = $("screen-lobby");
const screenWaiting = $("screen-waiting");

const nicknameInput = $("input-nickname");
const btnNext = $("btn-next");

const btnCreateRoom = $("btn-create-room");
const roomCodeInput = $("input-room-code");
const btnJoinRoom = $("btn-join-room");

const displayRoomCode = $("display-room-code");
const playerList = $("player-list");

const btnLeave = $("btn-leave");
const btnStart = $("btn-start");

// ---- Local state ----
let myName = "";

// ---- UI helpers ----
function showScreen(which) {
  [screenName, screenLobby, screenWaiting].forEach((s) => s?.classList.add("hidden"));
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
    div.textContent = `${p.name}${isHost ? " (방장)" : ""}`;

    playerList.appendChild(div);
  });
}

// ---- Socket events ----
socket.on("connect", () => {
  console.log("connected:", socket.id);
});

socket.on("disconnect", () => {
  console.log("disconnected");
  // 연결 끊기면 로비로 돌려버림
  showScreen(screenLobby);
});

socket.on("room:state", (state) => {
  console.log("room:state", state);

  if (displayRoomCode) displayRoomCode.textContent = `#${state.roomId}`;
  renderPlayers(state.players, state.hostId);

  // phase 기준 화면 전환(현재는 lobby만 사실상 사용)
  // 룸 들어오면 대기실 화면 보여주기
  showScreen(screenWaiting);

  if (btnStart) {
    btnStart.disabled = socket.id !== state.hostId;
  }
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
    // ack로 state를 받을 수도 있지만, 서버가 곧 room:state 브로드캐스트 하므로 생략 가능
    if (res.state) {
      // 브로드캐스트보다 ack가 먼저 올 수 있어서 즉시 렌더해도 됨
      if (displayRoomCode) displayRoomCode.textContent = `#${res.roomId}`;
      renderPlayers(res.state.players, res.state.hostId);
      showScreen(screenWaiting);
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
      if (displayRoomCode) displayRoomCode.textContent = `#${res.roomId}`;
      renderPlayers(res.state.players, res.state.hostId);
      showScreen(screenWaiting);
    }
  });
});

btnLeave?.addEventListener("click", () => {
  socket.emit("room:leave", {}, (res) => {
    if (!res?.ok) return alertError(`나가기 실패: ${res?.error || "UNKNOWN"}`);

    // UI 초기화
    if (displayRoomCode) displayRoomCode.textContent = "#----";
    if (playerList) playerList.innerHTML = "";
    if (roomCodeInput) roomCodeInput.value = "";

    showScreen(screenLobby);
  });
});

// start 버튼은 아직 서버에 이벤트가 없으니 일단 안내만
btnStart?.addEventListener("click", () => {
  alert("아직 게임 시작 로직은 다음 단계(제시어 입력)에서 붙일 거야!");
});

// ---- 초기 화면 ----
showScreen(screenName);
