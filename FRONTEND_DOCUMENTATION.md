# StoryWebGame - 프론트엔드 문서

## 📋 목차
1. [프로젝트 개요](#프로젝트-개요)
2. [파일 구조](#파일-구조)
3. [화면 구성](#화면-구성)
4. [주요 컴포넌트](#주요-컴포넌트)
5. [CSS 아키텍처](#css-아키텍처)
6. [JavaScript 구조](#javascript-구조)
7. [이미지 에셋](#이미지-에셋)

---

## 프로젝트 개요

**내 친구의 사생활** - 멀티플레이어 스토리 작성 게임

- **기술 스택**: HTML5, CSS3, Vanilla JavaScript, Socket.IO
- **디자인 컨셉**: 공책/노트 스타일의 아날로그 감성
- **플레이어 수**: 최대 8명
- **게임 방식**: 키워드 작성 → 스토리 릴레이 → 결과 공유

---

## 파일 구조

```
client/
├── index.html          # 메인 HTML (단일 페이지 앱)
├── style.css           # 통합 스타일시트
├── script.js           # 클라이언트 로직 및 Socket.IO 통신
└── image/              # 이미지 에셋 폴더
    ├── 00_전체/        # 로고, 배경 등 공통 이미지
    ├── 01_메인화면/    # 입장 화면 이미지
    ├── 02_로비/        # 대기실 이미지
    ├── 03_키워드 적기/ # 키워드 입력 화면 이미지
    ├── 04_스토리 적기/ # 스토리 작성 화면 이미지
    └── 05_엔딩/        # 결과 화면 이미지
```

---

## 화면 구성

### 1. 입장 화면 (`#screen-name`)
**목적**: 닉네임 입력 및 아바타 선택

**주요 요소**:
- **공책 배경**: `01_메인화면/공책.png` (900x600px)
- **왼쪽 페이지**:
  - 아바타 선택 그리드 (4x2, 8개 아바타)
  - 아바타 미리보기 (80x80px 원형)
  - 닉네임 입력 (견출지 배경 위)
- **오른쪽 페이지**:
  - 게임 호스트 버튼 (노란색 포스트잇)
  - 게임 입장 버튼 (분홍색 포스트잇)
- **장식 요소**: 볼펜, 클립, 형광펜

**CSS 클래스**:
```css
.entry-container       /* 공책 컨테이너 */
.entry-left           /* 왼쪽 영역 */
.entry-right          /* 오른쪽 영역 */
.avatar-list          /* 아바타 그리드 */
.nickname-label-wrapper /* 닉네임 입력 */
```

---

### 2. 대기실 화면 (`#screen-lobby`)
**목적**: 플레이어 대기 및 게임 시작

**주요 요소**:
- **공책 배경**: `02_로비/공책.png`
- **왼쪽 페이지**:
  - 대기실 태그 (위치: 100px, 10px)
  - 참가자 목록 (아바타 + 닉네임 + 방장 왕관)
  - 구분선 이미지
- **오른쪽 페이지**:
  - 시작하기 버튼 (방장만 표시)
  - 방 코드 표시 (호버 시 복사하기로 전환)
  - 대기 메시지

**CSS 클래스**:
```css
.lobby-container      /* 공책 컨테이너 */
.lobby-left          /* 왼쪽 영역 */
.lobby-right         /* 오른쪽 영역 */
.player-list-vertical /* 플레이어 목록 */
.player-row          /* 개별 플레이어 */
.room-code-wrapper   /* 방 코드 */
```

---

### 3. 키워드 적기 화면 (`#screen-prompts`)
**목적**: 3개의 키워드 카드 작성

**레이아웃**:
- **사이드바 + 공책 + 사이드바** (flex layout)
- **공책 배경**: `03_키워드 적기/공책.png` (900x600px)

**주요 요소**:
- **제목**: "3개의 카드를 만들어주세요" (공책 중앙 상단 30%)
- **타이머**: 우측 상단 (80px, 140px), italic, #1e293b
- **카드 3개**: 
  - 이미지: 카드1.png, 카드2.png, 카드3.png (180px)
  - 입력창: 카드 이미지 위에 절대 위치 (top: 45%)
  - 투명 배경, dashed 밑줄
- **확인 버튼**: 하단 80px
- **대기 메시지**: absolute, bottom 20px

**CSS 클래스**:
```css
.prompts-layout       /* 전체 레이아웃 (flex) */
.prompts-main        /* 중앙 영역 */
.note-background     /* 공책 배경 (공통) */
.keyword-cards-wrapper /* 카드 컨테이너 */
.keyword-card        /* 개별 카드 */
```

---

### 4. 스토리 적기 화면 (`#screen-story`)
**목적**: 키워드를 사용해 스토리 작성

**레이아웃**:
- **사이드바 + 공책 + 사이드바** (동일 구조)
- **공책 배경**: `04_스토리 적기/공책.png` (900x600px)

**공책 내부 구조** (3단 레이아웃):

1. **헤더** (`.notebook-header`):
   - 라운드 정보 (좌상단): "1 / 12"
   - 타이머 (우상단): "30s", italic, #1e293b

2. **바디** (`.notebook-body`):
   - 이전 문장 (`.story-so-far-text`): 2rem, #1e293b, 중앙 정렬
   - 키워드 카드 3개 (`.sticky-note-container`):
     - 실제 카드 이미지 사용 (160x160px)
     - 텍스트 오버레이 (absolute, 중앙)
     - 사용된 카드: 취소선
     - 회전 효과: -2deg, 1deg, 3deg
     - 호버: scale(1.05) + rotate(0deg)

3. **푸터** (`.notebook-footer`):
   - 입력란 이미지 배경
   - Textarea (투명, 절대 위치)
   - 제출 버튼 (종이비행기, 왼쪽 -20px, 아래 5px)

**CSS 클래스**:
```css
.story-layout        /* 전체 레이아웃 */
.story-main         /* 중앙 영역 */
.notebook-panel     /* 공책 배경 (공통) */
.notebook-header    /* 헤더 */
.notebook-body      /* 바디 */
.notebook-footer    /* 푸터 */
.sticky-note-container /* 키워드 카드 컨테이너 */
.story-keyword-card /* 개별 키워드 카드 */
.input-area-wrapper /* 입력 영역 */
```

---

### 5. 결과 화면 (`#screen-results`)
**목적**: 완성된 스토리 감상

**레이아웃**:
- **채팅 스타일** 메시지 표시
- **공책 배경**: `05_엔딩/공책.png` (chat-container)

**주요 요소**:
- **스토리 제목**: 노란색 배지
- **진행 상황**: "문장 1 / 12"
- **채팅 컨테이너**:
  - 아바타 (40x40px 원형)
  - 작성자명 (파란색)
  - 말풍선 (흰색 배경, 좌상단 뾰족)
  - 제시어 하이라이트 (노란색, 밑줄)
- **사이드 컨트롤**:
  - 이전/다음 버튼
  - 저장 버튼
  - 다시하기 버튼

**CSS 클래스**:
```css
.results-wrapper     /* 전체 래퍼 */
.results-container   /* 메인 컨테이너 */
.chat-container     /* 채팅 영역 */
.chat-message       /* 개별 메시지 */
.chat-bubble        /* 말풍선 */
.results-side-controls /* 사이드 버튼 */
```

---

## 주요 컴포넌트

### 플레이어 사이드바 (`.player-sidebar`)
**위치**: 게임 화면 좌우
**기능**: 플레이어 상태 실시간 표시

**구조**:
```html
<div class="sidebar-player writing|done">
  <div class="player-avatar">
    <img src="아바타" />
  </div>
  <div class="player-name">닉네임</div>
  <div class="player-status">작성 중|완료</div>
  <div class="player-emoji">🎉</div>
</div>
```

**상태**:
- **작성 중** (`.writing`):
  - 노란색 테두리 (`#fbbf24`)
  - 펄스 애니메이션
- **완료** (`.done`):
  - 녹색 테두리 (`#34d399`)
  - 정적 표시

**CSS 클래스**:
```css
.player-sidebar         /* 사이드바 컨테이너 */
.player-sidebar-left    /* 왼쪽 정렬 */
.player-sidebar-right   /* 오른쪽 정렬 */
.sidebar-player        /* 개별 플레이어 카드 */
.sidebar-player.writing /* 작성 중 상태 */
.sidebar-player.done   /* 완료 상태 */
```

---

### 이모티콘 시스템

#### 1. 사이드바 이모티콘
**위치**: 플레이어 카드 옆
**애니메이션**: 위로 떠오름 (2.5초)

```css
@keyframes emojiPopSide {
  0%   { opacity: 0; transform: scale(0.3) translateY(10px); }
  15%  { opacity: 1; transform: scale(1.2) translateY(0); }
  100% { opacity: 0; transform: translateY(-50px); }
}
```

#### 2. 결과 화면 이모티콘
**위치**: 화면 전체 오버레이
**애니메이션**: 랜덤 위치에서 상승 (3초)

```css
@keyframes resultEmojiRise {
  0%   { opacity: 0; transform: translateY(0) scale(0.5); }
  10%  { opacity: 1; transform: translateY(-30px) scale(1.2); }
  100% { opacity: 0; transform: translateY(-400px) scale(0.8); }
}
```

---

### 설정 메뉴 (`.menu-panel`)
**위치**: 왼쪽 슬라이드 패널
**토글 버튼**: 좌상단 (20px, 20px)

**기능**:
- BGM 볼륨 조절 (슬라이더)
- BGM ON/OFF 토글

**애니메이션**:
- 패널: `transform: translateX(-100%)` → `translateX(0)`
- 오버레이: `opacity: 0` → `opacity: 1`

---

## CSS 아키텍처

### 변수 시스템
```css
:root {
  --bg-color: #1e293b;        /* 다크 배경 */
  --card-bg: #334155;         /* 카드 배경 */
  --accent-yellow: #f59e0b;   /* 강조 노란색 */
  --accent-blue: #3b82f6;     /* 강조 파란색 */
  --text-white: #f8fafc;      /* 텍스트 */
}
```

### 공통 스타일

#### 공책 배경 (공통)
```css
.notebook-panel,
.note-background {
  position: relative;
  width: 900px;
  aspect-ratio: 900 / 600;
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  padding: 80px 100px;
  box-sizing: border-box;
  display: flex;
}
```

#### 레이아웃 (공통)
```css
.prompts-layout,
.story-layout {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  gap: 20px;
  width: 100%;
  max-width: 1200px;
}

.prompts-main,
.story-main {
  flex: 1;
  display: flex;
  justify-content: center;
  position: relative;
}
```

---

### 버튼 스타일

#### 이미지 버튼
```css
.image-btn {
  background: none !important;
  border: none !important;
  padding: 0 !important;
  cursor: pointer;
  transition: transform 0.15s;
}

.image-btn:hover {
  transform: scale(1.05);
}
```

#### 사이드 버튼 (결과 화면)
```css
.result-side-btn:hover {
  transform: rotate(5deg) scale(1.05);
}
```

---

### 텍스트 말줄임
```css
.story-keyword-text {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
```

---

## JavaScript 구조

### DOM 선택자 헬퍼
```javascript
const $ = (id) => document.getElementById(id);
```

### 주요 변수

#### 화면 요소
```javascript
const screenName = $("screen-name");       // 입장 화면
const screenLobby = $("screen-lobby");     // 대기실
const screenPrompts = $("screen-prompts"); // 키워드 입력
const screenStory = $("screen-story");     // 스토리 작성
const screenResults = $("screen-results"); // 결과
```

#### 플레이어 데이터
```javascript
let mySocketId = null;          // 내 소켓 ID
let myNickname = "";            // 내 닉네임
let myAvatar = "";              // 내 아바타
let myRoomId = null;            // 현재 방 ID
let isHost = false;             // 방장 여부
```

#### 게임 상태
```javascript
let currentRound = 0;           // 현재 라운드
let totalRounds = 0;            // 전체 라운드
let allStories = [];            // 모든 스토리
let currentStoryIndex = 0;      // 현재 보는 스토리 인덱스
```

---

### Socket.IO 이벤트

#### 클라이언트 → 서버
```javascript
socket.emit("room:create", { nickname, avatar });
socket.emit("room:join", { roomId, nickname, avatar });
socket.emit("prompts:submit", { prompts: [...] });
socket.emit("story:submit", { text, usedPrompts: [...] });
socket.emit("emoji:send", { emoji, target });
```

#### 서버 → 클라이언트
```javascript
socket.on("room:created", ({ roomId }) => { ... });
socket.on("room:joined", ({ players, roomId }) => { ... });
socket.on("room:state", (state) => { ... });
socket.on("prompt:timer", ({ secondsLeft }) => { ... });
socket.on("story:timer", ({ secondsLeft }) => { ... });
socket.on("round:start", ({ round, totalRounds }) => { ... });
socket.on("results:ready", ({ stories }) => { ... });
socket.on("emoji:received", ({ emoji, from }) => { ... });
```

---

### 주요 함수

#### 화면 전환
```javascript
function showScreen(screenElement) {
  // 모든 화면 숨기기
  document.querySelectorAll(".screen").forEach(s => {
    s.classList.add("hidden");
  });
  // 선택한 화면만 표시
  screenElement.classList.remove("hidden");
}
```

#### 플레이어 렌더링
```javascript
function renderPlayers(players) {
  // 로비 플레이어 목록 렌더링
  playerList.innerHTML = players.map(p => `
    <div class="player-row">
      <div class="player-info">
        <img src="${p.avatar}" />
        <span>${p.nickname}</span>
        ${p.isHost ? '<img src="왕관.png" />' : ''}
      </div>
    </div>
  `).join("");
}
```

#### 사이드바 업데이트
```javascript
function updateSidebar(players, container) {
  container.innerHTML = players.map(p => `
    <div class="sidebar-player ${p.status}">
      <div class="player-avatar">
        <img src="${p.avatar}" />
      </div>
      <div class="player-name">${p.nickname}</div>
      <div class="player-status">${p.status}</div>
    </div>
  `).join("");
}
```

#### 채팅 메시지 렌더링
```javascript
function renderChatMessage(sentence, writer, avatar) {
  const div = document.createElement("div");
  div.className = "chat-message";
  div.innerHTML = `
    <div class="chat-avatar">
      <img src="${avatar}" />
    </div>
    <div class="chat-content">
      <div class="chat-writer">${writer}</div>
      <div class="chat-bubble">${highlightPrompts(sentence)}</div>
    </div>
  `;
  chatContainer.appendChild(div);
}
```

---

## 이미지 에셋

### 폴더별 이미지 목록

#### 00_전체/
- `배경.png` - 전체 배경 이미지
- `로고.png` - 타이틀 로고 (300px)

#### 01_메인화면/
- `공책.png` - 입장 화면 공책 배경 (900x600px)
- `작은견출지.png` - 닉네임 입력 배경 (172x67px)
- `게임 호스트.png` - 방 만들기 버튼 (200px)
- `게임 입장.png` - 방 입장 버튼 (200px)
- `볼펜.png`, `클립.png`, `형광펜.png` - 장식 요소

#### 02_로비/
- `공책.png` - 대기실 공책 배경
- `대기실.png` - 대기실 태그 (120px)
- `아바타_참가자.png`, `아바타_빈 참가자.png` - 플레이어 아바타 (45x45px)
- `방장왕관.png` - 방장 아이콘 (25px)
- `참가자목록 구분선.png` - 구분선
- `방 코드 복사.png`, `방 코드 복사2.png` - 방 코드 표시/복사 (140px)
- `시작하기 버튼.png` - 시작 버튼 (140px)

#### 03_키워드 적기/
- `공책.png` - 키워드 입력 공책 배경 (900x600px)
- `카드1.png`, `카드2.png`, `카드3.png` - 키워드 카드 (180px)
- `확인.png` - 확인 버튼 (120px)

#### 04_스토리 적기/
- `공책.png` - 스토리 작성 공책 배경 (900x600px)
- `입력란.png` - 입력 밑줄 이미지
- `제출.png` - 제출 버튼 (종이비행기, 50px)

#### 05_엔딩/
- `공책.png` - 결과 화면 공책 배경
- `이전.png`, `다음.png` - 네비게이션 버튼 (140px)
- `다시하기.png` - 재시작 버튼 (160px)
- `저장.png` - 저장 버튼 (120px)

---

## 반응형 고려사항

### 고정 크기
- **공책**: 900x600px (aspect-ratio 유지)
- **레이아웃 최대 너비**: 1200px
- **사이드바**: 최소 120px

### 권장 해상도
- **최소**: 1280x720px
- **권장**: 1920x1080px

---

## 애니메이션 목록

### 페이드 인
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
```

### 채팅 팝업
```css
@keyframes chatPopIn {
  from { opacity: 0; transform: translateY(10px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
```

### 펄스 (작성 중)
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
```

### 깜빡임
```css
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
```

---

## 브라우저 호환성

### 지원 브라우저
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### 주요 기능
- ✅ Flexbox
- ✅ CSS Grid
- ✅ CSS Variables
- ✅ Aspect Ratio
- ✅ WebSocket (Socket.IO)
- ⚠️ `-webkit-line-clamp` (비표준이지만 모든 주요 브라우저 지원)

---

## 성능 최적화

### 이미지
- PNG 포맷 사용
- 적절한 크기로 최적화
- CSS `filter: drop-shadow()` 활용

### CSS
- CSS 변수로 중복 제거
- 공통 클래스 재사용
- 하드웨어 가속 (`transform`, `opacity`)

### JavaScript
- 이벤트 위임
- Debounce/Throttle (필요시)
- DOM 조작 최소화

---

## 유지보수 가이드

### 색상 변경
`style.css` 상단 `:root` 변수 수정

### 공책 크기 변경
`.notebook-panel`, `.note-background` 의 `width` 및 `aspect-ratio` 수정

### 새 화면 추가
1. HTML: `<section id="screen-new" class="screen hidden">`
2. CSS: 필요한 스타일 추가
3. JS: `const screenNew = $("screen-new");`
4. Socket 이벤트 연결

### 새 이미지 추가
1. 적절한 폴더에 이미지 추가
2. HTML에서 경로 지정: `/image/폴더명/파일명.png`
3. CSS background-image (필요시)

---

## 문제 해결

### 이미지가 안 보임
- 경로 확인: `/image/...` (절대 경로)
- 파일명 대소문자 확인
- 브라우저 캐시 삭제 (`Ctrl+Shift+R`)

### 레이아웃 깨짐
- `box-sizing: border-box` 확인
- `aspect-ratio` 브라우저 지원 확인
- Flexbox 속성 검토

### Socket.IO 연결 안 됨
- 서버 실행 확인
- 포트 번호 확인 (3000)
- CORS 설정 확인

---

## 참고 자료

- [Socket.IO 공식 문서](https://socket.io/docs/)
- [MDN Web Docs - CSS](https://developer.mozilla.org/ko/docs/Web/CSS)
- [MDN Web Docs - JavaScript](https://developer.mozilla.org/ko/docs/Web/JavaScript)

---

**최종 업데이트**: 2026-01-26
