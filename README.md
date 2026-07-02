# Cord — 고객 리뷰용 화상회의 툴

만든 웹을 고객과 함께 보면서 리뷰하기 위한 웹 기반 통화 도구입니다.
링크 하나로 초대하고, 음성 대화 · 카메라 · 화면 공유 · 실시간 채팅을 지원합니다.

## 기능

- **음성 통화** — WebRTC P2P, 마이크 on/off
- **카메라 공유** — 카메라 on/off
- **화면 공유** — 탭/창/전체 화면 선택, 공유 중인 화면은 자동으로 크게 표시
- **실시간 채팅** — 입장 시 최근 200개 메시지 히스토리 제공, 안 읽은 메시지 배지
- **간편 참여** — 초대 링크(`?room=코드`)만 열면 이름 입력 후 바로 참여, 설치/가입 불필요

## 구조

```
cord/
├── client/   React 19 + TypeScript + Tailwind CSS 4 (Vite)
└── server/   Node.js + Express + Socket.IO — 시그널링, 채팅, 정적 파일 서빙
```

- 오디오/비디오는 참가자 간 **P2P(mesh)** 로 직접 전송되며 서버를 거치지 않습니다.
- 서버는 WebRTC 시그널링(offer/answer/ICE)과 채팅 중계만 담당하는 가벼운 프로세스입니다.
- mesh 구조 특성상 **동시 참가 4~5명 이하**를 권장합니다 (리뷰 미팅 용도에 적합).

## 로컬 실행

요구사항: Node.js 20 이상

```bash
npm install
npm run dev
```

- 클라이언트: http://localhost:5173 (서버로 프록시 연결)
- 서버: http://localhost:3001

같은 PC에서 테스트하려면 브라우저 탭/창 2개로 같은 방에 들어가면 됩니다.
마이크·카메라·화면 공유는 **localhost 또는 HTTPS 환경에서만** 동작합니다(브라우저 보안 정책).

## 프로덕션 빌드

```bash
npm run build   # client 빌드 → server 빌드
npm start       # 서버가 빌드된 client를 함께 서빙 (기본 포트 3001)
```

## 테스트

서버가 떠 있는 상태(`npm run build && npm start` 또는 `npm run dev`)에서 실행합니다.

```bash
npm run test:signaling   # 시그널링 프로토콜 테스트 (Socket.IO 레벨)
npm run test:e2e         # 실제 브라우저 2~3개로 통화 연결·미디어 수신·채팅·화면공유 검증
```

E2E 테스트는 시스템에 설치된 Chrome(또는 Edge)을 가짜 카메라/마이크 모드로 실행하므로
별도 브라우저 다운로드가 필요 없습니다.

## 배포

### Railway (권장 — 단일 서비스)

WebSocket 상시 연결이 필요하므로 Railway 같은 상시 실행 서버가 적합합니다.

1. 이 저장소를 GitHub에 push
2. Railway에서 **New Project → Deploy from GitHub repo** 선택
3. 끝 — `railway.toml`이 빌드/시작 명령과 헬스체크(`/api/health`)를 지정하며,
   `PORT`는 Railway가 자동 주입합니다. 발급된 도메인이 곧 서비스 주소입니다.

### Vercel (프론트만 분리 배포하는 경우)

Vercel 서버리스는 WebSocket 서버를 상시 실행할 수 없으므로 프론트엔드만 배포하고
시그널링 서버는 Railway에 따로 둡니다.

1. `server/`를 Railway에 배포
2. Vercel에서 `client/`를 루트로 배포하며 환경 변수 설정:
   - `VITE_SERVER_URL` = Railway 서버 주소 (예: `https://cord-production.up.railway.app`)
3. Railway 서버 환경 변수 설정:
   - `CORS_ORIGIN` = Vercel 도메인 (예: `https://cord.vercel.app`)

특별한 이유가 없다면 Railway 단일 서비스 배포가 가장 간단합니다.

## 환경 변수

| 변수 | 위치 | 설명 |
| --- | --- | --- |
| `PORT` | server | 서버 포트 (기본 3001, Railway 자동 주입) |
| `CORS_ORIGIN` | server | 허용할 프론트 오리진 (쉼표 구분, 미설정 시 전체 허용) |
| `TURN_URL` | server | TURN 서버 주소, 쉼표로 여러 개 지정 가능 (예: `turn:turn.example.com:3478,turns:turn.example.com:443?transport=tcp`) |
| `TURN_USERNAME` | server | TURN 인증 사용자명 |
| `TURN_CREDENTIAL` | server | TURN 인증 비밀번호 |
| `VITE_SERVER_URL` | client | 프론트 분리 배포 시 서버 주소 (미설정 시 같은 오리진) |

> **TURN 서버가 필요한 경우**: 기본 STUN만으로는 일부 회사 방화벽/엄격한 NAT 환경에서
> P2P 연결이 실패할 수 있습니다. 고객사 네트워크가 까다롭다면 [coturn](https://github.com/coturn/coturn)을
> 직접 운영하거나 [Metered](https://www.metered.ca/tools/openrelay/) 같은 무료 TURN 서비스를 연결하세요.

## 사용 흐름

1. 개발자가 접속해 이름 입력 → **새 통화 시작**
2. 상단 **초대 링크 복사** 버튼으로 링크를 고객에게 전달
3. 고객이 링크를 열고 이름만 입력하면 통화 합류
4. **화면 공유**로 리뷰할 웹을 보여주면서 음성/채팅으로 피드백 수집
