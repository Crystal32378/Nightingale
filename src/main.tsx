import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Last300mPage } from './remote/Last300mPage'
import { App } from './ui/App'
import './ui/styles.css'

// ?flow=last300m mounts the outdoor flow; everything else boots the
// indoor experience exactly as before.
const flow = new URLSearchParams(window.location.search).get('flow')

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(
    <StrictMode>{flow === 'last300m' ? <Last300mPage /> : <App />}</StrictMode>,
  )
}
