import type { MediaState } from '../types'
import {
  CameraIcon,
  CameraOffIcon,
  ChatIcon,
  MicIcon,
  MicOffIcon,
  MonitorIcon,
  PhoneOffIcon,
} from './icons'

interface Props {
  media: MediaState
  chatOpen: boolean
  unread: number
  canShareScreen: boolean
  onToggleMic: () => void
  onToggleCamera: () => void
  onToggleScreen: () => void
  onToggleChat: () => void
  onLeave: () => void
}

const buttonBase = 'flex h-11 w-11 items-center justify-center rounded-full transition-colors'
const onClass = 'bg-ink-600 text-fog-100 hover:bg-ink-500'
const offClass = 'bg-alert-600 text-white hover:bg-alert-500'

export default function ControlBar({
  media,
  chatOpen,
  unread,
  canShareScreen,
  onToggleMic,
  onToggleCamera,
  onToggleScreen,
  onToggleChat,
  onLeave,
}: Props) {
  return (
    <div className="flex justify-center px-4 pt-2 pb-4">
      <div className="flex items-center gap-2 rounded-2xl border border-ink-700 bg-ink-800/95 px-3 py-2">
        <button
          type="button"
          onClick={onToggleMic}
          aria-label={media.audio ? '마이크 끄기' : '마이크 켜기'}
          aria-pressed={media.audio}
          title={media.audio ? '마이크 끄기' : '마이크 켜기'}
          className={`${buttonBase} ${media.audio ? onClass : offClass}`}
        >
          {media.audio ? <MicIcon className="h-5 w-5" /> : <MicOffIcon className="h-5 w-5" />}
        </button>

        <button
          type="button"
          onClick={onToggleCamera}
          aria-label={media.video ? '카메라 끄기' : '카메라 켜기'}
          aria-pressed={media.video}
          title={media.video ? '카메라 끄기' : '카메라 켜기'}
          className={`${buttonBase} ${media.video ? onClass : offClass}`}
        >
          {media.video ? <CameraIcon className="h-5 w-5" /> : <CameraOffIcon className="h-5 w-5" />}
        </button>

        {canShareScreen && (
          <button
            type="button"
            onClick={onToggleScreen}
            aria-label={media.screen ? '화면 공유 중지' : '화면 공유 시작'}
            aria-pressed={media.screen}
            title={media.screen ? '화면 공유 중지' : '화면 공유 시작'}
            className={`${buttonBase} ${
              media.screen ? 'bg-spot-400 text-ink-950 hover:bg-spot-500' : onClass
            }`}
          >
            <MonitorIcon className="h-5 w-5" />
          </button>
        )}

        <div aria-hidden="true" className="mx-1 h-6 w-px bg-ink-600" />

        <button
          type="button"
          onClick={onToggleChat}
          aria-label={chatOpen ? '채팅 닫기' : '채팅 열기'}
          aria-pressed={chatOpen}
          title={chatOpen ? '채팅 닫기' : '채팅 열기'}
          className={`relative ${buttonBase} ${
            chatOpen ? 'bg-cord-600 text-white hover:bg-cord-500' : onClass
          }`}
        >
          <ChatIcon className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-alert-500 px-1 text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onLeave}
          aria-label="통화 나가기"
          className="flex h-11 items-center gap-2 rounded-full bg-alert-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-alert-500"
        >
          <PhoneOffIcon className="h-5 w-5" />
          <span className="hidden sm:inline">나가기</span>
        </button>
      </div>
    </div>
  )
}
