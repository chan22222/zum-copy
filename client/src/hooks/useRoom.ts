import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { ChatMessage, MediaState, PeerInfo } from '../types'

// 프론트를 Vercel 등에 분리 배포할 때만 설정. 미설정 시 같은 오리진 사용.
const SERVER_URL = import.meta.env.VITE_SERVER_URL as string | undefined

const DEFAULT_ICE: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export type RoomStatus = 'connecting' | 'connected' | 'error'

interface PeerConn {
  pc: RTCPeerConnection
  audioSender: RTCRtpSender | null
  videoSender: RTCRtpSender | null
  polite: boolean
  makingOffer: boolean
  ignoreOffer: boolean
}

export function useRoom(roomId: string, userName: string) {
  const socketRef = useRef<Socket | null>(null)
  const connsRef = useRef<Map<string, PeerConn>>(new Map())
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map())
  const iceServersRef = useRef<RTCIceServer[]>(DEFAULT_ICE)
  const micTrackRef = useRef<MediaStreamTrack | null>(null)
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null)
  const screenTrackRef = useRef<MediaStreamTrack | null>(null)
  const mediaRef = useRef<MediaState>({ audio: false, video: false, screen: false })
  const noticeTimerRef = useRef<number | undefined>(undefined)

  const [status, setStatus] = useState<RoomStatus>('connecting')
  const [selfId, setSelfId] = useState<string | null>(null)
  const [peers, setPeers] = useState<PeerInfo[]>([])
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [media, setMedia] = useState<MediaState>(mediaRef.current)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const showNotice = useCallback((text: string) => {
    setNotice(text)
    window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 4000)
  }, [])

  const emitMedia = useCallback((next: MediaState) => {
    mediaRef.current = next
    setMedia(next)
    socketRef.current?.emit('media-state', next)
  }, [])

  // 기존 참가자 쪽: 신규 입장자의 offer에 실려 온 트랜시버를 재사용해
  // 같은 m-line에서 양방향(sendrecv)으로 보낸다. 각자 addTransceiver를 하면
  // 동시 offer(glare)로 m-line이 중복 생성된다.
  const adoptTransceivers = useCallback((conn: PeerConn) => {
    for (const transceiver of conn.pc.getTransceivers()) {
      const kind = transceiver.receiver.track.kind
      if (kind === 'audio' && !conn.audioSender) {
        transceiver.direction = 'sendrecv'
        conn.audioSender = transceiver.sender
        if (micTrackRef.current) void transceiver.sender.replaceTrack(micTrackRef.current)
      } else if (kind === 'video' && !conn.videoSender) {
        transceiver.direction = 'sendrecv'
        conn.videoSender = transceiver.sender
        const videoTrack = screenTrackRef.current ?? cameraTrackRef.current
        if (videoTrack) void transceiver.sender.replaceTrack(videoTrack)
      }
    }
  }, [])

  const createConn = useCallback((peerId: string, initiator: boolean): PeerConn => {
    const socket = socketRef.current
    if (!socket) throw new Error('소켓이 준비되지 않았습니다')

    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current })
    const conn: PeerConn = {
      pc,
      audioSender: null,
      videoSender: null,
      // perfect negotiation: 소켓 id 비교로 polite 역할을 결정론적으로 배정
      polite: (socket.id ?? '').localeCompare(peerId) > 0,
      makingOffer: false,
      ignoreOffer: false,
    }
    // 신규 입장자(initiator)만 트랜시버를 만들어 offer를 보낸다.
    // 트랜시버를 미리 만들어 두면 이후 트랙 on/off는 replaceTrack만으로
    // 처리되어 재협상이 필요 없다.
    if (initiator) {
      const audioTx = pc.addTransceiver('audio', { direction: 'sendrecv' })
      const videoTx = pc.addTransceiver('video', { direction: 'sendrecv' })
      conn.audioSender = audioTx.sender
      conn.videoSender = videoTx.sender
      if (micTrackRef.current) void audioTx.sender.replaceTrack(micTrackRef.current)
      const videoTrack = screenTrackRef.current ?? cameraTrackRef.current
      if (videoTrack) void videoTx.sender.replaceTrack(videoTrack)
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) socket.emit('signal', { to: peerId, candidate: event.candidate })
    }
    pc.onnegotiationneeded = async () => {
      try {
        conn.makingOffer = true
        await pc.setLocalDescription()
        socket.emit('signal', { to: peerId, description: pc.localDescription })
      } catch (err) {
        console.error('협상 시작 실패', err)
      } finally {
        conn.makingOffer = false
      }
    }
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') pc.restartIce()
    }
    pc.ontrack = (event) => {
      let stream = remoteStreamsRef.current.get(peerId)
      if (!stream) {
        stream = new MediaStream()
        remoteStreamsRef.current.set(peerId, stream)
      }
      stream.addTrack(event.track)
      setRemoteStreams(new Map(remoteStreamsRef.current))
    }

    connsRef.current.set(peerId, conn)
    return conn
  }, [])

  const closeConn = useCallback((peerId: string) => {
    const conn = connsRef.current.get(peerId)
    if (conn) {
      try {
        conn.pc.close()
      } catch {
        /* 이미 닫힌 연결 */
      }
      connsRef.current.delete(peerId)
    }
    if (remoteStreamsRef.current.delete(peerId)) {
      setRemoteStreams(new Map(remoteStreamsRef.current))
    }
  }, [])

  useEffect(() => {
    let disposed = false
    const socket = SERVER_URL ? io(SERVER_URL, { autoConnect: false }) : io({ autoConnect: false })
    socketRef.current = socket

    socket.on('connect', () => {
      // 재연결 시 소켓 id가 바뀌므로 이전 P2P 연결은 폐기하고 새로 협상한다
      for (const id of [...connsRef.current.keys()]) closeConn(id)
      setPeers([])
      socket.emit('join', { roomId, name: userName, media: mediaRef.current })
    })

    socket.on(
      'joined',
      (payload: { selfId: string; peers: PeerInfo[]; chat: ChatMessage[] }) => {
        setStatus('connected')
        setSelfId(payload.selfId)
        setMessages(payload.chat)
        setPeers(payload.peers)
        // 신규 입장자인 내가 기존 참가자 모두에게 offer를 보낸다
        for (const peer of payload.peers) {
          try {
            createConn(peer.id, true)
          } catch (err) {
            console.error('피어 연결 생성 실패', err)
          }
        }
      },
    )

    socket.on('peer-joined', (peer: PeerInfo) => {
      setPeers((prev) => [...prev.filter((p) => p.id !== peer.id), peer])
      // 신규 입장자의 offer를 받을 빈 연결만 준비해 둔다
      try {
        createConn(peer.id, false)
      } catch (err) {
        console.error('피어 연결 생성 실패', err)
      }
    })

    socket.on('peer-left', ({ id }: { id: string }) => {
      closeConn(id)
      setPeers((prev) => prev.filter((p) => p.id !== id))
    })

    socket.on('media-state', ({ id, media: next }: { id: string; media: MediaState }) => {
      setPeers((prev) => prev.map((p) => (p.id === id ? { ...p, media: next } : p)))
    })

    socket.on('chat', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg])
    })

    // perfect negotiation 패턴(MDN): 양쪽이 동시에 offer를 보내는 glare 상황을
    // polite/impolite 역할로 해소한다.
    socket.on(
      'signal',
      async (payload: {
        from: string
        description?: RTCSessionDescriptionInit
        candidate?: RTCIceCandidateInit
      }) => {
        let conn = connsRef.current.get(payload.from)
        if (!conn) {
          try {
            conn = createConn(payload.from, false)
          } catch (err) {
            console.error('피어 연결 생성 실패', err)
            return
          }
        }
        const { pc } = conn
        try {
          if (payload.description) {
            const collision =
              payload.description.type === 'offer' &&
              (conn.makingOffer || pc.signalingState !== 'stable')
            conn.ignoreOffer = !conn.polite && collision
            if (conn.ignoreOffer) return
            await pc.setRemoteDescription(payload.description)
            if (payload.description.type === 'offer') {
              adoptTransceivers(conn)
              await pc.setLocalDescription()
              socket.emit('signal', { to: payload.from, description: pc.localDescription })
            }
          } else if (payload.candidate) {
            try {
              await pc.addIceCandidate(payload.candidate)
            } catch (err) {
              if (!conn.ignoreOffer) console.error('ICE candidate 추가 실패', err)
            }
          }
        } catch (err) {
          console.error('시그널 처리 실패', err)
        }
      },
    )

    socket.on('connect_error', () => {
      setStatus((prev) => (prev === 'connected' ? prev : 'error'))
    })

    socket.on('disconnect', () => {
      setStatus('connecting')
    })

    const init = async () => {
      try {
        const res = await fetch(`${SERVER_URL ?? ''}/api/ice`)
        if (res.ok) {
          const data = (await res.json()) as { iceServers?: RTCIceServer[] }
          if (data.iceServers?.length) iceServersRef.current = data.iceServers
        }
      } catch {
        /* 기본 STUN 서버 사용 */
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        micTrackRef.current = stream.getAudioTracks()[0]
        mediaRef.current = { ...mediaRef.current, audio: true }
        setMedia(mediaRef.current)
      } catch {
        if (!disposed) showNotice('마이크 권한이 없어 음소거 상태로 참여합니다.')
      }
      if (!disposed) socket.connect()
    }
    void init()

    return () => {
      disposed = true
      window.clearTimeout(noticeTimerRef.current)
      micTrackRef.current?.stop()
      cameraTrackRef.current?.stop()
      screenTrackRef.current?.stop()
      micTrackRef.current = null
      cameraTrackRef.current = null
      screenTrackRef.current = null
      for (const id of [...connsRef.current.keys()]) closeConn(id)
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [roomId, userName, createConn, closeConn, adoptTransceivers, showNotice])

  // 모든 피어에게 내보내는 영상 트랙을 교체하고 로컬 미리보기를 갱신
  const applyVideoTrack = useCallback(async (track: MediaStreamTrack | null) => {
    for (const conn of connsRef.current.values()) {
      try {
        await conn.videoSender?.replaceTrack(track)
      } catch (err) {
        console.error('영상 트랙 교체 실패', err)
      }
    }
    setLocalStream(track ? new MediaStream([track]) : null)
  }, [])

  const toggleMic = useCallback(async () => {
    const current = mediaRef.current
    if (micTrackRef.current) {
      micTrackRef.current.enabled = !current.audio
      emitMedia({ ...current, audio: !current.audio })
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micTrackRef.current = stream.getAudioTracks()[0]
      for (const conn of connsRef.current.values()) {
        try {
          await conn.audioSender?.replaceTrack(micTrackRef.current)
        } catch (err) {
          console.error('오디오 트랙 교체 실패', err)
        }
      }
      emitMedia({ ...current, audio: true })
    } catch {
      showNotice('마이크를 사용할 수 없습니다. 브라우저 권한을 확인해 주세요.')
    }
  }, [emitMedia, showNotice])

  const toggleCamera = useCallback(async () => {
    const current = mediaRef.current
    if (current.video) {
      cameraTrackRef.current?.stop()
      cameraTrackRef.current = null
      if (!current.screen) await applyVideoTrack(null)
      emitMedia({ ...current, video: false })
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      const track = stream.getVideoTracks()[0]
      cameraTrackRef.current = track
      // 화면 공유 중이면 공유 화면이 우선, 카메라는 공유 종료 후 복귀
      if (!current.screen) await applyVideoTrack(track)
      emitMedia({ ...current, video: true })
    } catch {
      showNotice('카메라를 사용할 수 없습니다. 브라우저 권한을 확인해 주세요.')
    }
  }, [applyVideoTrack, emitMedia, showNotice])

  const stopScreenShare = useCallback(async () => {
    screenTrackRef.current?.stop()
    screenTrackRef.current = null
    await applyVideoTrack(mediaRef.current.video ? cameraTrackRef.current : null)
    emitMedia({ ...mediaRef.current, screen: false })
  }, [applyVideoTrack, emitMedia])

  const toggleScreen = useCallback(async () => {
    if (mediaRef.current.screen) {
      await stopScreenShare()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      const track = stream.getVideoTracks()[0]
      screenTrackRef.current = track
      // 브라우저 자체 "공유 중지" 버튼으로 종료한 경우도 상태를 되돌린다
      track.addEventListener('ended', () => {
        void stopScreenShare()
      })
      await applyVideoTrack(track)
      emitMedia({ ...mediaRef.current, screen: true })
    } catch {
      /* 사용자가 화면 선택을 취소한 경우 */
    }
  }, [applyVideoTrack, emitMedia, stopScreenShare])

  const sendMessage = useCallback((text: string) => {
    const clean = text.trim()
    if (!clean) return
    socketRef.current?.emit('chat', { text: clean })
  }, [])

  return {
    status,
    selfId,
    peers,
    remoteStreams,
    messages,
    media,
    localStream,
    notice,
    toggleMic,
    toggleCamera,
    toggleScreen,
    sendMessage,
  }
}
