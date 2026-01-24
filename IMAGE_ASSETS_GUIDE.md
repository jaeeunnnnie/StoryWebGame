# 이미지 에셋 적용 가이드

이 문서는 StoryWebGame에 적용된 이미지 에셋과 추가로 적용 가능한 항목을 정리한 가이드입니다.

**마지막 업데이트:** 2026-01-25

---

## 목차
1. [적용 완료된 이미지](#1-적용-완료된-이미지)
2. [미적용 이미지 (수동 적용 필요)](#2-미적용-이미지-수동-적용-필요)
3. [이미지 폴더 구조](#3-이미지-폴더-구조)
4. [수정된 파일 목록](#4-수정된-파일-목록)

---

## 1. 적용 완료된 이미지

### 1.1 전체 배경 및 로고
| 항목 | 파일 | 적용 위치 |
|------|------|----------|
| 배경 이미지 | `00_전체/배경.png` | `style.css` body 배경 |
| 로고 | `00_전체/로고.png` | `index.html` 전역 고정 로고 (모든 화면 중앙 상단) |

### 1.2 입장 화면 (screen-name)
| 항목 | 파일 | 적용 위치 |
|------|------|----------|
| 방 만들기 버튼 | `01_메인화면/게임호스트버튼.png` | `index.html` #btn-create-room |
| 방 들어가기 버튼 | `01_메인화면/게임입장하기버튼.png` | `index.html` #btn-join-room |
| 닉네임 입력 배경 | `01_메인화면/작은견출지.png` | `index.html` .nickname-label-wrapper |
| 아바타 이미지 | `01_메인화면/아바타.png` | `script.js` AVATAR_LIST (이미지 타입) |

### 1.3 로비 화면 (screen-lobby)
| 항목 | 파일 | 적용 위치 |
|------|------|----------|
| 공책 배경 | `02_로비/공책.png` | `style.css` .lobby-container 배경 |
| 나가기 버튼 | `02_로비/나가기 버튼.png` | `index.html` #btn-leave |
| 방 코드 버튼 | `02_로비/방 코드 버튼.png` | `index.html` .room-code-container |
| 방 코드 호버 버튼 | `02_로비/방 코드_호버 시_복사하기 버튼.png` | `index.html` .room-code-hover-img |
| 게임 시작 버튼 | `02_로비/시작하기 버튼.png` | `index.html` #btn-start |

**로비 레이아웃:**
- 왼쪽: 플레이어 목록 (세로 정렬, 아바타+이름 표시)
- 오른쪽: 버튼 (시작하기 → 방코드 → 나가기 순서)

### 1.4 키워드 입력 화면 (screen-prompts)
| 항목 | 파일 | 적용 위치 |
|------|------|----------|
| 공책 배경 | `03_키워드 적기/공책.png` | `style.css` .note-background |
| 카드 1 | `03_키워드 적기/카드1.png` | `index.html` 첫 번째 keyword-card |
| 카드 2 | `03_키워드 적기/카드2.png` | `index.html` 두 번째 keyword-card |
| 카드 3 | `03_키워드 적기/카드3.png` | `index.html` 세 번째 keyword-card |
| 작성 완료 버튼 | `03_키워드 적기/확인.png` | `index.html` #btn-submit-prompts |
| 생각중 아이콘 | `04_스토리 적기/생각중.png` | `script.js` createSidebarPlayer (prompts 모드) |
| 작성중 아이콘 | `04_스토리 적기/작성중.png` | `script.js` createSidebarPlayer (prompts 모드) |
| 작성완료 아이콘 | `04_스토리 적기/작성완료.png` | `script.js` createSidebarPlayer (prompts 모드) |

**키워드 화면 레이아웃:**
- 양옆에 플레이어 사이드바 추가 (스토리 화면과 동일한 구조)
- 이모티콘 전송/수신 가능
- 작성 상태 실시간 표시 (생각중/작성중/완료)

### 1.5 스토리 작성 화면 (screen-story)
| 항목 | 파일 | 적용 위치 |
|------|------|----------|
| 공책 배경 | `04_스토리 적기/공책.png` | `style.css` .story-main .card.wide 배경 |
| 입력란 배경 | `04_스토리 적기/입력란.png` | `index.html` .story-input-wrapper 배경 |
| 제출 버튼 | `04_스토리 적기/제출.png` | `index.html` #btn-submit-story (입력란 옆 배치) |
| 생각중 아이콘 | `04_스토리 적기/생각중.png` | `script.js` createSidebarPlayer, updateSidebarPlayerStatus |
| 작성중 아이콘 | `04_스토리 적기/작성중.png` | `script.js` createSidebarPlayer, updateSidebarPlayerStatus |
| 작성완료 아이콘 | `04_스토리 적기/작성완료.png` | `script.js` createSidebarPlayer, updateSidebarPlayerStatus |

**스토리 화면 레이아웃:**
- 입력란: 입력란.png 배경 위에 textarea 배치
- 제출 버튼: 입력란 오른쪽에 가로 배치

### 1.6 결과 화면 (screen-results)
| 항목 | 파일 | 적용 위치 |
|------|------|----------|
| 공책 배경 | `05_엔딩/공책.png` | `style.css` .chat-container 배경 |
| 다시하기 버튼 | `05_엔딩/다시하기.png` | `index.html` #btn-restart |
| 저장하기 버튼 | `05_엔딩/저장하기.png` | `index.html` #btn-screenshot |
| 이전 이야기로 버튼 | `05_엔딩/이전 이야기로.png` | `index.html` #btn-prev |
| 다음 이야기로 버튼 | `05_엔딩/다음 이야기로.png` | `index.html` #btn-next-story |

**결과 화면 레이아웃:**
- 스킵 버튼 제거됨
- 버튼들 오른쪽 하단에 세로 배치 (위에서부터: 다시하기 → 저장하기 → 이전 이야기로 → 다음 이야기로)
- 호버 시 오른쪽으로 5도 회전 애니메이션

---

## 2. 미적용 이미지 (수동 적용 필요)

### 2.1 메인 화면 장식 요소
| 파일 | 용도 | 적용 방법 |
|------|------|----------|
| `01_메인화면/공책.png` | 메인 화면 공책 배경 | CSS에서 .entry-container 배경으로 사용 가능 |
| `01_메인화면/공책속지_투명.png` | 공책 내부 속지 | 공책 위에 오버레이 |
| `01_메인화면/볼펜.png` | 장식 요소 | 화면에 absolute 배치 |
| `01_메인화면/클립.png` | 장식 요소 | 화면에 absolute 배치 |
| `01_메인화면/형광펜.png` | 장식 요소 | 화면에 absolute 배치 |
| `01_메인화면/아바타 선택창.png` | 아바타 선택 영역 배경 | .avatar-selection 배경으로 사용 |

### 2.2 로비 화면 추가 요소
| 파일 | 용도 | 적용 방법 |
|------|------|----------|
| `02_로비/공책속지_투명.png` | 공책 내부 속지 | 공책 위에 오버레이 |
| `02_로비/대기실.png` | 대기실 타이틀 이미지 | h2 "대기실" 대체 |
| `02_로비/방장왕관.png` | 방장 표시 아이콘 | renderPlayers 함수에서 방장 이름 옆에 표시 |
| `02_로비/아바타_빈 참가자.png` | 빈 슬롯 표시 | 빈 플레이어 카드 배경 |
| `02_로비/아바타_참가자.png` | 참가자 카드 배경 | .player-card 배경으로 사용 |
| `02_로비/참가자목록 구분선.png` | 구분선 장식 | 플레이어 목록 사이에 배치 |
| `02_로비/나가기 버튼_활성화.png` | 나가기 버튼 호버 상태 | CSS :hover에서 이미지 교체 |
| `02_로비/시작하기 버튼_활성화.png` | 시작 버튼 호버 상태 | CSS :hover에서 이미지 교체 |

### 2.3 키워드 입력 화면 추가 요소
| 파일 | 용도 | 적용 방법 |
|------|------|----------|
| `03_키워드 적기/밑줄_3가지의 키워드 카드를 만들어주세요.png` | 안내 텍스트 이미지 | h2 아래에 이미지로 추가 |
| `03_키워드 적기/확인_완료.png` | 제출 완료 후 버튼 상태 | 버튼 disabled 시 이미지 교체 |
| `03_키워드 적기/생각중.png` | 생각중 아이콘 (별도 스타일) | 키워드 화면 전용 아이콘 |
| `03_키워드 적기/작성중.png` | 작성중 아이콘 (별도 스타일) | 키워드 화면 전용 아이콘 |
| `03_키워드 적기/작성완료.png` | 작성완료 아이콘 (별도 스타일) | 키워드 화면 전용 아이콘 |
| `03_키워드 적기/아바타.png` | 아바타 예시 (참고용) | - |

### 2.4 스토리 작성 화면 추가 요소
| 파일 | 용도 | 적용 방법 |
|------|------|----------|
| `04_스토리 적기/아바타.png` | 사이드바 아바타 스타일 (참고용) | - |

### 2.5 결과 화면 추가 요소
| 파일 | 용도 | 적용 방법 |
|------|------|----------|
| `05_엔딩/사생활 데코.png` | 장식 요소 | 화면에 absolute 배치 |
| `05_엔딩/좌측아바타.png` | 좌측 아바타 장식 | 화면 좌측에 배치 |
| `05_엔딩/우측아바타.png` | 우측 아바타 장식 | 화면 우측에 배치 |
| `05_엔딩/이모티콘_창.png` | 이모티콘 선택 창 배경 | .result-emoji-section 배경으로 사용 |

### 2.6 배경 음악
| 파일 | 용도 | 적용 상태 |
|------|------|----------|
| `00_전체/Multi Game OST.mp3` | 배경 음악 | [적용됨] HTML audio 태그로 재생 |

---

## 3. 이미지 폴더 구조

```
client/image/
├── 00_전체/
│   ├── Multi Game OST.mp3     [적용됨] 배경 음악
│   ├── 로고.png               [적용됨] 전역 고정 로고
│   └── 배경.png               [적용됨]
│
├── 01_메인화면/
│   ├── 게임입장하기버튼.png    [적용됨]
│   ├── 게임호스트버튼.png      [적용됨]
│   ├── 공책.png               (미적용)
│   ├── 공책속지_투명.png       (미적용)
│   ├── 볼펜.png               (미적용)
│   ├── 아바타 선택창.png       (미적용)
│   ├── 아바타.png             [적용됨] AVATAR_LIST 기본 아바타
│   ├── 작은견출지.png          [적용됨] 닉네임 입력 배경
│   ├── 클립.png               (미적용)
│   └── 형광펜.png             (미적용)
│
├── 02_로비/
│   ├── 공책.png               [적용됨] .lobby-container 배경
│   ├── 공책속지_투명.png       (미적용)
│   ├── 나가기 버튼.png         [적용됨]
│   ├── 나가기 버튼_활성화.png   (호버 상태 미적용)
│   ├── 대기실.png             (미적용)
│   ├── 방 코드 버튼.png        [적용됨]
│   ├── 방 코드_호버 시_복사하기 버튼.png [적용됨] 호버 시 표시
│   ├── 방장왕관.png            (미적용)
│   ├── 시작하기 버튼.png        [적용됨]
│   ├── 시작하기 버튼_활성화.png  (호버 상태 미적용)
│   ├── 아바타_빈 참가자.png     (미적용)
│   ├── 아바타_참가자.png        (미적용)
│   └── 참가자목록 구분선.png    (미적용)
│
├── 03_키워드 적기/
│   ├── 공책.png               [적용됨] .note-background 배경
│   ├── 밑줄_3가지의 키워드 카드를 만들어주세요.png (미적용)
│   ├── 생각중.png             (미적용 - 04_스토리 적기 버전 사용)
│   ├── 아바타.png             (참고용)
│   ├── 작성완료.png            (미적용 - 04_스토리 적기 버전 사용)
│   ├── 작성중.png             (미적용 - 04_스토리 적기 버전 사용)
│   ├── 카드1.png              [적용됨]
│   ├── 카드2.png              [적용됨]
│   ├── 카드3.png              [적용됨]
│   ├── 확인.png               [적용됨]
│   └── 확인_완료.png           (제출 후 상태 미적용)
│
├── 04_스토리 적기/
│   ├── 공책.png               [적용됨] .story-main .card.wide 배경
│   ├── 생각중.png             [적용됨] 키워드/스토리 사이드바 공용
│   ├── 아바타.png             (참고용)
│   ├── 입력란.png             [적용됨] .story-input-wrapper 배경
│   ├── 작성완료.png            [적용됨] 키워드/스토리 사이드바 공용
│   ├── 작성중.png             [적용됨] 키워드/스토리 사이드바 공용
│   └── 제출.png               [적용됨] 입력란 옆 배치
│
├── 05_엔딩/
│   ├── 공책.png               [적용됨] .chat-container 배경
│   ├── 다시하기.png            [적용됨] 오른쪽 하단 세로 배치
│   ├── 다음 이야기로.png       [적용됨] 오른쪽 하단 세로 배치
│   ├── 사생활 데코.png         (미적용)
│   ├── 우측아바타.png          (미적용)
│   ├── 이모티콘_창.png         (미적용)
│   ├── 이전 이야기로.png       [적용됨] 오른쪽 하단 세로 배치
│   ├── 저장하기.png            [적용됨] 오른쪽 하단 세로 배치
│   └── 좌측아바타.png          (미적용)
│
└── (기존 파일들 - 더 이상 사용하지 않음)
    ├── bg.png
    ├── card1.png
    ├── card2.png
    ├── card3.png
    ├── note.png
    └── submit.png
```

---

## 4. 수정된 파일 목록

### 4.1 index.html
- **전역 로고:** `#global-logo` 추가 (모든 화면 중앙 상단 고정)
- **입장 화면:** 닉네임 입력에 작은견출지.png 배경 적용
- **로비 화면:** 좌우 레이아웃으로 변경 (`lobby-container`, `lobby-left`, `lobby-right`)
- **키워드 화면:** 양옆 사이드바 추가 (`prompts-layout`, `prompts-players-left`, `prompts-players-right`)
- **스토리 화면:** 입력란 구조 변경 (`story-input-row`, `story-input-wrapper`)
- **결과 화면:** 스킵 버튼 제거, 버튼들 오른쪽 세로 배치 (`results-wrapper`, `results-side-controls`)

### 4.2 style.css
- **전역 로고 스타일:** `#global-logo`, `.global-logo-img`, `#app` padding-top
- **닉네임 견출지 스타일:** `.nickname-label-wrapper`, `.nickname-label-bg`
- **로비 레이아웃:** `.lobby-container`, `.lobby-left`, `.lobby-right`, `.player-list-vertical`
- **키워드 레이아웃:** `.prompts-layout`, `.prompts-main`
- **스토리 입력란:** `.story-input-row`, `.story-input-wrapper`, `.story-input-bg`
- **결과 화면 버튼:** `.results-wrapper`, `.results-side-controls`, `.result-side-btn` (호버 시 rotate(5deg) 애니메이션)

### 4.3 script.js
- **아바타 시스템:** `AVATAR_LIST`를 이미지 타입으로 변경 (이모지 제거)
- **로비 플레이어 렌더링:** `renderPlayers()` 함수에 아바타 이미지 표시 추가
- **키워드 사이드바:** `renderPromptsSidebars()`, `updatePromptsSidebarStatus()` 함수 추가
- **사이드바 공용화:** `createSidebarPlayer()`에 `screenType` 파라미터 추가 ("story" | "prompts")
- **이모티콘 표시:** `displayReceivedEmoji()`가 키워드 화면 사이드바도 지원
- **스킵 버튼 제거:** `btnSkipSentence` 관련 코드 모두 제거

---

## 5. 아바타 추가 방법

현재 아바타는 **이미지 타입**으로 설정되어 있습니다.

### 5.1 새 아바타 추가
`script.js`의 `AVATAR_LIST`에 추가:

```javascript
const AVATAR_LIST = [
  { id: "avatar1", type: "image", content: "/image/01_메인화면/아바타.png" },
  // 새 아바타 추가 예시:
  { id: "avatar2", type: "image", content: "/image/01_메인화면/아바타2.png" },
  { id: "avatar3", type: "image", content: "/image/01_메인화면/아바타3.png" },
];
```

### 5.2 이미지 파일 준비
- 권장 크기: 100x100px 이상 (정사각형)
- 형식: PNG (투명 배경 권장)
- 위치: `/image/01_메인화면/` 폴더

---

## 6. 추가 적용 방법 예시

### 6.1 버튼 호버 상태 이미지 적용
```css
/* style.css에 추가 */
#btn-start:hover img {
  content: url('./image/02_로비/시작하기 버튼_활성화.png');
}

#btn-leave:hover img {
  content: url('./image/02_로비/나가기 버튼_활성화.png');
}
```

### 6.2 장식 요소 추가 예시
```html
<!-- 결과 화면에 장식 추가 -->
<img src="/image/05_엔딩/좌측아바타.png" class="deco-left" alt="">
<img src="/image/05_엔딩/우측아바타.png" class="deco-right" alt="">
```

```css
.deco-left {
  position: fixed;
  left: 20px;
  bottom: 20px;
  width: 150px;
  z-index: -1;
}

.deco-right {
  position: fixed;
  right: 20px;
  bottom: 20px;
  width: 150px;
  z-index: -1;
}
```

---

## 체크리스트

### 적용 완료
- [x] 전체 배경 이미지 (00_전체/배경.png)
- [x] 전역 로고 이미지 (00_전체/로고.png) - 모든 화면 중앙 상단 고정
- [x] 입장 화면 버튼 (방 만들기, 방 들어가기)
- [x] 입장 화면 닉네임 입력 배경 (작은견출지.png)
- [x] 입장 화면 아바타 (이미지 타입으로 변경)
- [x] 로비 화면 레이아웃 변경 (왼쪽: 플레이어, 오른쪽: 버튼)
- [x] 로비 화면 버튼 (시작하기, 방코드, 나가기)
- [x] 로비 화면 방 코드 호버 이미지
- [x] 키워드 입력 화면 (공책 배경, 카드 1/2/3, 작성 완료 버튼)
- [x] 키워드 화면 양옆 사이드바 (이모티콘 지원)
- [x] 키워드/스토리 상태 아이콘 (생각중, 작성중, 작성완료)
- [x] 스토리 입력란 배경 (입력란.png)
- [x] 스토리 제출 버튼 (입력란 옆 배치)
- [x] 결과 화면 버튼 (다시하기, 저장하기, 이전 이야기로, 다음 이야기로)
- [x] 결과 화면 버튼 오른쪽 하단 세로 배치
- [x] 결과 화면 버튼 호버 회전 애니메이션
- [x] 배경 음악 (BGM)

### 미적용 (선택 사항)
- [ ] 입장 화면 장식 요소 (공책, 볼펜, 클립, 형광펜)
- [ ] 로비 화면 장식 요소 (대기실 타이틀, 방장왕관, 구분선)
- [ ] 버튼 호버 상태 이미지 (활성화 버전)
- [ ] 결과 화면 장식 요소 (좌/우측 아바타, 사생활 데코)
- [ ] 이모티콘 창 배경
- [ ] 추가 아바타 이미지
- [ ] 커스텀 이모티콘 이미지