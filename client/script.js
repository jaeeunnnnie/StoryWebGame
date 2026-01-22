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

// BGM
const bgmAudio = $("bgm-audio");
const btnBgm = $("btn-bgm");
let bgmPlaying = false;

// BGM 컨트롤
function initBGM() {
  if (bgmAudio) {
    bgmAudio.volume = 0.3; // 기본 볼륨 30%
  }
}

function toggleBGM() {
  if (!bgmAudio) return;

  if (bgmPlaying) {
    bgmAudio.pause();
    bgmPlaying = false;
    if (btnBgm) btnBgm.textContent = "🔇";
  } else {
    bgmAudio.play().catch(e => console.log("BGM 재생 실패:", e));
    bgmPlaying = true;
    if (btnBgm) btnBgm.textContent = "🔊";
  }
}

// BGM 버튼 이벤트
btnBgm?.addEventListener("click", toggleBGM);

// 첫 사용자 인터랙션 시 BGM 자동 재생 시도
document.addEventListener("click", function autoPlayBGM() {
  if (!bgmPlaying && bgmAudio) {
    bgmAudio.play().then(() => {
      bgmPlaying = true;
      if (btnBgm) btnBgm.textContent = "🔊";
    }).catch(e => console.log("BGM 자동재생 실패:", e));
  }
  document.removeEventListener("click", autoPlayBGM);
}, { once: true });

initBGM();


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

// player sidebar (양쪽 플레이어 사이드바)
const playersLeft = $("players-left");
const playersRight = $("players-right");

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
let currentUtterance = null; // 현재 재생 중인 TTS

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
    div.className = "participant-item";
    const isHost = p.id === hostId;

    // 아바타
    const avatarDiv = document.createElement("div");
    avatarDiv.className = "participant-avatar";
    const avatarData = getAvatarById(p.avatar);
    if (avatarData) {
      if (avatarData.type === "image") {
        avatarDiv.innerHTML = `<img src="${avatarData.content}" alt="${p.name}">`;
      } else {
        avatarDiv.textContent = avatarData.content;
      }
    } else {
      avatarDiv.textContent = "👤";
    }

    // 이름
    const nameSpan = document.createElement("span");
    nameSpan.className = "participant-name";
    nameSpan.textContent = p.name;

    div.appendChild(avatarDiv);
    div.appendChild(nameSpan);

    // 방장 왕관
    if (isHost) {
      const crownImg = document.createElement("img");
      crownImg.className = "participant-crown";
      crownImg.src = "./image/02_로비/방장왕관.png";
      crownImg.alt = "방장";
      div.appendChild(crownImg);
    }

    playerList.appendChild(div);
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
    const playerDiv = createSidebarPlayer(p, writingStatus);

    if (index < leftCount) {
      playersLeft.appendChild(playerDiv);
    } else {
      playersRight.appendChild(playerDiv);
    }
  });
}

// 사이드바 플레이어 요소 생성
function createSidebarPlayer(player, writingStatus) {
  const isDone = player.submitted?.story === true;
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

  // 상태 (이미지로 표시)
  const statusImg = document.createElement("img");
  statusImg.className = "status-img";
  if (isDone) {
    statusImg.src = "./image/03_키워드 적기/작성완료.png";
    statusImg.alt = "작성완료";
  } else if (isWritingNow) {
    statusImg.src = "./image/03_키워드 적기/작성중.png";
    statusImg.alt = "작성중";
  } else {
    statusImg.src = "./image/03_키워드 적기/생각중.png";
    statusImg.alt = "생각중";
  }

  div.appendChild(avatarDiv);
  div.appendChild(nameDiv);
  div.appendChild(statusImg);

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
      emojiPickerDiv.classList.toggle("hidden");
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

      const statusImg = playerDiv.querySelector(".status-img");
      if (statusImg) {
        if (isDone) {
          statusImg.src = "./image/03_키워드 적기/작성완료.png";
          statusImg.alt = "작성완료";
        } else if (isWritingNow) {
          statusImg.src = "./image/03_키워드 적기/작성중.png";
          statusImg.alt = "작성중";
        } else {
          statusImg.src = "./image/03_키워드 적기/생각중.png";
          statusImg.alt = "생각중";
        }
      }
    }
  });
}

