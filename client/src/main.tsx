import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// StrictMode는 사용하지 않는다: 개발 모드의 이중 마운트가
// 소켓 접속과 WebRTC 협상을 중복 실행해 통화 상태를 깨뜨린다.
createRoot(document.getElementById('root')!).render(<App />)
