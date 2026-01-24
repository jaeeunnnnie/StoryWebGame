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
const roomCodeDisplay = $("room-code-display"); // 방 코드 표시 컨테이너 (클릭 시 복사)
const waitMsgLobby = $("wait-msg-lobby");

// BGM
const bgm = $("bgm");


// lobby
const displayRoomCode = $("display-room-code");
const playerList = $("player-list");

const btnLeave = $("btn-leave");
const btnStart = $("btn-start");

// prompts
const btnSubmitPrompts = $("btn-submit-prompts");
const waitMsg = $("wait-msg");
const displayPromptTimer = $("display-prompt-timer");
const promptStatusList = $("prompt-status-list");

// story
const displayRound = $("display-round");
const displayTotalRounds = $("display-total-rounds");
const myInboxPrompts = $("my-inbox-prompts");
const storySoFar = $("story-so-far");
const inputStoryText = $("input-story-text");
const btnSubmitStory = $("btn-submit-story");
const storyWaitMsg = $("story-wait-msg");
const displayTimer = $("display-timer");

// results (채팅방 스타일)
const storyTitle = $("story-title");
const chatContainer = $("chat-container");
const storyProgress = $("story-progress");
const progressText = $("progress-text");
const btnPrev = $("btn-prev");
const btnNextStory = $("btn-next-story");
const btnRestart = $("btn-restart");
const btnScreenshot = $("btn-screenshot");

// player status (작성 상태)
const playerStatusList = $("player-status-list");

// player sidebar (양쪽 플레이어 사이드바 - 스토리 화면)
const playersLeft = $("players-left");
const playersRight = $("players-right");

// player sidebar (양쪽 플레이어 사이드바 - 키워드 화면)
const promptsPlayersLeft = $("prompts-players-left");
const promptsPlayersRight = $("prompts-players-right");

// emoji (이모티콘)
const btnEmojiToggle = $("btn-emoji-toggle");
const emojiPicker = $("emoji-picker");
const emojiList = $("emoji-list");
const emojiDisplay = $("emoji-display");

// avatar (아바타)
const avatarList = $("avatar-list");
const avatarPreview = $("avatar-preview");

// result emoji (결과 화면 이모티콘)
const btnResultThumbsup = $("btn-result-thumbsup");
const btnResultClap = $("btn-result-clap");
const resultEmojiContainer = $("result-emoji-container");

// ---- Local state ----
let myName = "";
let myAvatar = null; // 선택한 아바타 ID
let currentRoomState = null;
let currentRoundPayload = null;
let isWriting = false; // 작성 중 상태
let writingTimeout = null; // 작성 중 타이머

// 결과 화면 상태
let resultData = null;       // 전체 결과 데이터
let resultHostId = null;     // 결과 화면의 방장 ID
let currentChainIndex = 0;   // 현재 스토리 인덱스
let chatAnimationTimer = null; // 채팅 애니메이션 타이머
let displayedEntryCount = 0;   // 현재 표시된 문장 수

// TTS 관련
let ttsEnabled = true;       // TTS 활성화 여부
let currentAudio = null;     // 현재 재생 중인 오디오
let currentTTSId = 0;        // TTS 요청 ID (취소/중복 방지용)

// 닉네임 색상 배열 (다양한 색상으로 구분)
const NICKNAME_COLORS = [
  "#f59e0b", // 주황 (기존)
  "#3b82f6", // 파랑
  "#10b981", // 초록
  "#ec4899", // 핑크
  "#8b5cf6", // 보라
  "#ef4444", // 빨강
  "#06b6d4", // 청록
  "#84cc16", // 연두
];

// 플레이어 이름 → 색상 매핑 (결과 화면용)
let playerColorMap = {};

// ---- Utility: Visual Length ----
function getVisualLength(str) {
  if (!str) return 0;
  let len = 0;
  for (let i = 0; i < str.length; i++) {
    // 한글 등 2바이트 이상 문자는 가중치 2, 그 외 1
    if (str.charCodeAt(i) > 127) len += 2;
    else len += 1;
  }
  return len;
}

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

// 제시어 사용 현황 UI 갱신
function updatePromptUsageUI() {
  if (!inputStoryText || !myInboxPrompts) return;

  const textRaw = String(inputStoryText.value || "");
  const text = textRaw.replace(/\s+/g, ""); // 공백 제거

  const chips = Array.from(myInboxPrompts.querySelectorAll(".result-item"));
  for (const chip of chips) {
    const keyRaw = String(chip.dataset.prompt || "");
    const key = keyRaw.replace(/\s+/g, ""); // 공백 제거
    if (!key) continue;

    const used = text.includes(key);
    chip.classList.toggle("used", used);
  }
}


// 닉네임을 매번 안전하게 확보 (버튼 누르는 순간 읽어서 myName 갱신)
function ensureName() {
  const raw = String(nicknameInput?.value || "");
  const trimmed = raw.trim();
  
  if (!trimmed) {
    alertError("닉네임을 입력해줘!");
    return null;
  }

  const vLen = getVisualLength(trimmed);
  if (vLen > 16) {
    alertError(`닉네임이 너무 길어! (한글 8자, 영문 16자 이내)\n현재 길이: ${vLen}/16`);
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

    // 아바타 표시
    const avatarDiv = document.createElement("div");
    avatarDiv.className = "player-avatar";
    const avatar = getAvatarById(p.avatar);
    if (avatar) {
      if (avatar.type === "image") {
        avatarDiv.innerHTML = `<img src="${avatar.content}" alt="${avatar.id}">`;
      } else {
        avatarDiv.textContent = avatar.content;
      }
    } else {
      avatarDiv.textContent = "?";
    }

    // 이름 표시
    const nameDiv = document.createElement("div");
    nameDiv.className = "player-name";
    let displayName = p.name;
    if (getVisualLength(displayName) > 16) {
      displayName = displayName.substring(0, 10) + "...";
    }
    nameDiv.textContent = `${displayName}${isHost ? " (방장)" : ""}${promptDone}`;
    nameDiv.title = p.name;

    div.appendChild(avatarDiv);
    div.appendChild(nameDiv);
    playerList.appendChild(div);
  });
}

// 키워드 작성 상태 렌더링 (키워드 입력 화면에서 사용)
function renderPromptStatus(players, writingStatus) {
  if (!promptStatusList) return;
  promptStatusList.innerHTML = "";

  (players || []).forEach((p) => {
    const div = document.createElement("div");
    const isDone = p.submitted?.prompts === true;
    const isWritingNow = writingStatus?.[p.id] === true;

    div.className = `player-status-item ${isDone ? "done" : (isWritingNow ? "writing" : "")}`;

    const iconSpan = document.createElement("span");
    iconSpan.className = "status-icon";

    if (isDone) {
      iconSpan.innerHTML = '<img src="/image/03_키워드 적기/작성완료.png" class="status-icon-img" alt="완료">';
    } else if (isWritingNow) {
      iconSpan.innerHTML = '<img src="/image/03_키워드 적기/작성중.png" class="status-icon-img" alt="작성중">';
    } else {
      iconSpan.innerHTML = '<img src="/image/03_키워드 적기/생각중.png" class="status-icon-img" alt="생각중">';
    }

    const nameSpan = document.createElement("span");
    nameSpan.textContent = p.name;

    div.appendChild(iconSpan);
    div.appendChild(nameSpan);
    promptStatusList.appendChild(div);
  });
}

// 플레이어 작성 상태 렌더링 (스토리 화면에서 사용)
function renderPlayerStatus(players, writingStatus) {
  if (!playerStatusList) return;
  playerStatusList.innerHTML = "";

  (players || []).forEach((p) => {
    const div = document.createElement("div");
    const isDone = p.submitted?.story === true;
    const isWritingNow = writingStatus?.[p.id] === true;

    div.className = `player-status-item ${isDone ? "done" : (isWritingNow ? "writing" : "")}`;

    const iconSpan = document.createElement("span");
    iconSpan.className = "status-icon";

    if (isDone) {
      iconSpan.textContent = "✓";
    } else if (isWritingNow) {
      iconSpan.textContent = "...";
    } else {
      iconSpan.textContent = "○";
    }

    const nameSpan = document.createElement("span");
    nameSpan.textContent = p.name;

    div.appendChild(iconSpan);
    div.appendChild(nameSpan);
    playerStatusList.appendChild(div);
  });
}

