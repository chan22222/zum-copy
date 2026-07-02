import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ChatMessage } from '../types'
import { CloseIcon } from './icons'

interface Props {
  messages: ChatMessage[]
  selfId: string | null
  onSend: (text: string) => void
  onClose: () => void
  /** 전체화면 위에 반투명하게 띄우는 모드 */
  overlay?: boolean
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatPanel({ messages, selfId, onSend, onClose, overlay = false }: Props) {
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim()) return
    onSend(draft)
    setDraft('')
  }

  return (
    <aside
      className={
        overlay
          ? 'absolute inset-y-0 right-0 z-20 flex w-80 max-w-[85vw] flex-col border-l border-ink-700/50 bg-ink-900/60 backdrop-blur-md'
          : 'absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col border-l border-ink-700 bg-ink-900 lg:static lg:w-80 lg:max-w-none'
      }
    >
      <div className="flex items-center justify-between border-b border-ink-700 px-4 py-3">
        <h2 className="text-sm font-semibold">채팅</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="채팅 닫기"
          className="rounded-md p-1 text-fog-500 transition-colors hover:bg-ink-700 hover:text-fog-100"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="pt-4 text-center text-xs text-fog-500">
            아직 메시지가 없습니다. 첫 메시지를 보내 보세요.
          </p>
        )}
        {messages.map((msg) =>
          msg.system ? (
            <p key={msg.id} className="text-center text-xs text-fog-500">
              {msg.text}
            </p>
          ) : (
            <div key={msg.id}>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-sm font-semibold ${
                    msg.peerId === selfId ? 'text-cord-400' : 'text-fog-100'
                  }`}
                >
                  {msg.name}
                </span>
                <time className="font-mono text-[10px] text-fog-500">{formatTime(msg.ts)}</time>
              </div>
              <p className="mt-0.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-fog-300">
                {msg.text}
              </p>
            </div>
          ),
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-ink-700 p-3">
        <div className="flex gap-2">
          <label htmlFor="chat-input" className="sr-only">
            메시지 입력
          </label>
          <input
            id="chat-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="메시지 보내기"
            maxLength={2000}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm placeholder:text-fog-500 focus:border-cord-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-cord-600 px-3.5 text-sm font-medium text-white transition-colors hover:bg-cord-500"
          >
            전송
          </button>
        </div>
      </form>
    </aside>
  )
}
