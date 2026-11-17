import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { App } from './App'

const start = () => createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)

// The static demo (vite build --mode demo) answers /api from memory; the normal build never loads src/mock.
if (import.meta.env.MODE === 'demo') void import('./mock/boot').then(m => m.boot()).then(start)
else start()