// 플레이어 사이드바 렌더링 (양쪽에 배치)
function renderPlayerSidebars(players, writingStatus) {
  if (!playersLeft || !playersRight) return;

  playersLeft.innerHTML = "";
  playersRight.innerHTML = "";

  const playerArray = players || [];
  const totalPlayers = playerArray.length;

  // 홀수면 왼쪽이 하나 더 많게
  const leftCount = Math.ceil(totalPlayers / 2);

  playerArray.forEach((p, index) => {
    const isLeftSide = index < leftCount;
    const playerDiv = createSidebarPlayer(p, writingStatus, isLeftSide, "story");

    if (isLeftSide) {
      playersLeft.appendChild(playerDiv);
    } else {
      playersRight.appendChild(playerDiv);
    }
  });
}

// 키워드 화면용 플레이어 사이드바 렌더링
function renderPromptsSidebars(players, writingStatus) {
  if (!promptsPlayersLeft || !promptsPlayersRight) return;

  promptsPlayersLeft.innerHTML = "";
  promptsPlayersRight.innerHTML = "";

  const playerArray = players || [];
  const totalPlayers = playerArray.length;

  // 홀수면 왼쪽이 하나 더 많게
  const leftCount = Math.ceil(totalPlayers / 2);

  playerArray.forEach((p, index) => {
    const isLeftSide = index < leftCount;
    const playerDiv = createSidebarPlayer(p, writingStatus, isLeftSide, "prompts");

    if (isLeftSide) {
      promptsPlayersLeft.appendChild(playerDiv);
    } else {
      promptsPlayersRight.appendChild(playerDiv);
    }
  });
}

// 키워드 화면 사이드바 상태 업데이트
function updatePromptsSidebarStatus(players, writingStatus) {
  if (!promptsPlayersLeft || !promptsPlayersRight) return;

  (players || []).forEach((p) => {
    const playerDiv = promptsPlayersLeft.querySelector(`[data-player-id="${p.id}"]`) ||
                      promptsPlayersRight.querySelector(`[data-player-id="${p.id}"]`);

    if (!playerDiv) return;

    const isDone = p.submitted?.prompts === true;
    const isWritingNow = writingStatus?.[p.id] === true;

    // 클래스 업데이트
    playerDiv.classList.remove("done", "writing");
    if (isDone) {
      playerDiv.classList.add("done");
    } else if (isWritingNow) {
      playerDiv.classList.add("writing");
    }

    // 상태 텍스트 업데이트
    const statusDiv = playerDiv.querySelector(".player-status");
    if (statusDiv) {
      if (isDone) {
        statusDiv.innerHTML = '<img src="/image/04_스토리 적기/작성완료.png" class="sidebar-status-icon" alt="완료"> 완료';
      } else if (isWritingNow) {
        statusDiv.innerHTML = '<img src="/image/04_스토리 적기/작성중.png" class="sidebar-status-icon" alt="작성중"> 작성중';
      } else {
        statusDiv.innerHTML = '<img src="/image/04_스토리 적기/생각중.png" class="sidebar-status-icon" alt="생각중"> 생각중';
      }
    }
  });
}

// 사이드바 플레이어 요소 생성
// screenType: "story" (스토리 화면) 또는 "prompts" (키워드 화면)
function createSidebarPlayer(player, writingStatus, isLeftSide, screenType = "story") {
  const submittedField = screenType === "prompts" ? "prompts" : "story";
  const isDone = player.submitted?.[submittedField] === true;
  const isWritingNow = writingStatus?.[player.id] === true;
  const isMe = player.id === socket.id;

  const div = document.createElement("div");
  div.className = `sidebar-player ${isDone ? "done" : (isWritingNow ? "writing" : "")}`;
  div.dataset.playerId = player.id;

  // 아바타
  const avatarDiv = document.createElement("div");
  avatarDiv.className = "player-avatar";
  const avatarData = getAvatarById(player.avatar);
  if (avatarData) {
    if (avatarData.type === "image") {
      avatarDiv.innerHTML = `<img src="${avatarData.content}" alt="${player.name}">`;
    } else {
      avatarDiv.textContent = avatarData.content;
    }
  } else {
    avatarDiv.textContent = "👤";
  }

  // 이름
  const nameDiv = document.createElement("div");
  nameDiv.className = "player-name";
  nameDiv.textContent = player.name;
  div.title = player.name; // 툴팁

  // 상태
  const statusDiv = document.createElement("div");
  statusDiv.className = "player-status";
  if (isDone) {
    statusDiv.innerHTML = '<img src="/image/04_스토리 적기/작성완료.png" class="sidebar-status-icon" alt="완료"> 완료';
  } else if (isWritingNow) {
    statusDiv.innerHTML = '<img src="/image/04_스토리 적기/작성중.png" class="sidebar-status-icon" alt="작성중"> 작성중';
  } else {
    statusDiv.innerHTML = '<img src="/image/04_스토리 적기/생각중.png" class="sidebar-status-icon" alt="생각중"> 생각중';
  }

  div.appendChild(avatarDiv);
  div.appendChild(nameDiv);
  div.appendChild(statusDiv);

  // 본인 아바타 아래에만 이모티콘 버튼 추가
  if (isMe) {
    const emojiToggleBtn = document.createElement("button");
    emojiToggleBtn.className = "sidebar-emoji-toggle";
    emojiToggleBtn.textContent = "😊";
    emojiToggleBtn.title = "이모티콘";

    const emojiPickerDiv = document.createElement("div");
    emojiPickerDiv.className = "sidebar-emoji-picker hidden";
    renderSidebarEmojiPicker(emojiPickerDiv);

    emojiToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      
      const isHidden = emojiPickerDiv.classList.contains("hidden");
      
      // 다른 모든 피커 닫기
      document.querySelectorAll(".sidebar-emoji-picker").forEach(el => el.classList.add("hidden"));
      
      if (isHidden) {
        emojiPickerDiv.classList.remove("hidden");
        
        // --- Dynamic Positioning Logic ---
        // 왼쪽 사이드바면 오른쪽으로, 오른쪽이면 왼쪽으로
        // "Left-aligned Profile: The emoticon window should open to the left" (Prompt requirement)
        // -> However, standard is opening *inwards*. 
        // -> Requirement says: "Left-aligned Profile: ... open to the left", "Right-aligned Profile: ... open to the right".
        // -> This might push it off-screen. I will implement clamping.
        
        // Reset styles first
        emojiPickerDiv.style.left = "";
        emojiPickerDiv.style.right = "";
        emojiPickerDiv.style.top = "100%";
        emojiPickerDiv.style.transform = "";

        if (isLeftSide) {
           // Left Sidebar -> Open to the LEFT (same side as profile)
           emojiPickerDiv.style.right = "105%"; // Open to the left
           emojiPickerDiv.style.left = "auto";
           emojiPickerDiv.style.top = "0";
           emojiPickerDiv.style.transform = "none";
        } else {
           // Right Sidebar -> Open to the RIGHT (same side as profile)
           emojiPickerDiv.style.left = "105%"; // Open to the right
           emojiPickerDiv.style.right = "auto";
           emojiPickerDiv.style.top = "0";
           emojiPickerDiv.style.transform = "none";
        }

        // Clamping (Overflow protection)
        const rect = emojiPickerDiv.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        
        // If overflowing right edge
        if (rect.right > viewportWidth) {
          emojiPickerDiv.style.left = "auto";
          emojiPickerDiv.style.right = "105%"; // Flip to left
        }
        
        // If overflowing left edge
        if (rect.left < 0) {
          emojiPickerDiv.style.right = "auto";
          emojiPickerDiv.style.left = "105%"; // Flip to right
        }
      }
    });

    div.appendChild(emojiToggleBtn);
    div.appendChild(emojiPickerDiv);
  }

  return div;
}

