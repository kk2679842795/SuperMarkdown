// 导出文档所用的排版样式（与编辑器内 CSS 对应，但独立自包含）
export const exportProseCss = `
article.prose { font-size: 16px; line-height: 1.75; }
article.prose h1, article.prose h2, article.prose h3, article.prose h4, article.prose h5, article.prose h6 {
  font-weight: 600; margin: 1.4em 0 0.6em; line-height: 1.35;
}
article.prose h1 { font-size: 1.9em; border-bottom: 1px solid #e4e4e9; padding-bottom: 0.3em; }
article.prose h2 { font-size: 1.5em; }
article.prose h3 { font-size: 1.25em; }
article.prose p { margin: 0.7em 0; }
article.prose blockquote {
  border-left: 4px solid #d0d7de; background: #f6f8fa; margin: 1em 0;
  padding: 0.4em 1em; border-radius: 0 8px 8px 0; color: #57606a;
}
article.prose ul, article.prose ol { padding-left: 1.8em; margin: 0.6em 0; }
article.prose li { margin: 0.25em 0; }
article.prose li[data-checked] { list-style: none; position: relative; padding-left: 1.7em; }
article.prose li[data-checked]::before {
  content: ''; position: absolute; left: 0.1em; top: 0.32em; width: 1.05em; height: 1.05em;
  border: 2px solid #9aa; border-radius: 4px; background: #fff;
}
article.prose li[data-checked="true"]::before { background: #2ea043; border-color: #2ea043; }
article.prose li[data-checked="true"]::after {
  content: '\\2713'; position: absolute; left: 0.2em; top: 0.16em; color: #fff; font-size: 0.85em; line-height: 1;
}
article.prose a { color: #4f6ef7; text-decoration: none; border-bottom: 1px solid rgba(79,110,247,.3); }
article.prose hr { border: none; border-top: 2px dashed #d8d9de; margin: 1.6em 0; }
article.prose img { max-width: 100%; border-radius: 6px; }
article.prose code {
  font-family: 'Cascadia Code', 'JetBrains Mono', Consolas, monospace; font-size: 0.88em;
  background: #f0f1f5; padding: 0.15em 0.4em; border-radius: 4px;
}
article.prose pre { background: #0d1117; color: #e6edf3; border-radius: 10px; padding: 14px 16px; overflow-x: auto; }
article.prose pre code { background: transparent; padding: 0; color: inherit; font-size: 13.5px; line-height: 1.6; }
article.prose table { border-collapse: collapse; margin: 1em 0; width: 100%; }
article.prose th, article.prose td { border: 1px solid #d8d9de; padding: 8px 12px; text-align: left; }
article.prose th { background: #f0f1f5; font-weight: 600; }
article.prose .math-display { text-align: center; margin: 1.2em 0; overflow-x: auto; }
article.prose .mermaid-export { display: flex; justify-content: center; margin: 1.2em 0; }
article.prose .mermaid-export svg { max-width: 100%; height: auto; }
article.prose .mermaid-error { color: #d1242f; }
body[data-theme="dark"] article.prose h1 { border-color: #33333a; }
body[data-theme="dark"] article.prose blockquote { border-color: #3a3a42; background: #232329; color: #a0a0a8; }
body[data-theme="dark"] article.prose code { background: #2a2a30; }
body[data-theme="dark"] article.prose th, body[data-theme="dark"] article.prose td { border-color: #3a3a42; }
body[data-theme="dark"] article.prose th { background: #26262c; }
body[data-theme="dark"] article.prose a { color: #7b94ff; }
body[data-theme="dark"] article.prose li[data-checked]::before { background: #1b1b1f; border-color: #6f6f78; }
`
