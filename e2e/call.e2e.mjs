// 실제 브라우저 E2E: WebRTC 통화 연결, 미디어 송수신, 채팅, 화면 공유, 3인 mesh
// 사전 조건: 프로덕션 빌드가 서빙 중 (npm run build && npm start)
// 실행: npm run test:e2e  (시스템 Chrome 또는 Edge 사용 — 별도 브라우저 다운로드 없음)
import { chromium } from 'playwright'

const APP = process.env.E2E_URL ?? 'http://localhost:3001'
const suffix = Math.random().toString(36).slice(2, 8)
let failed = 0

const check = (label, cond) => {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}`)
  if (!cond) failed += 1
}

const launchArgs = [
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  '--auto-select-desktop-capture-source=Entire screen',
  '--autoplay-policy=no-user-gesture-required',
]

async function launchBrowser() {
  for (const channel of ['chrome', 'msedge']) {
    try {
      return await chromium.launch({ channel, headless: true, args: launchArgs })
    } catch {
      /* 해당 채널 미설치 — 다음 후보 시도 */
    }
  }
  throw new Error('Chrome 또는 Edge가 필요합니다.')
}

const browser = await launchBrowser()

async function join(room, name) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const page = await context.newPage()
  page.on('pageerror', (err) => console.log(`  [${name} pageerror] ${err.message}`))
  await page.goto(`${APP}/?room=${room}`)
  await page.fill('#lobby-name', name)
  await page.getByRole('button', { name: '통화 참여' }).click()
  return page
}

// 원격 참가자들에게서 실제 오디오 RTP가 도착 중인지 (track.muted === false)
const audioReceivingCount = (page) =>
  page.evaluate(() => {
    const remotes = [...document.querySelectorAll('video')].filter((v) => !v.muted)
    return remotes.filter((v) => {
      const stream = v.srcObject
      return stream && stream.getAudioTracks().some((t) => t.readyState === 'live' && !t.muted)
    }).length
  })

try {
  // ─── 2인 통화 시나리오 ───
  const room = `e2e-${suffix}`
  const alice = await join(room, 'Alice')
  await alice.getByText('1명 참여 중').waitFor({ timeout: 10000 })
  check('Alice 입장 후 참가자 1명 표시', true)

  const bob = await join(room, 'Bob')
  await alice.getByText('2명 참여 중').waitFor({ timeout: 10000 })
  await bob.getByText('2명 참여 중').waitFor({ timeout: 10000 })
  check('양쪽 모두 참가자 2명 표시', true)

  await bob.waitForFunction(
    () => {
      const remote = [...document.querySelectorAll('video')].find((v) => !v.muted)
      const stream = remote?.srcObject
      return !!stream && stream.getAudioTracks().some((t) => t.readyState === 'live' && !t.muted)
    },
    undefined,
    { timeout: 15000 },
  )
  check('Bob이 Alice의 오디오를 실제 수신 중 (RTP 도착)', true)

  await alice.getByRole('button', { name: '카메라 켜기' }).click()
  await bob.waitForFunction(
    () => {
      const remote = [...document.querySelectorAll('video')].find((v) => !v.muted)
      return !!remote && remote.videoWidth > 0 && !remote.paused
    },
    undefined,
    { timeout: 15000 },
  )
  check('Alice 카메라 영상이 Bob에게 도착해 재생 중', true)

  await alice.fill('#chat-input', '리뷰 시작하겠습니다')
  await alice.press('#chat-input', 'Enter')
  await bob.getByText('리뷰 시작하겠습니다').waitFor({ timeout: 10000 })
  check('Alice의 채팅이 Bob에게 표시', true)

  await alice.getByRole('button', { name: '화면 공유 시작' }).click()
  await bob.getByText('화면 공유 중').first().waitFor({ timeout: 15000 })
  check('Alice 화면 공유가 Bob에게 스테이지로 표시', true)

  await bob.getByRole('button', { name: '통화 나가기' }).click()
  await alice.getByText('1명 참여 중').waitFor({ timeout: 10000 })
  check('Bob 퇴장 후 Alice 화면 참가자 1명', true)
  await alice.context().close()
  await bob.context().close()

  // ─── 3인 mesh 시나리오 ───
  const meshRoom = `mesh-${suffix}`
  const pages = []
  for (const name of ['Ann', 'Ben', 'Cho']) {
    pages.push([name, await join(meshRoom, name)])
  }
  for (const [name, page] of pages) {
    await page.getByText('3명 참여 중').waitFor({ timeout: 10000 })
    await page.waitForFunction(
      () => {
        const remotes = [...document.querySelectorAll('video')].filter((v) => !v.muted)
        return (
          remotes.length === 2 &&
          remotes.every((v) => {
            const stream = v.srcObject
            return stream && stream.getAudioTracks().some((t) => t.readyState === 'live' && !t.muted)
          })
        )
      },
      undefined,
      { timeout: 15000 },
    )
    check(`3인 mesh: ${name}이 나머지 2명 모두에게서 오디오 수신`, (await audioReceivingCount(page)) === 2)
  }
} catch (err) {
  console.log(`FAIL — ${err.message.split('\n')[0]}`)
  failed += 1
} finally {
  await browser.close()
}

console.log(failed === 0 ? '\nE2E 테스트 모두 통과' : `\n${failed}개 실패`)
process.exit(failed === 0 ? 0 : 1)