// 사이드바 플레이어 상태만 업데이트 (다시 렌더링하지 않고)
function updateSidebarPlayerStatus(players, writingStatus) {
  if (!playersLeft || !playersRight) return;

  (players || []).forEach((p) => {
    const isDone = p.submitted?.story === true;
    const isWritingNow = writingStatus?.[p.id] === true;

    // 왼쪽, 오른쪽 모두에서 찾기
    const playerDiv = playersLeft.querySelector(`[data-player-id="${p.id}"]`) ||
                      playersRight.querySelector(`[data-player-id="${p.id}"]`);

    if (playerDiv) {
      playerDiv.className = `sidebar-player ${isDone ? "done" : (isWritingNow ? "writing" : "")}`;

      const statusDiv = playerDiv.querySelector(".player-status");
      if (statusDiv) {
        if (isDone) {
          statusDiv.innerHTML = '<img src="/image/04_스토리 적기/작성완료.png" class="sidebar-status-icon" alt="완료"> 완료';
        } else if (isWritingNow) {
          statusDiv.innerHTML = '<img src="/image/04_스토리 적기/작성중.png" class="sidebar-status-icon" alt="작성중"> 작성중';
        } else {
          statusDiv.innerHTML = '<img src="/image/04_스토리 적기/생각중.png" class="sidebar-status-icon" alt="생각중"> 생각중';
        }
      }
    }
  });
}

// ---- 아바타 관련 ----
// 아바타 목록 - 새 아바타 추가 시 아래 배열에 추가하면 됩니다
// type: "image" = 커스텀 이미지 (경로)
// 예: { id: "avatar2", type: "image", content: "/image/01_메인화면/아바타2.png" }
const AVATAR_LIST = [
  { id: "avatar1", type: "image", content: "/image/01_메인화면/아바타.png" },
  // 새 아바타 추가 예시:
  // { id: "avatar2", type: "image", content: "/image/01_메인화면/아바타2.png" },
  // { id: "avatar3", type: "image", content: "/image/01_메인화면/아바타3.png" },
];

// 아바타 목록 렌더링
function renderAvatarList() {
  if (!avatarList) return;
  avatarList.innerHTML = "";

  for (const avatar of AVATAR_LIST) {
    const div = document.createElement("div");
    div.className = "avatar-item";
    div.dataset.avatarId = avatar.id;

    if (avatar.type === "image") {
      const img = document.createElement("img");
      img.src = avatar.content;
      img.alt = avatar.id;
      div.appendChild(img);
    } else {
      div.textContent = avatar.content;
    }

    div.addEventListener("click", () => {
      selectAvatar(avatar.id);
    });

    avatarList.appendChild(div);
  }

  // 기본 선택: 첫 번째 아바타
  if (AVATAR_LIST.length > 0 && !myAvatar) {
    selectAvatar(AVATAR_LIST[0].id);
  }
}

// 아바타 선택
function selectAvatar(avatarId) {
  myAvatar = avatarId;

  // UI 업데이트 - 선택 표시
  const items = avatarList?.querySelectorAll(".avatar-item");
  items?.forEach((item) => {
    item.classList.toggle("selected", item.dataset.avatarId === avatarId);
  });

  // 미리보기 업데이트
  if (avatarPreview) {
    const avatar = getAvatarById(avatarId);
    if (avatar) {
      if (avatar.type === "image") {
        avatarPreview.innerHTML = `<img src="${avatar.content}" alt="${avatar.id}">`;
      } else {
        avatarPreview.textContent = avatar.content;
      }
    }
  }
}

// 아바타 ID로 아바타 객체 찾기
function getAvatarById(avatarId) {
  return AVATAR_LIST.find((a) => a.id === avatarId) || null;
}

// ---- 이모티콘 관련 ----
// 이모티콘 목록 (나중에 커스텀 이미지로 교체 가능)
// type: "emoji" = 기본 이모지, "image" = 커스텀 이미지
const EMOJI_LIST = [
  { id: "laugh", type: "emoji", content: "😂" },
  { id: "heart", type: "emoji", content: "❤️" },
  { id: "thumbsup", type: "emoji", content: "👍" },
  { id: "clap", type: "emoji", content: "👏" },
  { id: "fire", type: "emoji", content: "🔥" },
  { id: "thinking", type: "emoji", content: "🤔" },
  { id: "cry", type: "emoji", content: "😭" },
  { id: "surprise", type: "emoji", content: "😱" },
];

// 이모티콘 목록 렌더링 (전역 이모지 리스트용 - 기존 호환)
function renderEmojiList() {
  if (!emojiList) return;
  emojiList.innerHTML = "";

  for (const emoji of EMOJI_LIST) {
    const btn = document.createElement("button");
    btn.className = "emoji-btn";
    btn.dataset.emojiId = emoji.id;

    if (emoji.type === "image") {
      const img = document.createElement("img");
      img.src = emoji.content;
      img.alt = emoji.id;
      btn.appendChild(img);
    } else {
      btn.textContent = emoji.content;
    }

    btn.addEventListener("click", () => {
      sendEmoji(emoji.id);
    });

    emojiList.appendChild(btn);
  }
}

// 사이드바 이모티콘 피커 렌더링 (본인 아바타 아래용)
function renderSidebarEmojiPicker(container) {
  if (!container) return;
  container.innerHTML = "";

  for (const emoji of EMOJI_LIST) {
    const btn = document.createElement("button");
    btn.className = "sidebar-emoji-btn";
    btn.dataset.emojiId = emoji.id;

    if (emoji.type === "image") {
      const img = document.createElement("img");
      img.src = emoji.content;
      img.alt = emoji.id;
      btn.appendChild(img);
    } else {
      btn.textContent = emoji.content;
    }

    btn.addEventListener("click", (e) => {
      e.stopPropagation(); // 이벤트 버블링 방지
      sendEmoji(emoji.id);
    });

    container.appendChild(btn);
  }
}

// 페이지 로드 시 이모티콘 목록 초기화
document.addEventListener("DOMContentLoaded", () => {
  renderEmojiList();
});

// 이모티콘 선택창 토글
function toggleEmojiPicker(show) {
  if (!emojiPicker) return;
  if (show === undefined) {
    emojiPicker.classList.toggle("hidden");
  } else {
    emojiPicker.classList.toggle("hidden", !show);
  }
}

// 이모티콘 전송
function sendEmoji(emojiId) {
  socket.emit("emoji:send", { emojiId });
}

