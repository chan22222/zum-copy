import { useEffect, useRef } from 'react'
import type { MediaState } from '../types'
import { MicOffIcon } from './icons'

interface Props {
  name: string
  stream: MediaStream | null
  media: MediaState
  isSelf: boolean
  variant?: 'grid' | 'stage' | 'strip'
}

export default function VideoTile({ name, stream, media, isSelf, variant = 'grid' }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (video && video.srcObject !== stream) {
      video.srcObject = stream
    }
    // autoplay 속성이 무시되는 환경이 있어 명시적으로 재생을 시도한다
    if (video && stream) {
      video.play().catch(() => {
        /* 사용자 제스처 전 자동재생 차단 — 이후 상호작용 시 재생됨 */
      })
    }
  }, [stream])

  const hasVideo = (media.video || media.screen) && stream !== null
  const initial = (name.trim().charAt(0) || '?').toUpperCase()
  const isStage = variant === 'stage'

  // grid 타일은 셀 높이를 그대로 채운다 — 고정 비율(aspect-video)을 쓰면
  // 참가자가 적을 때 타일 높이가 화면을 넘어 불필요한 스크롤이 생긴다
  const frameClass = isStage
    ? 'h-full w-full ring-2 ring-spot-400/80'
    : variant === 'strip'
      ? 'h-full w-44 shrink-0'
      : 'h-full w-full'
  const avatarClass = isStage
    ? 'h-24 w-24 text-4xl'
    : variant === 'strip'
      ? 'h-10 w-10 text-base'
      : 'h-16 w-16 text-2xl'

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-xl bg-ink-800 ${frameClass}`}
    >
      {/* 영상이 없어도 video 요소는 유지해야 상대 오디오가 계속 재생된다 */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isSelf}
        className={`absolute inset-0 h-full w-full ${media.screen ? 'object-contain' : 'object-cover'} ${
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
    </div>
  )
}
