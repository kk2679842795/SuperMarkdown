import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' 保证打包后通过 file:// 协议加载（Electron 生产环境）
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    target: 'chrome120',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'zustand'],
          prosemirror: [
            'prosemirror-state',
            'prosemirror-model',
            'prosemirror-view',
            'prosemirror-commands',
            'prosemirror-keymap',
            'prosemirror-history',
            'prosemirror-inputrules',
            'prosemirror-schema-list',
            'prosemirror-gapcursor',
            'prosemirror-dropcursor',
            'prosemirror-markdown',
            'markdown-it',
          ],
          katex: ['katex'],
          mermaid: ['mermaid'],
          highlight: ['highlight.js'],
        },
      },
    },
  },
})
