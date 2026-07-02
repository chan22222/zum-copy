import { useState } from 'react'
import type { CameraOption } from '../hooks/useRoom'
import type { MediaState } from '../types'
import {
  CameraIcon,
  CameraOffIcon,
  ChatIcon,
  ChevronUpIcon,
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
  micGain: number
  cameras: CameraOption[]
  cameraId: string | null
  onMicGainChange: (value: number) => void
  onSelectCamera: (deviceId: string) => void
  onToggleMic: () => void
  onToggleCamera: () => void
  onToggleScreen: () => void
  onToggleChat: () => void
  onLeave: () => void
}

const buttonBase = 'flex h-11 w-11 items-center justify-center transition-colors'
const onClass = 'bg-ink-600 text-fog-100 hover:bg-ink-500'
const offClass = 'bg-alert-600 text-white hover:bg-alert-500'

export default function ControlBar({
  media,
  chatOpen,
  unread,
  canShareScreen,
  micGain,
  cameras,
  cameraId,
  onMicGainChange,
  onSelectCamera,
  onToggleMic,
  onToggleCamera,
  onToggleScreen,
  onToggleChat,
  onLeave,
}: Props) {
  const [menu, setMenu] = useState<'mic' | 'camera' | null>(null)

  const toggleMenu = (target: 'mic' | 'camera') => {
    setMenu((current) => (current === target ? null : target))
  }

  return (
    <div className="flex justify-center px-2 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-4">
      <div className="flex items-center gap-1 rounded-2xl border border-ink-700 bg-ink-800/95 px-2 py-2 sm:gap-2 sm:px-3">
        {/* 마이크 + 입력 볼륨 메뉴 */}
        <div className="relative flex items-center">
          <button
            type="button"
            onClick={onToggleMic}
            aria-label={media.audio ? '마이크 끄기' : '마이크 켜기'}
            aria-pressed={media.audio}
            title={media.audio ? '마이크 끄기' : '마이크 켜기'}
            className={`${buttonBase} rounded-l-full ${media.audio ? onClass : offClass}`}
          >
            {media.audio ? <MicIcon className="h-5 w-5" /> : <MicOffIcon className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => toggleMenu('mic')}
            aria-label="마이크 옵션"
            aria-expanded={menu === 'mic'}
            title="마이크 입력 볼륨"
            className={`flex h-11 w-6 items-center justify-center rounded-r-full border-l border-ink-950/40 ${
              media.audio ? onClass : offClass
            }`}
          >
            <ChevronUpIcon className="h-3.5 w-3.5" />
          </button>
          {menu === 'mic' && (
            <div className="absolute bottom-14 left-1/2 w-60 -translate-x-1/2 rounded-xl border border-ink-600 bg-ink-800 p-3 shadow-xl">
              <div className="mb-2 flex items-center justify-between text-xs text-fog-300">
                <label htmlFor="mic-gain">마이크 입력 볼륨</label>
                <span className="font-mono text-fog-100">{Math.round(micGain * 100)}%</span>
              </div>
              <input
                id="mic-gain"
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={micGain}
                onChange={(event) => onMicGainChange(Number(event.target.value))}
                aria-label="마이크 입력 볼륨"
                className="w-full cursor-pointer accent-cord-500"
              />
            </div>
          )}
        </div>

        {/* 카메라 + 장치 선택 메뉴 */}
        <div className="relative flex items-center">
          <button
            type="button"
            onClick={onToggleCamera}
            aria-label={media.video ? '카메라 끄기' : '카메라 켜기'}
            aria-pressed={media.video}
            title={media.video ? '카메라 끄기' : '카메라 켜기'}
            className={`${buttonBase} rounded-l-full ${media.video ? onClass : offClass}`}
          >
            {media.video ? (
              <CameraIcon className="h-5 w-5" />
            ) : (
              <CameraOffIcon className="h-5 w-5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => toggleMenu('camera')}
            aria-label="카메라 선택"
            aria-expanded={menu === 'camera'}
            title="카메라 선택"
            className={`flex h-11 w-6 items-center justify-center rounded-r-full border-l border-ink-950/40 ${
              media.video ? onClass : offClass
            }`}
          >
            <ChevronUpIcon className="h-3.5 w-3.5" />
          </button>
          {menu === 'camera' && (
            <div className="absolute bottom-14 left-1/2 w-64 -translate-x-1/2 rounded-xl border border-ink-600 bg-ink-800 p-2 shadow-xl">
              <p className="px-2 pt-1 pb-1.5 text-xs text-fog-500">카메라 선택</p>
              {cameras.length === 0 && (
                <p className="px-2 pb-2 text-xs text-fog-500">사용 가능한 카메라가 없습니다.</p>
              )}
              {cameras.map((camera) => (
                <button
                  key={camera.deviceId}
                  type="button"
                  onClick={() => {
                    onSelectCamera(camera.deviceId)
                    setMenu(null)
                  }}
                  className={`block w-full truncate rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-ink-600 ${
                    camera.deviceId === cameraId ? 'text-cord-400' : 'text-fog-100'
                  }`}
                >
                  {camera.deviceId === cameraId ? '✓ ' : ''}
                  {camera.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {canShareScreen && (
          <button
            type="button"
            onClick={onToggleScreen}
            aria-label={media.screen ? '화면 공유 중지' : '화면 공유 시작'}
            aria-pressed={media.screen}
            title={media.screen ? '화면 공유 중지' : '화면 공유 시작'}
            className={`${buttonBase} rounded-full ${
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
          className={`relative ${buttonBase} rounded-full ${
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
          className="flex h-11 items-center gap-2 rounded-full bg-alert-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-alert-500 sm:px-5"
        >
          <PhoneOffIcon className="h-5 w-5" />
          <span className="hidden sm:inline">나가기</span>
        </button>
      </div>
    </div>
  )
}