// 받은 이모티콘 표시 (플레이어 아바타 주위에 랜덤 위치로 표시)
function displayReceivedEmoji(senderId, senderName, emojiId) {
  const emoji = EMOJI_LIST.find(e => e.id === emojiId);
  if (!emoji) return;

  // 사이드바에서 해당 플레이어 찾기 (스토리 화면 + 키워드 화면 모두 검색)
  const playerDiv = playersLeft?.querySelector(`[data-player-id="${senderId}"]`) ||
                    playersRight?.querySelector(`[data-player-id="${senderId}"]`) ||
                    promptsPlayersLeft?.querySelector(`[data-player-id="${senderId}"]`) ||
                    promptsPlayersRight?.querySelector(`[data-player-id="${senderId}"]`);

  if (playerDiv) {
    // 플레이어가 어느 사이드바에 있는지 확인
    const isLeftSide = playersLeft?.contains(playerDiv) || promptsPlayersLeft?.contains(playerDiv);
    let parentSidebar;
    if (playersLeft?.contains(playerDiv)) parentSidebar = playersLeft;
    else if (playersRight?.contains(playerDiv)) parentSidebar = playersRight;
    else if (promptsPlayersLeft?.contains(playerDiv)) parentSidebar = promptsPlayersLeft;
    else parentSidebar = promptsPlayersRight;

    // 플레이어 위치 가져오기
    const playerRect = playerDiv.getBoundingClientRect();
    const sidebarRect = parentSidebar.getBoundingClientRect();

    // 이모티콘 엘리먼트 생성
    const emojiEl = document.createElement("div");
    emojiEl.className = "player-emoji-floating";
    emojiEl.style.position = "absolute";
    emojiEl.style.fontSize = "32px";
    emojiEl.style.zIndex = "100";
    emojiEl.style.pointerEvents = "none";

    if (emoji.type === "image") {
      emojiEl.innerHTML = `<img src="${emoji.content}" alt="${emojiId}" style="width: 40px; height: 40px;">`;
    } else {
      emojiEl.textContent = emoji.content;
    }

    // 랜덤 위치 계산 (플레이어 프로필 주위) - 범위 확대
    const randomOffsetX = (Math.random() - 0.5) * 150; // -75px ~ +75px
    const randomOffsetY = (Math.random() - 0.5) * 100; // -50px ~ +50px
    const randomRotation = (Math.random() - 0.5) * 60; // -30deg ~ +30deg

    // 사이드바 기준 위치 계산
    const relativeTop = playerRect.top - sidebarRect.top + playerRect.height / 2 + randomOffsetY;
    let relativeLeft;

    if (isLeftSide) {
      // 왼쪽 사이드바: 프로필 오른쪽에 표시 (좀 더 안쪽/바깥쪽 다양하게)
      relativeLeft = playerRect.width + 20 + randomOffsetX;
    } else {
      // 오른쪽 사이드바: 프로필 왼쪽에 표시
      relativeLeft = -60 + randomOffsetX;
    }

    emojiEl.style.top = relativeTop + "px";
    emojiEl.style.left = relativeLeft + "px";
    emojiEl.style.transform = `rotate(${randomRotation}deg)`;

    // 사이드바에 추가 (relative positioning을 위해)
    parentSidebar.style.position = "relative";
    parentSidebar.appendChild(emojiEl);

    // 애니메이션: 위로 올라가며 페이드아웃
    const animation = emojiEl.animate([
      {
        transform: `translateY(0) scale(0.5) rotate(${randomRotation}deg)`,
        opacity: 0
      },
      {
        transform: `translateY(0) scale(1.2) rotate(${randomRotation}deg)`,
        opacity: 1,
        offset: 0.1
      },
      {
        transform: `translateY(-100px) scale(1) rotate(${randomRotation}deg)`,
        opacity: 0
      }
    ], {
      duration: 2500,
      easing: "ease-out"
    });

    animation.onfinish = () => {
      emojiEl.remove();
    };

  } else {
    // 사이드바에 플레이어가 없으면 중앙에 표시
    if (!emojiDisplay) return;

    const container = document.createElement("div");
    container.className = "emoji-floating";

    const iconDiv = document.createElement("div");
    iconDiv.className = "emoji-icon";

    if (emoji.type === "image") {
      const img = document.createElement("img");
      img.src = emoji.content;
      img.alt = emojiId;
      iconDiv.appendChild(img);
    } else {
      iconDiv.textContent = emoji.content;
    }

    const senderDiv = document.createElement("div");
    senderDiv.className = "emoji-sender";
    senderDiv.textContent = senderName;

    container.appendChild(iconDiv);
    container.appendChild(senderDiv);
    emojiDisplay.appendChild(container);

    // 3초 후 제거
    setTimeout(() => {
      container.remove();
    }, 3000);
  }
}

// ---- 결과 화면 이모티콘 애니메이션 ----
// 설정: 이모티콘 개수 (여기서 수정 가능)
const RESULT_EMOJI_CONFIG = {
  count: 8,              // 한 번에 생성되는 이모티콘 개수
  minRiseHeight: 300,    // 최소 올라가는 높이 (px)
  maxRiseHeight: 500,    // 최대 올라가는 높이 (px)
  minDuration: 2.5,      // 최소 애니메이션 시간 (초)
  maxDuration: 4,        // 최대 애니메이션 시간 (초)
  maxStartY: 100,        // 최대 시작 Y 위치 (화면 하단으로부터, px) - 너무 위에서 시작하지 않도록
};

// 결과 화면 이모티콘 전송
function sendResultEmoji(emojiType) {
  socket.emit("result:emoji", { emojiType });
}

// 결과 화면 이모티콘 표시 (여러 개가 아래에서 올라오는 애니메이션)
function displayResultEmoji(senderName, emojiType) {
  if (!resultEmojiContainer) return;

  // 이모티콘 콘텐츠 결정
  const emojiContent = emojiType === "thumbsup" ? "👍" : "👏";
  const senderColor = playerColorMap[senderName] || "#fbbf24"; // 이름에 맞는 색상 가져오기

  const count = RESULT_EMOJI_CONFIG.count;

  for (let i = 0; i < count; i++) {
    // 약간의 시간차를 두고 생성
    setTimeout(() => {
      createResultEmojiFloat(senderName, emojiContent, senderColor);
    }, i * 80); // 80ms 간격
  }
}

// 개별 이모티콘 요소 생성
function createResultEmojiFloat(senderName, emojiContent, senderColor) {
  const container = document.createElement("div");
  container.className = "result-emoji-float";

  // 랜덤 X 위치 (화면 너비의 10% ~ 90%)
  const screenWidth = window.innerWidth;
  const minX = screenWidth * 0.1;
  const maxX = screenWidth * 0.9;
  const randomX = minX + Math.random() * (maxX - minX);

  // 랜덤 시작 Y 위치 (0 ~ maxStartY, 화면 하단 기준)
  const startY = Math.random() * RESULT_EMOJI_CONFIG.maxStartY;

  // 랜덤 올라가는 높이
  const riseHeight = RESULT_EMOJI_CONFIG.minRiseHeight +
    Math.random() * (RESULT_EMOJI_CONFIG.maxRiseHeight - RESULT_EMOJI_CONFIG.minRiseHeight);

  // 랜덤 애니메이션 시간
  const duration = RESULT_EMOJI_CONFIG.minDuration +
    Math.random() * (RESULT_EMOJI_CONFIG.maxDuration - RESULT_EMOJI_CONFIG.minDuration);

  // CSS 변수로 전달
  container.style.setProperty("--rise-height", `-${riseHeight}px`);
  container.style.setProperty("--rise-duration", `${duration}s`);
  container.style.left = `${randomX}px`;
  container.style.bottom = `${startY}px`;

  // 이모티콘 콘텐츠
  const emojiDiv = document.createElement("div");
  emojiDiv.className = "emoji-content";
  emojiDiv.textContent = emojiContent;

  // 보낸 사람 이름
  const nameDiv = document.createElement("div");
  nameDiv.className = "emoji-name";
  nameDiv.textContent = senderName;
  nameDiv.style.color = senderColor; // 이름 색상 적용

  container.appendChild(emojiDiv);
  container.appendChild(nameDiv);
  resultEmojiContainer.appendChild(container);

  // 애니메이션 종료 후 제거
  setTimeout(() => {
    container.remove();
  }, duration * 1000 + 100);
}

function renderPromptChips(container, items) {
  if (!container) return;
  container.innerHTML = "";
  for (const t of items || []) {
    const chip = document.createElement("div");
    chip.className = "result-item";
    chip.textContent = t;
    chip.dataset.prompt = normalizePromptText(t);
    chip.style.cursor = "pointer"; // 클릭 가능 표시

    // 클릭 시 textarea에 자동 입력
    chip.addEventListener("click", () => {
      if (inputStoryText && !inputStoryText.disabled) {
        const currentText = inputStoryText.value;
        const keyword = t;

        // 현재 텍스트가 있으면 공백 추가, 없으면 그대로
        if (currentText.trim()) {
          inputStoryText.value = currentText + " " + keyword;
        } else {
          inputStoryText.value = keyword;
        }

        // textarea에 포커스
        inputStoryText.focus();

        // 커서를 끝으로 이동
        inputStoryText.setSelectionRange(inputStoryText.value.length, inputStoryText.value.length);
        
        // 입력 이벤트 트리거 (작성 상태 및 자동저장 트리거)
        inputStoryText.dispatchEvent(new Event('input'));
      }
    });

    container.appendChild(chip);
  }
}

// 제시어 텍스트 비교용 (앞부분 라벨 제거)

// XSS 방지용 HTML escape
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 문장 안에서 사용된 카드 키워드를 하이라이트
function highlightKeywords(text, keywords) {
  const raw = String(text ?? "");
  const list = Array.isArray(keywords) ? keywords.filter(Boolean) : [];
  if (list.length === 0) return escapeHtml(raw);

  // 긴 키워드부터 먼저 치환(부분 겹침 최소화)
  const sorted = [...new Set(list)].sort((a, b) => String(b).length - String(a).length);

  let html = escapeHtml(raw);
  for (const kw of sorted) {
    const safeKw = escapeHtml(String(kw));
    const re = new RegExp(escapeRegExp(safeKw), "g");
    html = html.replace(re, `<span class="prompt-highlight">${safeKw}</span>`);
  }
  return html;
}

