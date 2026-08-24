#!/usr/bin/env node
// 打包 MSIX（Microsoft Store 格式）
// 前置条件：
//   1. 已执行 npm run dist:win（产出 release/win-unpacked）
//   2. 本机已安装 Windows SDK（提供 makeappx.exe / makepri.exe / signtool.exe）
//   3. 签名证书（正式上架用 Partner Center 的证书；本地测试用 build/certs/sm-test.pfx）
// 用法：npm run dist:msix
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))

const inputDir = path.join(root, 'release', 'win-unpacked')
const outDir = path.join(root, 'release', 'msix')
if (!fs.existsSync(inputDir)) {
  console.error('未找到 release/win-unpacked，请先执行 npm run dist:win')
  process.exit(1)
}

// 检测 Windows SDK
const sdkCandidates = [
  'C:/Program Files (x86)/Windows Kits/10/bin',
  'C:/Program Files/Windows Kits/10/bin',
]
let kitBin = null
for (const base of sdkCandidates) {
  if (!fs.existsSync(base)) continue
  const versions = fs.readdirSync(base).sort().reverse()
  for (const v of versions) {
    const bin = path.join(base, v, 'x64')
    if (fs.existsSync(path.join(bin, 'makeappx.exe'))) {
      kitBin = bin
      break
    }
  }
  if (kitBin) break
}
if (!kitBin) {
  console.error(
    '未找到 Windows SDK（需要 makeappx.exe）。\n' +
      '请先安装 Windows SDK：winget install Microsoft.WindowsSDK.10.0.26100\n' +
      '或在 GitHub Actions (windows-latest) 上构建（自带 SDK）。',
  )
  process.exit(1)
}
console.log('使用 Windows Kit:', kitBin)

const cert = path.join(root, 'build', 'certs', 'sm-test.pfx')
const args = [
  '-i', inputDir,
  '-o', outDir,
  '-p', pkg.version,
  '-n', 'SuperMarkdown',
  '--identity-name', 'com.supermarkdown.app',
  '--package-display-name', 'SuperMarkdown',
  '--package-description', '免费开源的跨平台所见即所得 Markdown 编辑器',
  '--publisher', 'CN=SuperMarkdown Test',
  '--publisher-display-name', 'SuperMarkdown Contributors',
  '--dev-cert', cert,
  '--cert-pass', 'test1234',
  '--assets', path.join(root, 'build'),
  '--windows-kit', kitBin,
]

console.log('electron-windows-store', args.join(' '))
execSync('npx electron-windows-store ' + args.map(a => `"${a}"`).join(' '), {
  stdio: 'inherit',
  cwd: root,
})
console.log('MSIX 已输出到 release/msix')
