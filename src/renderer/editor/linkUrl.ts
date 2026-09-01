// 归一化链接地址：形如域名的输入（如 www.baidu.com）补全 https:// 前缀；协议/锚点/相对路径原样保留
export function normalizeHref(raw: string): string {
  const s = raw.trim()
  if (!s) return s
  if (/^(https?|ftp|file|mailto|tel|data|blob|smimg):/i.test(s)) return s
  if (s.startsWith('#') || s.startsWith('/') || s.startsWith('./') || s.startsWith('../')) return s
  if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(s)) return 'https://' + s
  return s
}