function normalizePromptText(labelText) {
  const s = String(labelText ?? "").trim();
  const idx = s.indexOf(":");
  if (idx === -1) return s;
  return s.slice(idx + 1).trim();
}

// ---- TTS 함수 (TypeCast API 사용) ----
// TTS 전면 취소 함수 (새로운 TTS 요청 전에 호출)
function cancelTTS() {
  currentTTSId++; // ID 증가시켜 이전 콜백 무효화
  stopTTS();
}

function stopTTS() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch (e) {
      console.warn("TTS 정지 중 오류:", e);
    }
    currentAudio = null;
  }
}

function speakText(text, onEndCallback) {
  if (!ttsEnabled || !text) {
    // TTS 비활성화 또는 텍스트 없으면 바로 콜백 호출
    if (onEndCallback) onEndCallback();
    return;
  }

  // 이전 TTS 중지 및 ID 갱신
  cancelTTS();
  const myId = currentTTSId; // 이 요청의 ID 캡처

  // 서버에 TTS 요청
  socket.emit("tts:request", { text }, (response) => {
    // ID가 변경되었으면 (취소되었으면) 무시
    if (myId !== currentTTSId) return;

    if (!response) {
      console.error("TTS 응답 없음");
      if (onEndCallback) onEndCallback();
      return;
    }

    if (!response.ok) {
      console.error("TTS 요청 실패:", response.error);
      if (onEndCallback) onEndCallback();
      return;
    }

    try {
      // Base64 오디오 데이터를 Audio 객체로 변환
      const audioData = response.audioData;
      const format = response.format || "mp3";
      const mimeType = format === "mp3" ? "audio/mpeg" : "audio/wav";

      const audioBlob = base64ToBlob(audioData, mimeType);
      const audioUrl = URL.createObjectURL(audioBlob);

      const audio = new Audio(audioUrl);
      currentAudio = audio;

      // 오디오 재생 완료 시 콜백 호출
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        if (myId === currentTTSId) {
          currentAudio = null;
          if (onEndCallback) onEndCallback();
        }
      };

      audio.onerror = (e) => {
        console.error("오디오 재생 중 오류:", e);
        URL.revokeObjectURL(audioUrl);
        if (myId === currentTTSId) {
          currentAudio = null;
          if (onEndCallback) onEndCallback();
        }
      };

      // 오디오 재생
      audio.play().catch((e) => {
        console.error("오디오 재생 실패:", e);
        URL.revokeObjectURL(audioUrl);
        if (myId === currentTTSId) {
          currentAudio = null;
          if (onEndCallback) onEndCallback();
        }
      });

    } catch (e) {
      console.error("TTS 처리 중 오류:", e);
      if (myId === currentTTSId && onEndCallback) onEndCallback();
    }
  });
}

// Base64를 Blob으로 변환하는 헬퍼 함수
function base64ToBlob(base64, mimeType) {
  try {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  } catch (e) {
    console.error("Base64 디코딩 오류:", e);
    throw e;
  }
}

// 폭죽 효과 표시
function showFireworks(element) {
  const fireworksColors = ["#ff0", "#f0f", "#0ff", "#f00", "#0f0", "#00f", "#ffa500"];

  // 여러 개의 파티클 생성
  for (let i = 0; i < 20; i++) {
    const particle = document.createElement("div");
    particle.style.cssText = `
      position: absolute;
      width: 8px;
      height: 8px;
      background: ${fireworksColors[Math.floor(Math.random() * fireworksColors.length)]};
      border-radius: 50%;
      pointer-events: none;
      z-index: 1000;
    `;

    const rect = element.getBoundingClientRect();
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;

    particle.style.left = startX + "px";
    particle.style.top = startY + "px";

    document.body.appendChild(particle);

    // 랜덤 방향으로 애니메이션
    const angle = (Math.PI * 2 * i) / 20;
    const distance = 50 + Math.random() * 50;
    const endX = startX + Math.cos(angle) * distance;
    const endY = startY + Math.sin(angle) * distance;

    particle.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        { transform: `translate(${endX - startX}px, ${endY - startY}px) scale(0)`, opacity: 0 }
      ],
      {
        duration: 800,
        easing: "cubic-bezier(0, 0.5, 0.5, 1)"
      }
    ).onfinish = () => {
      particle.remove();
    };
  }

  // 이모지 폭죽 효과
  const emojiFireworks = ["🎉", "✨", "🌟", "💫", "⭐"];
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const emoji = document.createElement("div");
      emoji.textContent = emojiFireworks[Math.floor(Math.random() * emojiFireworks.length)];
      emoji.style.cssText = `
        position: absolute;
        font-size: 24px;
        pointer-events: none;
        z-index: 1001;
      `;

      const rect = element.getBoundingClientRect();
      emoji.style.left = rect.left + Math.random() * rect.width + "px";
      emoji.style.top = rect.top + "px";

      document.body.appendChild(emoji);

      emoji.animate(
        [
          { transform: "translateY(0) scale(1)", opacity: 1 },
          { transform: "translateY(-100px) scale(1.5)", opacity: 0 }
        ],
        {
          duration: 1000,
          easing: "ease-out"
        }
      ).onfinish = () => {
        emoji.remove();
      };
    }, i * 100);
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
  .map((e) => {
    const t = e?.text || "";
    const kws = e?.usedKeywords || [];
    return `<div style="margin-bottom:8px;">${highlightKeywords(t, kws)}</div>`;
  })
  .join("");

}

// 방장 여부 체크
function isResultHost() {
  return socket.id === resultHostId;
}

// 채팅 애니메이션 정지
function stopChatAnimation() {
  if (chatAnimationTimer) {
    clearTimeout(chatAnimationTimer);
    chatAnimationTimer = null;
  }
}

// 채팅방 스타일 결과 표시 함수들
function initResultsPresentation(payload) {
  resultData = payload;
  resultHostId = payload?.hostId || null;
  currentChainIndex = 0;
  displayedEntryCount = 0;

  // 이전 TTS, 애니메이션 중지
  cancelTTS();
  stopChatAnimation();

  // 플레이어별 색상 매핑 생성
  playerColorMap = {};
  const chains = payload?.chains || [];

  // 모든 작성자 이름 수집 (중복 제거)
  const allWriters = new Set();
  for (const chain of chains) {
    if (chain.ownerName) allWriters.add(chain.ownerName);
    for (const entry of (chain.entries || [])) {
      if (entry.writerName) allWriters.add(entry.writerName);
    }
  }

  // 각 작성자에게 색상 할당
  let colorIndex = 0;
  for (const writerName of allWriters) {
    playerColorMap[writerName] = NICKNAME_COLORS[colorIndex % NICKNAME_COLORS.length];
    colorIndex++;
  }

  if (chains.length === 0) {
    if (storyTitle) storyTitle.textContent = "결과가 없어요";
    if (chatContainer) chatContainer.innerHTML = "";
    if (btnPrev) btnPrev.classList.add("hidden");
    if (btnNextStory) btnNextStory.classList.add("hidden");
    if (btnRestart) btnRestart.classList.remove("hidden");
    return;
  }

  // 첫 스토리 표시 시작
  displayStory(0);
}

// 특정 스토리 표시 (채팅방 스타일로 문장 순차 표시)
function displayStory(chainIndex) {
  cancelTTS();
  stopChatAnimation();

  currentChainIndex = chainIndex;
  displayedEntryCount = 0;

  const chains = resultData?.chains || [];
  const chain = chains[chainIndex];
  if (!chain) return;

  const entries = chain.entries || [];
  const totalStories = chains.length;

  // 제목 표시
  if (storyTitle) {
    storyTitle.textContent = `${chain.ownerName}의 이야기`;
    storyTitle.style.animation = "none";
    storyTitle.offsetHeight;
    storyTitle.style.animation = "fadeIn 0.5s ease";
  }

  // 진행 상황 표시
  if (progressText) {
    progressText.textContent = `스토리 ${chainIndex + 1} / ${totalStories}`;
  }

  // 채팅 컨테이너 초기화
  if (chatContainer) {
    chatContainer.innerHTML = "";
  }

  // 버튼 상태 업데이트 (애니메이션 중에는 비활성화)
  updateResultButtons(true);

  // 제목 TTS 먼저 (에러 핸들링)
  try {
    speakText(`${chain.ownerName}의 이야기`);
  } catch (e) {
    console.error("제목 TTS 재생 중 오류:", e);
  }

  // 문장들을 순차적으로 표시
  if (entries.length > 0) {
    setTimeout(() => {
      showNextChatMessage(entries, 0);
    }, 1500); // 제목 TTS 후 잠시 대기
  } else {
    // 문장이 없으면 바로 버튼 활성화
    updateResultButtons(false);
  }
}

