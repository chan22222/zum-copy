// 시그널링 서버 프로토콜 테스트
// 사전 조건: 서버 실행 중 (npm start 또는 npm run dev)
// 실행: npm run test:signaling
import { io } from 'socket.io-client'

const URL = process.env.E2E_URL ?? 'http://localhost:3001'
const ROOM = `sigtest-${Math.random().toString(36).slice(2, 8)}`
let failed = 0

function check(label, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}`)
  if (!cond) failed += 1
}

function once(socket, event, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout: ${event}`)), timeoutMs)
    socket.once(event, (payload) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })
}

const alice = io(URL)
const bob = io(URL)

try {
  // 1. Alice 입장
  const aliceJoinedPromise = once(alice, 'joined')
  alice.emit('join', { roomId: ROOM, name: 'Alice', media: { audio: true, video: false, screen: false } })
  const aliceJoined = await aliceJoinedPromise
  check('Alice 입장: 기존 참가자 0명', aliceJoined.peers.length === 0)
  check('Alice 입장: selfId 수신', typeof aliceJoined.selfId === 'string')

  // 2. Bob 입장 → Alice가 peer-joined 수신, Bob은 Alice 목록 수신
  const peerJoinedPromise = once(alice, 'peer-joined')
  const bobJoinedPromise = once(bob, 'joined')
  bob.emit('join', { roomId: ROOM, name: 'Bob', media: { audio: false, video: false, screen: false } })
  const [peerJoined, bobJoined] = await Promise.all([peerJoinedPromise, bobJoinedPromise])
  check('Bob 입장: Alice가 peer-joined 수신', peerJoined.name === 'Bob')
  check('Bob 입장: 기존 참가자 목록에 Alice 포함', bobJoined.peers.some((p) => p.name === 'Alice'))
  check('Bob 입장: Alice의 media 상태 전달', bobJoined.peers[0].media.audio === true)
  check('Bob 입장: 채팅 히스토리에 시스템 메시지 존재', bobJoined.chat.some((m) => m.system))

  // 3. 시그널 중계 (Bob → Alice)
  const signalPromise = once(alice, 'signal')
  bob.emit('signal', { to: aliceJoined.selfId, description: { type: 'offer', sdp: 'dummy' } })
  const signal = await signalPromise
  check('시그널 중계: from이 Bob의 id', signal.from === bobJoined.selfId)
  check('시그널 중계: description 전달', signal.description?.type === 'offer')

  // 4. 채팅 브로드캐스트
  const chatAlicePromise = once(alice, 'chat')
  const chatBobPromise = once(bob, 'chat')
  alice.emit('chat', { text: '  리뷰 시작할게요  ' })
  const [chatToAlice, chatToBob] = await Promise.all([chatAlicePromise, chatBobPromise])
  check(
    '채팅: 양쪽 모두 수신 + 공백 trim',
    chatToAlice.text === '리뷰 시작할게요' && chatToBob.text === '리뷰 시작할게요',
  )
  check('채팅: 발신자 이름 포함', chatToBob.name === 'Alice')

  // 5. 미디어 상태 브로드캐스트
  const mediaPromise = once(alice, 'media-state')
  bob.emit('media-state', { audio: true, video: false, screen: true })
  const mediaEvent = await mediaPromise
  check(
    'media-state: Alice가 Bob의 화면공유 상태 수신',
    mediaEvent.id === bobJoined.selfId && mediaEvent.media.screen === true,
  )

  // 6. 다른 방으로는 시그널이 새지 않는지
  const eve = io(URL)
  const eveJoinedPromise = once(eve, 'joined')
  eve.emit('join', { roomId: `${ROOM}-other`, name: 'Eve', media: {} })
  const eveJoined = await eveJoinedPromise
  let leaked = false
  alice.once('signal', () => {
    leaked = true
  })
  eve.emit('signal', { to: aliceJoined.selfId, description: { type: 'offer', sdp: 'x' } })
  await new Promise((resolve) => setTimeout(resolve, 500))
  check('보안: 다른 방에서 온 시그널은 중계되지 않음', !leaked && eveJoined.selfId.length > 0)
  eve.disconnect()

  // 7. 퇴장 → peer-left
  const leftPromise = once(alice, 'peer-left')
  bob.disconnect()
  const left = await leftPromise
  check('퇴장: Alice가 peer-left 수신', left.id === bobJoined.selfId)
} catch (err) {
  console.error('FAIL —', err.message)
  failed += 1
} finally {
  alice.disconnect()
  bob.disconnect()
}

console.log(failed === 0 ? '\n시그널링 테스트 모두 통과' : `\n${failed}개 실패`)
process.exit(failed === 0 ? 0 : 1)
