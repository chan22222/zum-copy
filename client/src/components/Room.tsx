import { useEffect, useMemo, useRef, useState } from 'react'
import { useRoom } from '../hooks/useRoom'
import type { MediaState } from '../types'
import ChatPanel from './ChatPanel'
import ControlBar from './ControlBar'
import { LinkIcon } from './icons'
import VideoTile from './VideoTile'

interface Props {
  roomId: string
  userName: string
  onLeave: () => void
}

interface Tile {
  id: string
  name: string
  stream: MediaStream | null
  media: MediaState
  isSelf: boolean
}

const canShareScreen =
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia

export default function Room({ roomId, userName, onLeave }: Props) {
  const room = useRoom(roomId, userName)
  const [chatOpen, setChatOpen] = useState(() => window.innerWidth >= 1024)
  const [copied, setCopied] = useState(false)
  const [unread, setUnread] = useState(0)
  const seenCountRef = useRef(0)
  const copiedTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (chatOpen) {
      seenCountRef.current = room.messages.length
      setUnread(0)
    } else {
      setUnread(room.messages.length - seenCountRef.current)
    }
  }, [room.messages, chatOpen])

  useEffect(() => () => window.clearTimeout(copiedTimerRef.current), [])

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${window.location.pathname}?room=${roomId}`,
      )
      setCopied(true)
      window.clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard 사용 불가 환경 */
    }
  }

  const tiles = useMemo<Tile[]>(
    () => [
      {
        id: 'self',
        name: `${userName} (나)`,
        stream: room.localStream,
        media: room.media,
        isSelf: true,
      },
      ...room.peers.map((peer) => ({
        id: peer.id,
        name: peer.name,
        stream: room.remoteStreams.get(peer.id) ?? null,
        media: peer.media,
        isSelf: false,
      })),
    ],
    [userName, room.localStream, room.media, room.peers, room.remoteStreams],
  )

  // 화면 공유 중인 참가자가 있으면 그 화면을 스테이지로 크게 표시
  const stage = tiles.find((tile) => tile.media.screen) ?? null
  const strip = stage ? tiles.filter((tile) => tile.id !== stage.id) : []

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-ink-700 px-4 py-2.5">
        <span className="hidden font-semibold tracking-tight sm:inline">Virtual Meeting</span>
        <span className="rounded-md bg-ink-700 px-2 py-1 font-mono text-xs text-fog-300">
          {roomId}
        </span>
        <button
          type="button"
          onClick={copyInvite}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-fog-300 transition-colors hover:bg-ink-700 hover:text-fog-100"
        >
          <LinkIcon className="h-3.5 w-3.5" />
          {copied ? '복사됨!' : '초대 링크 복사'}
        </button>
        <span className="ml-auto text-sm text-fog-500">{tiles.length}명 참여 중</span>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          {stage ? (
            <>
              <div className="min-h-0 flex-1 p-3">
                <VideoTile
                  key={stage.id}
                  name={stage.name}
                  stream={stage.stream}
                  media={stage.media}
                  isSelf={stage.isSelf}
                  variant="stage"
                />
              </div>
              {strip.length > 0 && (
                <div className="flex h-28 gap-2 overflow-x-auto px-3 pb-1">
                  {strip.map((tile) => (
                    <VideoTile
                      key={tile.id}
                      name={tile.name}
                      stream={tile.stream}
                      media={tile.media}
                      isSelf={tile.isSelf}
                      variant="strip"
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="grid min-h-0 flex-1 auto-rows-[minmax(9rem,1fr)] grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-3 overflow-y-auto p-4">
              {tiles.map((tile) => (
                <VideoTile
                  key={tile.id}
                  name={tile.name}
                  stream={tile.stream}
                  media={tile.media}
                  isSelf={tile.isSelf}
                />
              ))}
            </div>
          )}

          <ControlBar
            media={room.media}
            chatOpen={chatOpen}
            unread={unread}
            canShareScreen={canShareScreen}
            onToggleMic={() => void room.toggleMic()}
            onToggleCamera={() => void room.toggleCamera()}
            onToggleScreen={() => void room.toggleScreen()}
            onToggleChat={() => setChatOpen((open) => !open)}
            onLeave={onLeave}
          />
        </main>

        {chatOpen && (
          <ChatPanel
            messages={room.messages}
            selfId={room.selfId}
            onSend={room.sendMessage}
            onClose={() => setChatOpen(false)}
          />
        )}

        {room.notice && (
          <div
            role="status"
            className="absolute bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-lg border border-ink-600 bg-ink-700 px-4 py-2 text-sm text-fog-100 shadow-lg"
          >
            {room.notice}
          </div>
        )}

        {room.status !== 'connected' && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink-950/85">
            <p className="text-sm text-fog-300">
              {room.status === 'connecting'
                ? '서버에 연결하는 중…'
                : '서버에 연결할 수 없습니다. 자동으로 다시 시도합니다.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