// 채팅 메시지 하나씩 표시
function showNextChatMessage(entries, index) {
  if (index >= entries.length) {
    // 모든 문장 표시 완료
    updateResultButtons(false);
    return;
  }

  const entry = entries[index];
  const isLastEntry = (index === entries.length - 1);

  // 채팅 메시지 생성
  const messageDiv = document.createElement("div");
  messageDiv.className = "chat-message";

  const writerName = entry.writerName || "알 수 없음";

  // 플레이어 정보 찾기
  const writer = (currentRoomState?.players || []).find(p => p.name === writerName);
  const avatarData = writer ? getAvatarById(writer.avatar) : null;

  // 아바타 요소 생성
  const avatarDiv = document.createElement("div");
  avatarDiv.className = "chat-avatar";
  if (avatarData) {
    if (avatarData.type === "image") {
      avatarDiv.innerHTML = `<img src="${avatarData.content}" alt="${writerName}">`;
    } else {
      avatarDiv.textContent = avatarData.content;
    }
  } else {
    avatarDiv.textContent = "👤";
  }

  // 이름, 버블 컨테이너
  const contentDiv = document.createElement("div");
  contentDiv.className = "chat-content";

  const writerDiv = document.createElement("div");
  writerDiv.className = "chat-writer";
  writerDiv.textContent = writerName;

  // 플레이어별 고유 색상 적용
  const writerColor = playerColorMap[writerName] || NICKNAME_COLORS[0];
  writerDiv.style.color = writerColor;

  const bubbleDiv = document.createElement("div");
  bubbleDiv.className = "chat-bubble";
  bubbleDiv.innerHTML = highlightKeywords(entry.text || "", entry.usedKeywords || []);

  // 좋아요 버튼 추가
  const likeBtn = document.createElement("button");
  likeBtn.className = "like-btn";
  likeBtn.innerHTML = `<span class="like-icon">❤️</span> <span class="like-count">0</span>`;
  likeBtn.dataset.chainIndex = currentChainIndex;
  likeBtn.dataset.entryIndex = index;
  likeBtn.style.cssText = "margin-top: 5px; padding: 5px 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); border-radius: 15px; cursor: pointer; font-size: 14px;";

  likeBtn.addEventListener("click", () => {
    const chainIdx = parseInt(likeBtn.dataset.chainIndex);
    const entryIdx = parseInt(likeBtn.dataset.entryIndex);
    socket.emit("sentence:like", { chainIndex: chainIdx, entryIndex: entryIdx });
  });

  contentDiv.appendChild(writerDiv);
  contentDiv.appendChild(bubbleDiv);
  contentDiv.appendChild(likeBtn);

  messageDiv.appendChild(avatarDiv);
  messageDiv.appendChild(contentDiv);

  if (chatContainer) {
    chatContainer.appendChild(messageDiv);
    // 스크롤 맨 아래로
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  displayedEntryCount = index + 1;

  // TTS로 읽기 - 완료 후 다음 메시지로 넘어감
  speakText(entry.text, () => {
    // TTS 완료 후 약간의 딜레이 추가 (자연스러운 전환)
    chatAnimationTimer = setTimeout(() => {
      if (isLastEntry) {
        // 마지막 문장이면 버튼 활성화
        updateResultButtons(false);
      } else {
        // 다음 메시지 표시
        showNextChatMessage(entries, index + 1);
      }
    }, 500); // TTS 완료 후 0.5초 딜레이
  });
}

// 버튼 상태 업데이트
function updateResultButtons(isAnimating = false) {
  const chains = resultData?.chains || [];
  const isFirstStory = currentChainIndex === 0;
  const isLastStory = currentChainIndex === chains.length - 1;
  const isHost = isResultHost();
  const chain = chains[currentChainIndex];
  const entries = chain?.entries || [];
  const allDisplayed = displayedEntryCount >= entries.length;

  // 이전/다음 버튼은 방장만 표시
  if (btnPrev) {
    if (isHost) {
      btnPrev.disabled = isFirstStory || isAnimating;
      btnPrev.classList.remove("hidden");
    } else {
      btnPrev.classList.add("hidden");
    }
  }

  if (btnNextStory) {
    if (isHost) {
      if (isLastStory && allDisplayed) {
        btnNextStory.textContent = "완료!";
        btnNextStory.disabled = true;
      } else {
        btnNextStory.textContent = "다음 스토리 →";
        btnNextStory.disabled = isAnimating || !allDisplayed;
      }
      btnNextStory.classList.remove("hidden");
    } else {
      btnNextStory.classList.add("hidden");
    }
  }

  // 다시하기 버튼 (마지막 스토리에서 모든 문장 표시 완료 시, 방장만)
  if (btnRestart) {
    btnRestart.classList.toggle("hidden", !(isLastStory && allDisplayed && isHost));
  }
}

// 다음 스토리로 이동
function goNextStory() {
  if (!isResultHost()) return;

  const chains = resultData?.chains || [];
  if (currentChainIndex >= chains.length - 1) return;

  // 서버에 동기화 요청
  socket.emit("result:navigate", { chainIndex: currentChainIndex + 1 });
}

// 이전 스토리로 이동
function goPrevStory() {
  if (!isResultHost()) return;

  if (currentChainIndex <= 0) return;

  // 서버에 동기화 요청
  socket.emit("result:navigate", { chainIndex: currentChainIndex - 1 });
}

// 서버에서 동기화 신호 받으면 해당 스토리 표시
function syncResultsDisplay(chainIndex) {
  displayStory(chainIndex);
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

    // 키워드 입력 필드 초기화 (다시하기 시)
    const promptInputs = document.querySelectorAll(".input-prompt");
    promptInputs.forEach(input => {
      input.value = "";
    });

    // 플레이어 사이드바 렌더링 (키워드 화면)
    renderPromptsSidebars(state.players, {});

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
  console.log("✅ Socket 연결됨:", socket.id);
});

socket.on("disconnect", () => {
  console.log("❌ Socket 연결 끊김");
  // TTS 중지
  cancelTTS();
  // 연결 끊기면 안전하게 입장 화면으로
  showScreen(screenName);
});

socket.on("room:state", (state) => {
  console.log("room:state", state);
  currentRoomState = state;
  goByPhase(state);
});

socket.on("game:aborted", ({ reason }) => {
  // TTS 중지
  cancelTTS();
  alertError(`게임이 중단됐어: ${reason}`);
  showScreen(screenLobby);
});

socket.on("story:round", (payload) => {
  // Fix: 라운드 시작 시 모든 플레이어 상태를 즉시 '생각중'으로 업데이트
  if (currentRoomState && currentRoomState.players) {
    updateSidebarPlayerStatus(currentRoomState.players, {});
  }

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

  // 입력란 초기화 및 재활성화
  if (inputStoryText) {
    inputStoryText.value = "";
    inputStoryText.disabled = false;
    inputStoryText.style.opacity = "1";
    inputStoryText.style.cursor = "text";
  }
  // 제시어 사용 현황 UI 갱신
  updatePromptUsageUI();

  // 버튼/메시지 초기화
  if (btnSubmitStory) btnSubmitStory.disabled = false;
  // 대기 메시지 숨기기
  if (storyWaitMsg) storyWaitMsg.classList.add("hidden");

  // 작성 상태 초기화
  isWriting = false;
  if (writingTimeout) clearTimeout(writingTimeout);

  // 플레이어 상태 초기 렌더링 (사이드바)
  if (currentRoomState && currentRoomState.players) {
    renderPlayerStatus(currentRoomState.players, {});
    renderPlayerSidebars(currentRoomState.players, {});
  }

  showScreen(screenStory);
});

