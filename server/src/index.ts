import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { Server } from 'socket.io'

interface MediaState {
  audio: boolean
  video: boolean
  screen: boolean
}

interface RoomPeer {
  name: string
  media: MediaState
}

interface ChatMessage {
  id: string
  peerId: string
  name: string
  text: string
  ts: number
  system?: boolean
}

interface Room {
  peers: Map<string, RoomPeer>
  chat: ChatMessage[]
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 3001)
const CHAT_HISTORY_LIMIT = 200
const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim())

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: corsOrigin ?? true },
  maxHttpBufferSize: 1e6,
})

const rooms = new Map<string, Room>()

function sanitizeMedia(value: unknown): MediaState {
  const v = (value ?? {}) as Record<string, unknown>
  return { audio: v.audio === true, video: v.video === true, screen: v.screen === true }
}

function pushMessage(roomId: string, room: Room, msg: ChatMessage): void {
  room.chat.push(msg)
  if (room.chat.length > CHAT_HISTORY_LIMIT) room.chat.shift()
  io.to(roomId).emit('chat', msg)
}

function systemMessage(roomId: string, room: Room, text: string): void {
  pushMessage(roomId, room, {
    id: randomUUID(),
    peerId: 'system',
    name: 'system',
    text,
    ts: Date.now(),
    system: true,
  })
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size })
})

// 클라이언트가 RTCPeerConnection을 만들 때 사용할 ICE 서버 목록.
// 사내망/엄격한 NAT 환경 지원이 필요하면 TURN_* 환경 변수를 설정한다.
app.get('/api/ice', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', corsOrigin?.[0] ?? '*')
  const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
  if (process.env.TURN_URL) {
    // 쉼표로 여러 URL 지정 가능 (예: UDP용 + 방화벽 우회용 TCP/TLS)
    iceServers.push({
      urls: process.env.TURN_URL.split(',').map((url) => url.trim()),
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    })
  }
  res.json({ iceServers })
})

io.on('connection', (socket) => {
  socket.on('join', (payload: { roomId?: unknown; name?: unknown; media?: unknown }) => {
    try {
      const roomId =
        typeof payload?.roomId === 'string' ? payload.roomId.trim().toLowerCase().slice(0, 40) : ''
      if (!roomId) return
      const name = (
        typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : '익명'
      ).slice(0, 30)
      const media = sanitizeMedia(payload.media)

      let room = rooms.get(roomId)
      if (!room) {
        room = { peers: new Map(), chat: [] }
        rooms.set(roomId, room)
      }
      const peers = [...room.peers.entries()].map(([id, peer]) => ({
        id,
        name: peer.name,
        media: peer.media,
      }))
      room.peers.set(socket.id, { name, media })
      socket.data.roomId = roomId
      void socket.join(roomId)

      socket.emit('joined', { selfId: socket.id, peers, chat: room.chat })
      socket.to(roomId).emit('peer-joined', { id: socket.id, name, media })
      systemMessage(roomId, room, `${name}님이 참여했습니다.`)
    } catch (err) {
      console.error('join 처리 실패', err)
    }
  })

  // WebRTC 시그널(offer/answer/ICE candidate)을 같은 방 참가자에게만 중계
  socket.on('signal', (payload: { to?: unknown; description?: unknown; candidate?: unknown }) => {
    try {
      const roomId = socket.data.roomId as string | undefined
      if (!roomId || typeof payload?.to !== 'string') return
      const room = rooms.get(roomId)
      if (!room?.peers.has(payload.to)) return
      io.to(payload.to).emit('signal', {
        from: socket.id,
        description: payload.description,
        candidate: payload.candidate,
      })
    } catch (err) {
      console.error('signal 중계 실패', err)
    }
  })

  socket.on('chat', (payload: { text?: unknown }) => {
    try {
      const roomId = socket.data.roomId as string | undefined
      if (!roomId || typeof payload?.text !== 'string') return
      const room = rooms.get(roomId)
      const peer = room?.peers.get(socket.id)
      if (!room || !peer) return
      const text = payload.text.trim().slice(0, 2000)
      if (!text) return
      pushMessage(roomId, room, {
        id: randomUUID(),
        peerId: socket.id,
        name: peer.name,
        text,
        ts: Date.now(),
      })
    } catch (err) {
      console.error('chat 처리 실패', err)
    }
  })

  socket.on('media-state', (payload: unknown) => {
    try {
      const roomId = socket.data.roomId as string | undefined
      if (!roomId) return
      const room = rooms.get(roomId)
      const peer = room?.peers.get(socket.id)
      if (!room || !peer) return
      peer.media = sanitizeMedia(payload)
      socket.to(roomId).emit('media-state', { id: socket.id, media: peer.media })
    } catch (err) {
      console.error('media-state 처리 실패', err)
    }
  })

  socket.on('disconnect', () => {
    try {
      const roomId = socket.data.roomId as string | undefined
      if (!roomId) return
      const room = rooms.get(roomId)
      if (!room) return
      const peer = room.peers.get(socket.id)
      room.peers.delete(socket.id)
      socket.to(roomId).emit('peer-left', { id: socket.id })
      if (room.peers.size === 0) {
        rooms.delete(roomId)
      } else if (peer) {
        systemMessage(roomId, room, `${peer.name}님이 나갔습니다.`)
      }
    } catch (err) {
      console.error('disconnect 처리 실패', err)
    }
  })
})

// 프로덕션에서는 빌드된 클라이언트를 같은 서버에서 서빙 (Railway 단일 서비스 배포)
const clientDist = path.resolve(__dirname, '../../client/dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
      res.sendFile(path.join(clientDist, 'index.html'))
    } else {
      next()
    }
  })
}

httpServer.listen(PORT, () => {
  console.log(`[cord] server listening on :${PORT}`)
})