// ---- 아바타 관련 ----
// 아바타 목록 (나중에 커스텀 이미지로 교체 가능)
// type: "emoji" = 기본 이모지, "image" = 커스텀 이미지 (경로)
const AVATAR_LIST = [
  { id: "avatar1", type: "emoji", content: "😊" },
  { id: "avatar2", type: "emoji", content: "😎" },
  { id: "avatar3", type: "emoji", content: "🤓" },
  { id: "avatar4", type: "emoji", content: "😈" },
  { id: "avatar5", type: "emoji", content: "🐱" },
  { id: "avatar6", type: "emoji", content: "🐶" },
  { id: "avatar7", type: "emoji", content: "🦊" },
  { id: "avatar8", type: "emoji", content: "🐸" },
  // 커스텀 이미지 예시 (나중에 추가):
  // { id: "custom_avatar1", type: "image", content: "/images/avatars/avatar1.png" },
  // { id: "custom_avatar2", type: "image", content: "/images/avatars/avatar2.png" },
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
  // 커스텀 이미지 예시 (나중에 추가):
  // { id: "custom1", type: "image", content: "/images/emoji/custom1.png" },
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
      // 이모티콘 전송해도 창 닫지 않음
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
      // 이모티콘 전송해도 창 닫지 않음
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

// 받은 이모티콘 표시 (플레이어 아바타 옆에 표시)
function displayReceivedEmoji(senderId, senderName, emojiId) {
  const emoji = EMOJI_LIST.find(e => e.id === emojiId);
  if (!emoji) return;

  // 사이드바에서 해당 플레이어 찾기
  const playerDiv = playersLeft?.querySelector(`[data-player-id="${senderId}"]`) ||
                    playersRight?.querySelector(`[data-player-id="${senderId}"]`);

  if (playerDiv) {
    // 플레이어 아바타 옆에 이모티콘 표시
    const emojiEl = document.createElement("div");
    emojiEl.className = "player-emoji";

    if (emoji.type === "image") {
      emojiEl.innerHTML = `<img src="${emoji.content}" alt="${emojiId}">`;
    } else {
      emojiEl.textContent = emoji.content;
    }

    playerDiv.appendChild(emojiEl);

    // 2.5초 후 제거 (애니메이션 완료 후)
    setTimeout(() => {
      emojiEl.remove();
    }, 2500);
  } else {
    // 사이드바에 플레이어가 없으면 기존 방식으로 표시
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

// ---- TTS 함수 ----
function stopTTS() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  currentUtterance = null;
}

// 한국어 음성 찾기 (캐싱)
let cachedKoreanVoice = null;
function getKoreanVoice() {
  if (cachedKoreanVoice) return cachedKoreanVoice;
  
  try {
    const voices = window.speechSynthesis?.getVoices() || [];
    const koreanVoice = voices.find(v => v.lang.startsWith("ko"));
    if (koreanVoice) {
      cachedKoreanVoice = koreanVoice;
      return koreanVoice;
    }
  } catch (e) {
    console.error("음성 로드 중 오류:", e);
  }
  return null;
}

function speakText(text, onEndCallback) {
  if (!ttsEnabled || !text) {
    // TTS 비활성화 또는 텍스트 없으면 바로 콜백 호출
    if (onEndCallback) onEndCallback();
    return;
  }
  if (!window.speechSynthesis) {
    console.warn("이 브라우저는 TTS를 지원하지 않습니다.");
    if (onEndCallback) onEndCallback();
    return;
  }

  // 이전 TTS 중지
  stopTTS();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ko-KR";
  utterance.rate = 1.0;  // 속도 (0.1 ~ 10)
  utterance.pitch = 1.0; // 피치 (0 ~ 2)
  utterance.volume = 1.0; // 볼륨 (0 ~ 1)

  // 한국어 음성 설정
  const koreanVoice = getKoreanVoice();
  if (koreanVoice) {
    utterance.voice = koreanVoice;
  }

  // TTS 완료 시 콜백 호출
  if (onEndCallback) {
    utterance.onend = () => {
      onEndCallback();
    };
    utterance.onerror = () => {
      onEndCallback();
    };
  }

  currentUtterance = utterance;
  try {
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.error("TTS 재생 중 오류:", e);
    if (onEndCallback) onEndCallback();
  }
}

// 음성 목록 로드 (일부 브라우저에서 필요)
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    // 캐시 초기화하여 다시 로드되도록
    cachedKoreanVoice = null;
    getKoreanVoice();
  };
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
  stopTTS();
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
  stopTTS();
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

  contentDiv.appendChild(writerDiv);
  contentDiv.appendChild(bubbleDiv);

  messageDiv.appendChild(avatarDiv);
  messageDiv.appendChild(contentDiv);

  if (chatContainer) {
    chatContainer.appendChild(messageDiv);
    // 스크롤 맨 아래로
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  displayedEntryCount = index + 1;

  // TTS로 읽기 - 완료 후 다음 메시지로 넘어감
  try {
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
  } catch (e) {
    console.error("TTS 재생 중 오류:", e);
    // 에러 시에도 다음으로 진행
    chatAnimationTimer = setTimeout(() => {
      if (isLastEntry) {
        updateResultButtons(false);
      } else {
        showNextChatMessage(entries, index + 1);
      }
    }, 2000);
  }
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

  // 방장만 시작 버튼 보이기
  if (btnStart) {
    btnStart.classList.toggle("hidden", !isHost);
    btnStart.disabled = !isHost;
    // 시작 버튼 이미지 변경
    const startBtnImg = $("start-btn-img");
    if (startBtnImg) {
      startBtnImg.src = isHost
        ? "./image/02_로비/시작하기 버튼_활성화.png"
        : "./image/02_로비/시작하기 버튼.png";
    }
  }

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
  console.log("✅ Socket 연결됨:", socket.id);
});