socket.on("prompt:timer", ({ secondsLeft }) => {
  if (displayPromptTimer) {
    displayPromptTimer.textContent = `${secondsLeft}s`;
    // 10초 이하일 때 색상 변경
    if (secondsLeft <= 10) {
      displayPromptTimer.style.color = "#ef4444"; // 빨강
    } else {
      displayPromptTimer.style.color = "#ff6b6b";
    }
  }
});

socket.on("story:timer", ({ secondsLeft }) => {
  if (displayTimer) {
    displayTimer.textContent = `${secondsLeft}s`;
  }

  // 타이머 종료 시 (0초) 작성한 내용 자동 제출
  if (secondsLeft === 0) {
    const text = String(inputStoryText?.value || "").trim();

    // 버튼이 비활성화되지 않았고 텍스트가 있으면 자동 제출
    if (btnSubmitStory && !btnSubmitStory.disabled && text) {
      console.log("타이머 종료: 자동 제출");
      btnSubmitStory.click();
    }
  }
});

socket.on("game:result", (payload) => {
  initResultsPresentation(payload);
  showScreen(screenResults);
});

// 결과 화면 동기화 (방장이 조작하면 모두에게 전파)
socket.on("result:sync", ({ chainIndex }) => {
  syncResultsDisplay(chainIndex);
});

// 다시하기 (방장이 누르면 모두 로비로)
socket.on("game:restarted", () => {
  // 키워드 입력란 초기화
  const promptInputs = document.querySelectorAll(".input-prompt");
  promptInputs.forEach((input) => {
    input.value = "";
  });

  // 스토리 입력란 초기화
  if (inputStoryText) inputStoryText.value = "";

  // 제시어 제출 버튼 활성화
  if (btnSubmitPrompts) btnSubmitPrompts.disabled = false;
  if (waitMsg) waitMsg.classList.add("hidden");

  showScreen(screenLobby);
});

// 키워드 작성 상태 업데이트
socket.on("prompt:writingStatus", ({ writingStatus }) => {
  if (currentRoomState && currentRoomState.players) {
    renderPromptStatus(currentRoomState.players, writingStatus);
    updatePromptsSidebarStatus(currentRoomState.players, writingStatus);
  }
});

// 플레이어 작성 상태 업데이트
socket.on("story:writingStatus", ({ writingStatus }) => {
  if (currentRoomState && currentRoomState.players) {
    renderPlayerStatus(currentRoomState.players, writingStatus);
    updateSidebarPlayerStatus(currentRoomState.players, writingStatus);
  }
});

// 이모티콘 수신
socket.on("emoji:received", ({ senderId, senderName, emojiId }) => {
  console.log("✨ 이모티콘 수신:", senderName, emojiId);
  displayReceivedEmoji(senderId, senderName, emojiId);
});

// 결과 화면 이모티콘 수신
socket.on("result:emojiReceived", ({ senderName, emojiType }) => {
  console.log("🎉 결과 이모티콘 수신:", senderName, emojiType);
  displayResultEmoji(senderName, emojiType);
});

// 문장 좋아요 업데이트
socket.on("sentence:likeUpdated", ({ chainIndex, entryIndex, likeCount, totalPlayers, likedBy }) => {
  // 해당 문장의 좋아요 버튼 찾기
  const likeBtn = document.querySelector(`button.like-btn[data-chain-index="${chainIndex}"][data-entry-index="${entryIndex}"]`);
  if (!likeBtn) return;

  // 좋아요 수 업데이트
  const likeCountSpan = likeBtn.querySelector(".like-count");
  if (likeCountSpan) {
    likeCountSpan.textContent = likeCount;
  }

  // 내가 좋아요 했는지 확인
  const iLiked = likedBy.includes(socket.id);
  if (iLiked) {
    likeBtn.style.background = "rgba(255, 100, 100, 0.3)";
    likeBtn.style.borderColor = "rgba(255, 100, 100, 0.6)";
  } else {
    likeBtn.style.background = "rgba(255,255,255,0.1)";
    likeBtn.style.borderColor = "rgba(255,255,255,0.3)";
  }

  // 과반수 이상 좋아요 시 폭죽 효과
  if (likeCount > totalPlayers / 2) {
    // 이전에 폭죽을 표시하지 않았으면 표시
    const bubbleDiv = likeBtn.previousElementSibling;
    if (bubbleDiv && !bubbleDiv.classList.contains("fireworks-shown")) {
      bubbleDiv.classList.add("fireworks-shown");
      showFireworks(bubbleDiv);
    }
  }
});

// ---- Button handlers ----

// 닉네임 입력 제한 (입력 이벤트에서 실시간 체크)
nicknameInput?.addEventListener("input", (e) => {
  const val = e.target.value;
  let len = 0;
  let newStr = "";
  
  for (let i = 0; i < val.length; i++) {
    const char = val[i];
    const weight = (char.charCodeAt(0) > 127) ? 2 : 1;
    if (len + weight > 16) break;
    len += weight;
    newStr += char;
  }
  
  if (val !== newStr) {
    e.target.value = newStr;
  }
});

// 키워드 입력란 변화 감지: 작성 중 상태 전송
let isWritingPrompts = false;
let writingPromptsTimeout = null;

document.querySelectorAll(".input-prompt").forEach(input => {
  input.addEventListener("input", () => {
    // 작성 중 상태 전송
    if (!isWritingPrompts) {
      isWritingPrompts = true;
      socket.emit("prompt:writing", { writing: true });
    }

    // 2초간 입력 없으면 작성 중 해제
    if (writingPromptsTimeout) clearTimeout(writingPromptsTimeout);
    writingPromptsTimeout = setTimeout(() => {
      if (isWritingPrompts) {
        isWritingPrompts = false;
        socket.emit("prompt:writing", { writing: false });
      }
    }, 2000);
  });
});

// 스토리 입력란 변화 감지: 제시어 사용 현황 UI 갱신 + 작성 중 상태 전송 + Auto Save
inputStoryText?.addEventListener("input", () => {
  updatePromptUsageUI();
  const currentText = inputStoryText.value;

  // 작성 중 상태 전송 (텍스트 포함 - Auto Save)
  if (!isWriting) {
    isWriting = true;
    socket.emit("story:writing", { writing: true, text: currentText });
  } else {
    // 이미 작성 중 상태여도 텍스트 갱신을 위해 주기적으로 보낼 수도 있지만
    // 트래픽 과부하 방지를 위해 디바운스 처리된 타임아웃에서 최종 전송하거나
    // 중요: 여기서는 간단히 타임아웃 갱신 시점에 'false' 보내기 직전에 한번 더 'true'와 텍스트를 보내는게 좋을수도.
    // 하지만 단순하게 매번 보내는 건 너무 많음.
    // -> 서버에서 'writing' 이벤트에 text를 받도록 수정했으므로,
    //    디바운스 타임아웃 리셋.
  }

  // 1초간 입력 없으면 작성 중 해제 (서버에 최신본 저장)
  if (writingTimeout) clearTimeout(writingTimeout);
  writingTimeout = setTimeout(() => {
    if (isWriting) {
      isWriting = false;
      // 마지막으로 최신 텍스트와 함께 writing: false 전송 (혹은 true 유지하면서 텍스트만 갱신?)
      // writing: false로 보내면 '...' 표시가 사라짐.
      // Auto-save 목적이라면 writing: true 상태로 text만 보내는게 좋지만,
      // 여기서는 "입력을 멈춤" = "생각중" 으로 간주하여 false를 보냄.
      socket.emit("story:writing", { writing: false, text: inputStoryText.value });
    }
  }, 1000);
});


