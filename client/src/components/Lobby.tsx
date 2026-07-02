import { useState, type FormEvent } from 'react'

interface Props {
  initialRoom: string
  onJoin: (roomId: string, name: string) => void
}

// 혼동하기 쉬운 글자(l, 1, o, 0)를 뺀 방 코드 알파벳
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

function generateRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')
}

export default function Lobby({ initialRoom, onJoin }: Props) {
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('cord:name') ?? ''
    } catch {
      return ''
    }
  })
  const [code, setCode] = useState(initialRoom)
  const [error, setError] = useState<string | null>(null)
  const invited = initialRoom.length > 0

  const join = (roomId: string) => {
    const cleanName = name.trim()
    if (!cleanName) {
      setError('이름을 입력해 주세요.')
      return
    }
    try {
      localStorage.setItem('cord:name', cleanName)
    } catch {
      /* 시크릿 모드 등 저장 불가 환경 */
    }
    onJoin(roomId, cleanName)
  }

  const handleJoinExisting = (event: FormEvent) => {
    event.preventDefault()
    const cleanCode = code.trim().toLowerCase()
    if (!cleanCode) {
      setError('방 코드를 입력해 주세요.')
      return
    }
    join(cleanCode)
  }

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-cord-600/15 blur-[120px]"
      />

      <main className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Virtual Meeting</h1>
        </div>

        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-6 sm:p-8">
          {invited ? (
            <p className="mb-6 text-sm leading-relaxed text-fog-300">
              <span className="rounded-md bg-ink-700 px-1.5 py-0.5 font-mono text-cord-400">
                {initialRoom}
              </span>{' '}
              방으로 초대받았습니다. 이름을 입력하면 바로 참여할 수 있어요.
            </p>
          ) : (
            <p className="mb-6 text-sm leading-relaxed text-fog-300">
              음성 대화, 카메라, 화면 공유, 채팅 서비스
            </p>
          )}

          <form onSubmit={handleJoinExisting} className="space-y-4">
            <div>
              <label htmlFor="lobby-name" className="mb-1.5 block text-sm font-medium text-fog-300">
                이름
              </label>
              <input
                id="lobby-name"
                type="text"
                value={name}
                maxLength={30}
                onChange={(event) => {
                  setName(event.target.value)
                  setError(null)
                }}
                placeholder="회의에서 표시될 이름"
                autoComplete="name"
                className="w-full rounded-lg border border-ink-600 bg-ink-800 px-3.5 py-2.5 text-fog-100 placeholder:text-fog-500 focus:border-cord-500"
              />
            </div>

            {invited ? (
              <button
                type="button"
                onClick={() => join(initialRoom)}
                className="w-full rounded-lg bg-cord-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-cord-500"
              >
                통화 참여
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => join(generateRoomCode())}
                  className="w-full rounded-lg bg-cord-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-cord-500"
                >
                  새 통화 시작
                </button>

                <div className="flex items-center gap-3 text-xs text-fog-500">
                  <div className="h-px flex-1 bg-ink-600" />
                  또는 코드로 참여
                  <div className="h-px flex-1 bg-ink-600" />
                </div>

                <div className="flex gap-2">
                  <label htmlFor="lobby-code" className="sr-only">
                    방 코드
                  </label>
                  <input
                    id="lobby-code"
                    type="text"
                    value={code}
                    maxLength={40}
                    onChange={(event) => {
                      setCode(event.target.value)
                      setError(null)
                    }}
                    placeholder="방 코드 입력"
                    autoComplete="off"
                    spellCheck={false}
                    className="min-w-0 flex-1 rounded-lg border border-ink-600 bg-ink-800 px-3.5 py-2.5 font-mono text-sm text-fog-100 placeholder:font-sans placeholder:text-fog-500 focus:border-cord-500"
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-ink-600 bg-ink-700 px-4 py-2.5 font-medium text-fog-100 transition-colors hover:bg-ink-600"
                  >
                    참여
                  </button>
                </div>
              </>
            )}

            {error && (
              <p role="alert" className="text-sm text-alert-500">
                {error}
              </p>
            )}
          </form>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-fog-500">
          설치나 가입 없이 상대에게 초대 링크만 보내세요.
        </p>
        <p className="mt-2 text-center text-xs text-fog-500/60">powered by chan</p>
      </main>
    </div>
  )
}
