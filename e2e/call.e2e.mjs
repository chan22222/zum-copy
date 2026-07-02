// 실제 브라우저 E2E: WebRTC 통화 연결, 미디어 송수신, 채팅, 화면 공유, 볼륨, 전체화면, 3인 mesh
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

// 재생 중인 원격 오디오 수 (audio 요소가 실제 재생 + RTP 도착)
const audioPlayingCount = (page) =>
  page.evaluate(() => {
    return [...document.querySelectorAll('audio')].filter((a) => {
      const stream = a.srcObject
      return (
        stream &&
        !a.paused &&
        stream.getAudioTracks().some((t) => t.readyState === 'live' && !t.muted)
      )
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

  // 핵심: 상대가 카메라/화면공유를 켜지 않아도 오디오가 실제 "재생"되어야 한다
  await bob.waitForFunction(
    () => {
      return [...document.querySelectorAll('audio')].some((a) => {
        const stream = a.srcObject
        return (
          stream &&
          !a.paused &&
          a.currentTime > 0 &&
          stream.getAudioTracks().some((t) => t.readyState === 'live' && !t.muted)
        )
      })
    },
    undefined,
    { timeout: 15000 },
  )
  check('영상 없이도 Bob이 Alice의 오디오를 실제 재생 중', true)

  // 볼륨 슬라이더 → audio 요소 volume 반영
  const slider = bob.locator('input[type="range"]').first()
  await slider.evaluate((el) => {
    // React 제어 컴포넌트는 네이티브 setter로 값을 넣어야 onChange가 발화한다
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(el, '0.3')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const volumeApplied = await bob.evaluate(() => {
    const audio = document.querySelector('audio')
    return audio ? Math.abs(audio.volume - 0.3) < 0.001 : false
  })
  check('볼륨 슬라이더가 원격 오디오 볼륨에 반영', volumeApplied)

  await alice.getByRole('button', { name: '카메라 켜기' }).click()
  await bob.waitForFunction(
    () => {
      const remote = [...document.querySelectorAll('video')].find((v) => v.srcObject)
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
  await alice.getByRole('button', { name: '화면 공유 중지' }).click()

  // 더블클릭 → 전체화면 오버레이 + 채팅 토글
  await bob.locator('div.group').nth(1).dblclick()
  await bob.locator('div.fixed.inset-0').waitFor({ timeout: 5000 })
  check('타일 더블클릭으로 전체화면 오버레이 표시', true)
  const chatVisibleInFs = await bob
    .locator('div.fixed.inset-0 aside')
    .isVisible()
    .catch(() => false)
  check('전체화면 안에 반투명 채팅 표시', chatVisibleInFs)
  await bob.getByRole('button', { name: '채팅 숨기기' }).click()
  const chatHidden = (await bob.locator('div.fixed.inset-0 aside').count()) === 0
  check('전체화면 채팅 on/off 토글 동작', chatHidden)
  await bob.getByRole('button', { name: '전체화면 종료' }).click()
  const overlayGone = (await bob.locator('div.fixed.inset-0').count()) === 0
  check('전체화면 종료 버튼 동작', overlayGone)

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
        const audios = [...document.querySelectorAll('audio')]
        return (
          audios.length === 2 &&
          audios.every((a) => {
            const stream = a.srcObject
            return (
              stream &&
              !a.paused &&
              stream.getAudioTracks().some((t) => t.readyState === 'live' && !t.muted)
            )
          })
        )
      },
      undefined,
      { timeout: 15000 },
    )
    check(`3인 mesh: ${name}이 나머지 2명 오디오 재생 중`, (await audioPlayingCount(page)) === 2)
  }
} catch (err) {
  console.log(`FAIL — ${err.message.split('\n')[0]}`)
  failed += 1
} finally {
  await browser.close()
}

console.log(failed === 0 ? '\nE2E 테스트 모두 통과' : `\n${failed}개 실패`)
process.exit(failed === 0 ? 0 : 1)