// 방 만들기: 닉네임 확인 후 바로 생성
btnCreateRoom?.addEventListener("click", () => {
  if (!ensureName()) return;

  socket.emit("room:create", { name: myName, avatar: myAvatar }, (res) => {
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

  socket.emit("room:join", { roomId, name: myName, avatar: myAvatar }, (res) => {
    if (!res?.ok) return alertError(`방 입장 실패: ${res?.error || "UNKNOWN"}`);
    if (res.state) {
      currentRoomState = res.state;
      goByPhase(res.state);
    }
  });
});

btnLeave?.addEventListener("click", () => {
  // TTS 중지
  cancelTTS();

  socket.emit("room:leave", {}, (res) => {
    if (!res?.ok) return alertError(`나가기 실패: ${res?.error || "UNKNOWN"}`);

    if (displayRoomCode) displayRoomCode.textContent = "#----";
    if (playerList) playerList.innerHTML = "";
    if (roomCodeInput) roomCodeInput.value = "";

    showScreen(screenName);
  });
});

// 게임 시작
btnStart?.addEventListener("click", () => {
  socket.emit("game:start", {}, (res) => {
    if (!res?.ok) return alertError(`시작 실패: ${res?.error || "UNKNOWN"}`);
  });
});

// 방 코드 복사 (방 코드 컨테이너 클릭 시)
roomCodeDisplay?.addEventListener("click", async () => {
  const roomId = currentRoomState?.roomId;
  if (!roomId) return alertError("복사할 방 코드가 없어!");

  const text = String(roomId);

  try {
    await navigator.clipboard.writeText(text);
    alert(`방 코드 복사됨: ${text}`);
  } catch (e) {
    // fallback (권한/https 이슈 대비)
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);

    alert(`방 코드 복사됨: ${text}`);
  }
});

// 제시어 제출
btnSubmitPrompts?.addEventListener("click", () => {
  const inputs = Array.from(document.querySelectorAll(".input-prompt"));
  const prompts = inputs.map((el) => {
    const v = String(el.value || "").trim();
    if (v) return v;
    // 못 적은 경우: placeholder(예시)로 자동 채움
    return String(el.placeholder || "").trim();
  });
 
  // 안전장치: placeholder도 비어있으면 에러
  if (prompts.some((p) => !p)) return alertError("제시어 3개를 모두 입력해줘!");

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

    // 제출 성공 시 textarea 비활성화 (수정 불가)
    if (inputStoryText) {
      inputStoryText.disabled = true;
      inputStoryText.style.opacity = "0.6";
      inputStoryText.style.cursor = "not-allowed";
    }
  });
});

// 결과 화면 버튼 핸들러
btnNextStory?.addEventListener("click", () => {
  goNextStory();
});

btnPrev?.addEventListener("click", () => {
  goPrevStory();
});

// 키보드 네비게이션 (결과 화면에서, 방장만)
document.addEventListener("keydown", (e) => {
  if (screenResults?.classList.contains("hidden")) return;
  if (!isResultHost()) return; // 방장만 키보드 조작 가능

  if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
    e.preventDefault();
    goNextStory();
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    goPrevStory();
  }
});

// 다시하기 버튼 (방장만)
btnRestart?.addEventListener("click", () => {
  if (!isResultHost()) return;

  socket.emit("game:restart", {}, (res) => {
    if (!res?.ok) return alertError(`다시하기 실패: ${res?.error || "UNKNOWN"}`);
  });
});

// 모든 계산된 스타일을 인라인으로 복사하는 헬퍼 함수
function cloneWithStyles(element) {
  const clone = element.cloneNode(false);
  const computedStyle = window.getComputedStyle(element);

  // 모든 스타일 속성을 인라인으로 복사
  for (let i = 0; i < computedStyle.length; i++) {
    const prop = computedStyle[i];
    clone.style[prop] = computedStyle.getPropertyValue(prop);
  }

  // 자식 요소들도 재귀적으로 복사
  for (const child of element.children) {
    clone.appendChild(cloneWithStyles(child));
  }

  // 텍스트 노드 복사
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      clone.appendChild(node.cloneNode(false));
    }
  }

  return clone;
}

// 스크린샷 저장 (SVG foreignObject + Canvas 방식)
async function captureAndDownloadScreenshot() {
  const captureContainer = document.querySelector(".results-container");
  if (!captureContainer) {
    alertError("캡처할 대상을 찾을 수 없습니다.");
    return;
  }

  const controlsDiv = document.querySelector(".results-controls");
  const restartBtn = document.getElementById("btn-restart");

  try {
    // 캡처에 불필요한 UI 숨기기
    if (controlsDiv) controlsDiv.style.visibility = "hidden";
    if (restartBtn) restartBtn.style.visibility = "hidden";

    // 폰트가 로드되기를 기다립니다.
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    // 컨테이너의 크기 가져오기
    const rect = captureContainer.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);

    // 모든 스타일이 인라인으로 복사된 클론 생성
    const clone = cloneWithStyles(captureContainer);

    // CSS 텍스트 수집
    let cssText = "";
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules || []) {
          cssText += rule.cssText + "\n";
        }
      } catch (e) {
        // CORS 제약으로 접근할 수 없는 스타일시트는 무시
        console.warn("Cannot access stylesheet:", e);
      }
    }

    // SVG 생성 (스타일 포함)
    const serializer = new XMLSerializer();
    const cloneHTML = serializer.serializeToString(clone);

    const svgData = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <defs>
          <style type="text/css">
            <![CDATA[
              ${cssText}
            ]]>
          </style>
        </defs>
        <foreignObject x="0" y="0" width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="width: ${width}px; height: ${height}px; overflow: hidden;">
            ${cloneHTML}
          </div>
        </foreignObject>
      </svg>
    `;

    // Canvas에 렌더링
    const canvas = document.createElement("canvas");
    const scale = window.devicePixelRatio || 2;
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, width, height);

    // SVG를 이미지로 변환
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();

    img.onload = function() {
      ctx.drawImage(img, 0, 0, width, height);

      // 이미지 다운로드
      canvas.toBlob(function(blob) {
        if (!blob) {
          alertError("이미지 생성에 실패했습니다.");
          return;
        }

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        const fileName = `story_${(storyTitle?.textContent || "story").replace(/\s+/g, "_")}_${Date.now()}.png`;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // 정리
        URL.revokeObjectURL(url);
        URL.revokeObjectURL(link.href);

        alert("이미지가 성공적으로 저장되었습니다!");

        // UI 복원
        if (controlsDiv) controlsDiv.style.visibility = "visible";
        if (restartBtn) restartBtn.style.visibility = "visible";
      }, "image/png");
    };

    img.onerror = function(error) {
      console.error("이미지 로드 중 오류 발생:", error);
      URL.revokeObjectURL(url);
      alertError("이미지 저장에 실패했습니다. 다시 시도해 주세요.");

      // UI 복원
      if (controlsDiv) controlsDiv.style.visibility = "visible";
      if (restartBtn) restartBtn.style.visibility = "visible";
    };

    img.src = url;

  } catch (error) {
    console.error("스크린샷 캡처 중 오류 발생:", error);
    alertError("이미지 저장에 실패했습니다. 다시 시도해 주세요.");

    // UI 복원
    if (controlsDiv) controlsDiv.style.visibility = "visible";
    if (restartBtn) restartBtn.style.visibility = "visible";
  }
}

btnScreenshot?.addEventListener("click", () => {
  captureAndDownloadScreenshot();
});

// ---- 이모티콘 버튼 이벤트 ----
btnEmojiToggle?.addEventListener("click", () => {
  toggleEmojiPicker();
});

// 바깥 클릭 시 이모티콘 선택창 닫기
document.addEventListener("click", (e) => {
  if (!emojiPicker || emojiPicker.classList.contains("hidden")) return;
  if (!e.target.closest(".emoji-section")) {
    toggleEmojiPicker(false);
  }
});

// ---- 결과 화면 이모티콘 버튼 핸들러 ----
btnResultThumbsup?.addEventListener("click", () => {
  sendResultEmoji("thumbsup");
});

btnResultClap?.addEventListener("click", () => {
  sendResultEmoji("clap");
});

// ---- BGM 초기화 ----
if (bgm) {
  bgm.volume = 0.3;
}

// 첫 상호작용 후 BGM 재생
let bgmStarted = false;
function startBGM() {
  if (bgmStarted || !bgm) return;
  bgmStarted = true;
  bgm.play().catch((e) => {
    console.warn("BGM 자동 재생 실패:", e);
  });
}

// 모든 클릭/터치 이벤트에서 BGM 시작 시도
document.addEventListener("click", startBGM, { once: false });
document.addEventListener("touchstart", startBGM, { once: false });
document.addEventListener("keydown", startBGM, { once: false });

// ---- 초기화 ----
renderEmojiList();
renderAvatarList();

// ---- 초기 화면 ----
showScreen(screenName);
