import { useEffect, useRef } from 'react'

interface Props {
  stream: MediaStream
  volume: number
}

// 원격 참가자 오디오 전용 재생기.
// video 요소는 영상 프레임이 도착하기 전까지 재생을 시작하지 않아
// 카메라/화면공유가 꺼진 상대의 소리까지 막힌다. 오디오 트랙만 분리해
// audio 요소로 재생하면 영상 유무와 무관하게 소리가 나온다.
export default function PeerAudio({ stream, volume }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const sync = () => {
      audio.srcObject = new MediaStream(stream.getAudioTracks())
      audio.play().catch(() => {
        /* 사용자 제스처 전 자동재생 차단 — 입장 클릭 이후에는 허용됨 */
      })
    }
    sync()
    stream.addEventListener('addtrack', sync)
    return () => stream.removeEventListener('addtrack', sync)
  }, [stream])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  return <audio ref={audioRef} autoPlay />
}
