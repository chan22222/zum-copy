import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRoom } from '../hooks/useRoom'
import type { MediaState } from '../types'
import ChatPanel from './ChatPanel'
import ControlBar from './ControlBar'
import { ChatIcon, CloseIcon, LinkIcon } from './icons'
import PeerAudio from './PeerAudio'
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
  const [volumes, setVolumes] = useState<Record<string, number>>({})
  const [fsTileId, setFsTileId] = useState<string | null>(null)
  const [fsChatOpen, setFsChatOpen] = useState(true)
  const seenCountRef = useRef(0)
  const copiedTimerRef = useRef<number | undefined>(undefined)
  const fsRef = useRef<HTMLDivElement>(null)

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

  const setPeerVolume = useCallback((id: string, volume: number) => {
    setVolumes((prev) => ({ ...prev, [id]: volume }))
  }, [])

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
  const fsTile = fsTileId ? (tiles.find((tile) => tile.id === fsTileId) ?? null) : null

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {
        /* 이미 종료된 경우 */
      })
    }
    setFsTileId(null)
  }, [])

  // 더블클릭으로 대상이 지정되면 브라우저 전체화면 요청
  // (거부되더라도 fixed 오버레이로 확대 표시는 유지된다)
  useEffect(() => {
    if (!fsTileId) return
    const el = fsRef.current
    if (el && document.fullscreenElement !== el) {
      el.requestFullscreen().catch(() => {
        /* iOS 등 미지원 환경 */
      })
    }
  }, [fsTileId])

  // Esc 등 브라우저 쪽에서 전체화면이 풀리면 상태도 되돌린다
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFsTileId(null)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // 전체화면으로 보던 참가자가 나가면 종료
  useEffect(() => {
    if (fsTileId && !tiles.some((tile) => tile.id === fsTileId)) exitFullscreen()
  }, [fsTileId, tiles, exitFullscreen])

  const renderTile = (tile: Tile, variant: 'grid' | 'stage' | 'strip' | 'full') => (
    <VideoTile
      key={tile.id}
      name={tile.name}
      stream={tile.stream}
      media={tile.media}
      isSelf={tile.isSelf}
      variant={variant}
      volume={volumes[tile.id] ?? 1}
      onVolumeChange={tile.isSelf ? undefined : (volume) => setPeerVolume(tile.id, volume)}
      onDoubleClick={variant === 'full' ? undefined : () => setFsTileId(tile.id)}
    />
  )

  return (
    <div className="flex h-full flex-col">
      {/* 원격 오디오는 타일과 분리해 항상 재생 — 영상 프레임이 없어도 소리가 나온다 */}
      {room.peers.map((peer) => {
        const stream = room.remoteStreams.get(peer.id)
        return stream ? (
          <PeerAudio key={peer.id} stream={stream} volume={volumes[peer.id] ?? 1} />
        ) : null
      })}

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
              <div className="min-h-0 flex-1 p-3">{renderTile(stage, 'stage')}</div>
              {strip.length > 0 && (
                <div className="flex h-28 gap-2 overflow-x-auto px-3 pb-1">
                  {strip.map((tile) => renderTile(tile, 'strip'))}
                </div>
              )}
            </>
          ) : (
            <div className="grid min-h-0 flex-1 auto-rows-[minmax(9rem,1fr)] grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-3 overflow-y-auto p-4">
              {tiles.map((tile) => renderTile(tile, 'grid'))}
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

      {fsTile && (
        <div ref={fsRef} className="fixed inset-0 z-50 bg-ink-950">
          <div
            className="h-full w-full"
            onDoubleClick={exitFullscreen}
            title="더블클릭: 전체화면 종료"
          >
            {renderTile(fsTile, 'full')}
          </div>

          <div
            className={`absolute top-4 z-30 flex gap-2 transition-all ${
              fsChatOpen ? 'right-[21rem]' : 'right-4'
            }`}
          >
            <button
              type="button"
              onClick={() => setFsChatOpen((open) => !open)}
              aria-label={fsChatOpen ? '채팅 숨기기' : '채팅 표시'}
              aria-pressed={fsChatOpen}
              title={fsChatOpen ? '채팅 숨기기' : '채팅 표시'}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                fsChatOpen
                  ? 'bg-cord-600 text-white hover:bg-cord-500'
                  : 'bg-ink-800/80 text-fog-100 hover:bg-ink-600'
              }`}
            >
              <ChatIcon className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={exitFullscreen}
              aria-label="전체화면 종료"
              title="전체화면 종료"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-800/80 text-fog-100 transition-colors hover:bg-ink-600"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          {fsChatOpen && (
            <ChatPanel
              overlay
              messages={room.messages}
              selfId={room.selfId}
              onSend={room.sendMessage}
              onClose={() => setFsChatOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}
