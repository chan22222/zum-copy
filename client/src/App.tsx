import { useMemo, useState } from 'react'
import Lobby from './components/Lobby'
import Room from './components/Room'

interface Session {
  roomId: string
  name: string
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const initialRoom = useMemo(
    () => new URLSearchParams(window.location.search).get('room')?.trim().toLowerCase() ?? '',
    [],
  )

  const handleJoin = (roomId: string, name: string) => {
    window.history.replaceState(null, '', `${window.location.pathname}?room=${roomId}`)
    setSession({ roomId, name })
  }

  const handleLeave = () => {
    window.history.replaceState(null, '', window.location.pathname)
    setSession(null)
  }

  return session ? (
    <Room roomId={session.roomId} userName={session.name} onLeave={handleLeave} />
  ) : (
    <Lobby initialRoom={initialRoom} onJoin={handleJoin} />
  )
}
