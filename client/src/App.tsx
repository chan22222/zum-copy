import { useMemo, useState } from 'react'
import Lobby from './components/Lobby'
import Room from './components/Room'

interface Session {
  roomId: string
  name: string
}

// 모바일(터치 기기)에서 입장 시 전체화면 + 가로 방향 잠금을 시도한다.
// 사용자 제스처(참여 버튼 클릭) 안에서만 허용되므로 여기서 호출한다.
// iOS 등 잠금 미지원 환경은 조용히 실패하고, Room의 회전 안내로 대체된다.
function tryMobileLandscape(): void {
  if (!window.matchMedia('(pointer: coarse)').matches) return
  const orientation = screen.orientation as unknown as {
    lock?: (orientation: string) => Promise<void>
  }
  void document.documentElement
    .requestFullscreen?.()
    .then(() => orientation.lock?.call(screen.orientation, 'landscape'))
    .catch(() => {
      /* 미지원 브라우저 */
    })
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const initialRoom = useMemo(
    () => new URLSearchParams(window.location.search).get('room')?.trim().toLowerCase() ?? '',
    [],
  )

  const handleJoin = (roomId: string, name: string) => {
    tryMobileLandscape()
    window.history.replaceState(null, '', `${window.location.pathname}?room=${roomId}`)
    setSession({ roomId, name })
  }

  const handleLeave = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {
        /* 이미 종료됨 */
      })
    }
    window.history.replaceState(null, '', window.location.pathname)
    setSession(null)
  }

  return session ? (
    <Room roomId={session.roomId} userName={session.name} onLeave={handleLeave} />
  ) : (
    <Lobby initialRoom={initialRoom} onJoin={handleJoin} />
  )
}
