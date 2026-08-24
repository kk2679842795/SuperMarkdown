// 验证图标 PNG 像素采样
import { app, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 200, height: 200, webPreferences: { sandbox: true } })
  const png = fs.readFileSync(path.join(__dirname, '..', 'build', 'icon.png')).toString('base64')
  const html =
    '<script>' +
    `const img = new Image();
img.onload = () => {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 1024
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0)
  const px = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data).slice(0, 4)
  const pts = [[2,2],[4,4],[6,6],[8,8],[12,12],[16,16],[24,24],[32,32],[48,48],[62,62],[63,64],[66,66],[70,70],[90,90],[128,128],[256,256],[512,110],[330,500],[700,500],[760,760],[512,640]]
  window.__r = pts.map(([x,y]) => ({ p: x + ',' + y, c: px(x, y) }))
}
img.src = 'data:image/png;base64,${png}'` +
    '</script>'
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  for (let i = 0; i < 20; i++) {
    const r = await win.webContents.executeJavaScript('window.__r || null')
    if (r) {
      console.log(JSON.stringify(r, null, 0))
      break
    }
    await new Promise((res) => setTimeout(res, 200))
  }
  app.quit()
})
