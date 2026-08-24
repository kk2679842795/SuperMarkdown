import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/global.css'
import './editor/katexEmbedded.css'
import 'highlight.js/styles/github-dark.css'

createRoot(document.getElementById('root')!).render(<App />)
