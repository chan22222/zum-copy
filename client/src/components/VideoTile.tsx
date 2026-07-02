import { useEffect, useRef } from 'react'
import type { MediaState } from '../types'
import { ExpandIcon, MicOffIcon, VolumeIcon } from './icons'

interface Props {
  name: string
  stream: MediaStream | null
  media: MediaState
  isSelf: boolean
  variant?: 'grid' | 'stage' | 'strip' | 'full'
  volume?: number
  onVolumeChange?: (volume: number) => void
  onDoubleClick?: () => void
  onFullscreen?: () => void
}

const FRAME_CLASS: Record<NonNullable<Props['variant']>, string> = {
  grid: 'h-full w-full rounded-xl',
  stage: 'h-full w-full rounded-xl ring-2 ring-spot-400/80',
  strip: 'h-full w-44 shrink-0 rounded-xl',
  full: 'h-full w-full',
}

export default function VideoTile({
  name,
  stream,
  media,
  isSelf,
  variant = 'grid',
  volume,
  onVolumeChange,
  onDoubleClick,
  onFullscreen,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (video && video.srcObject !== stream) {
      video.srcObject = stream
    }
    if (video && stream) {
      video.play().catch(() => {
        /* muted 자동재생은 항상 허용되지만 방어적으로 무시 */
      })
    }
  }, [stream])

  const hasVideo = (media.video || media.screen) && stream !== null
  const initial = (name.trim().charAt(0) || '?').toUpperCase()
  const avatarClass =
    variant === 'strip'
      ? 'h-10 w-10 text-base'
      : variant === 'grid'
        ? 'h-16 w-16 text-2xl'
        : 'h-24 w-24 text-4xl'
  const fitClass = media.screen || variant === 'full' ? 'object-contain' : 'object-cover'

  return (
    <div
      className={`group relative flex items-center justify-center overflow-hidden bg-ink-800 ${FRAME_CLASS[variant]}`}
      onDoubleClick={onDoubleClick}
      title={onDoubleClick ? '더블클릭: 전체화면' : undefined}
    >
      {/* 소리는 PeerAudio(audio 요소)에서 재생하고 video는 화면 표시 전용(muted).
          video 요소는 영상 프레임이 없으면 재생을 시작하지 않아, 여기로 소리를
          내보내면 카메라가 꺼진 상대의 오디오까지 막힌다. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 h-full w-full ${fitClass} ${
          isSelf && !media.screen ? '-scale-x-100' : ''
        } ${hasVideo ? 'opacity-100' : 'opacity-0'}`}
      />
      {!hasVideo && (
        <div
          className={`flex items-center justify-center rounded-full bg-ink-600 font-semibold text-fog-300 ${avatarClass}`}
        >
          {initial}
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-md bg-ink-950/70 px-2 py-1 text-xs text-fog-100">
        {!media.audio && <MicOffIcon className="h-3.5 w-3.5 shrink-0 text-alert-500" />}
        <span className="truncate">{name}</span>
      </div>
      {media.screen && (
        <span className="absolute top-2 left-2 rounded-md bg-spot-400 px-2 py-0.5 text-[11px] font-semibold text-ink-950">
          화면 공유 중
        </span>
      )}
      {(onVolumeChange || onFullscreen) && (
        <div
          className="absolute right-2 bottom-2 flex items-center gap-1.5"
          onDoubleClick={(event) => event.stopPropagation()}
        >
          {onVolumeChange && (
            <div className="flex items-center gap-1.5 rounded-md bg-ink-950/70 px-2 py-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <VolumeIcon className="h-3.5 w-3.5 shrink-0 text-fog-300" />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume ?? 1}
                onChange={(event) => onVolumeChange(Number(event.target.value))}
                aria-label={`${name} 소리 크기`}
                className="h-1 w-20 cursor-pointer accent-cord-500"
              />
            </div>
          )}
          {onFullscreen && (
            <button
              type="button"
              onClick={onFullscreen}
              aria-label={`${name} 전체화면`}
              title="전체화면"
              className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-950/60 text-fog-100/80 transition-colors hover:bg-ink-950/90 hover:text-fog-100"
            >
              <ExpandIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
