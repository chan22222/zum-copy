export interface MediaState {
  audio: boolean
  video: boolean
  screen: boolean
}

export interface PeerInfo {
  id: string
  name: string
  media: MediaState
}

export interface ChatMessage {
  id: string
  peerId: string
  name: string
  text: string
  ts: number
  system?: boolean
}