socket.on("disconnect", () => {
  console.log("❌ Socket 연결 끊김");
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

  // 입력란 초기화
  if (inputStoryText) inputStoryText.value = "";
  // 제시어 사용 현황 UI 갱신
  updatePromptUsageUI();

  // 버튼/메시지 초기화
  if (btnSubmitStory) {
    btnSubmitStory.disabled = false;
    btnSubmitStory.classList.remove("submitted"); // 제출 버튼 다시 보이기
  }
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

socket.on("story:timer", ({ secondsLeft }) => {
  if (displayTimer) {
    displayTimer.textContent = `${secondsLeft}s`;
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

  // 확인 버튼 이미지 초기화
  const confirmBtnImg = $("confirm-btn-img");
  if (confirmBtnImg) {
    confirmBtnImg.src = "./image/03_키워드 적기/확인.png";
  }

  showScreen(screenLobby);
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

// ---- Button handlers ----

// (옵션) Next 버튼: 닉네임 저장하고 join 화면으로 이동
//btnNext?.addEventListener("click", () => {
 // if (!ensureName()) return;
 // showScreen(screenWaiting);
 // setTimeout(() => roomCodeInput?.focus(), 0);
//});

// 스토리 입력란 변화 감지: 제시어 사용 현황 UI 갱신 + 작성 중 상태 전송
inputStoryText?.addEventListener("input", () => {
  updatePromptUsageUI();

  // 작성 중 상태 전송
  if (!isWriting) {
    isWriting = true;
    socket.emit("story:writing", { writing: true });
  }

  // 2초간 입력 없으면 작성 중 해제
  if (writingTimeout) clearTimeout(writingTimeout);
  writingTimeout = setTimeout(() => {
    if (isWriting) {
      isWriting = false;
      socket.emit("story:writing", { writing: false });
    }
  }, 2000);
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

// 방 코드 복사
btnCopy?.addEventListener("click", async () => {
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

  // 확인 버튼 이미지를 확인_완료로 변경
  const confirmBtnImg = $("confirm-btn-img");
  if (confirmBtnImg) {
    confirmBtnImg.src = "./image/03_키워드 적기/확인_완료.png";
  }

  socket.emit("prompt:submit", { prompts }, (res) => {
    if (!res?.ok) {
      btnSubmitPrompts.disabled = false;
      if (waitMsg) waitMsg.classList.add("hidden");
      // 실패 시 이미지 원복
      if (confirmBtnImg) {
        confirmBtnImg.src = "./image/03_키워드 적기/확인.png";
      }
      return alertError(`제시어 제출 실패: ${res?.error || "UNKNOWN"}`);
    }
  });
});

btnSubmitStory?.addEventListener("click", () => {
  const text = String(inputStoryText?.value || "").trim();
  if (!text) return alertError("문장을 입력해줘!");

  btnSubmitStory.disabled = true;
  btnSubmitStory.classList.add("submitted"); // 제출 버튼 숨기기
  if (storyWaitMsg) storyWaitMsg.classList.remove("hidden");

  socket.emit("story:submit", { text }, (res) => {
    if (!res?.ok) {
      btnSubmitStory.disabled = false;
      btnSubmitStory.classList.remove("submitted"); // 실패 시 다시 보이기
      if (storyWaitMsg) storyWaitMsg.classList.add("hidden");
      return alertError(`제출 실패: ${res?.error || "UNKNOWN"}`);
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

// 스크린샷 저장 (보이는 화면 그대로)
async function captureAndDownloadScreenshot() {
  const captureContainer = document.querySelector(".results-container");
  if (!captureContainer) {
    alertError("캡처할 대상을 찾을 수 없습니다.");
    return;
  }

  // html2canvas 로드 확인
  if (typeof html2canvas === "undefined") {
    alertError("스크린샷 라이브러리가 로드되지 않았습니다. 잠시 후 다시 시도해주세요.");
    console.error("html2canvas is not loaded");
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

    // 캔버스 캡처 실행
    const canvas = await html2canvas(captureContainer, {
      scale: window.devicePixelRatio || 2, // 기기 해상도에 맞춰 선명도 높이기
      backgroundColor: "#1e293b", // 페이지 배경색과 동일하게 지정
      useCORS: true,
      allowTaint: false, // 보안 및 안정성을 위해 false로 설정
      removeContainer: false, // 실험적 기능 비활성화
    });

    // 이미지 다운로드 링크 생성 및 클릭
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    const fileName = `story_${storyTitle?.textContent || "story"}_${Date.now()}.png`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert("이미지가 성공적으로 저장되었습니다!");

  } catch (error) {
    console.error("스크린샷 캡처 중 오류 발생:", error);
    alertError("이미지 저장에 실패했습니다. 다시 시도해 주세요.");
  } finally {
    // 숨겼던 UI 다시 표시 (성공/실패 여부와 관계없이 실행)
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

// ---- 초기화 ----
renderEmojiList();
renderAvatarList();

// ---- 초기 화면 ----
showScreen(screenName);
