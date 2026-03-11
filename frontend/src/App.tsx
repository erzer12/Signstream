import { useRef, useState, useCallback, useEffect } from 'react'
import { useInference } from '@/hooks/useInference'
import CameraView from '@/components/CameraView'
import PredictionBadge from '@/components/PredictionBadge'
import ConfidenceBar from '@/components/ConfidenceBar'
import HistoryFeed from '@/components/HistoryFeed'
import StatusBar from '@/components/StatusBar'
import Settings from '@/components/Settings'
import RecordMode from '@/components/RecordMode'
import CaptionBuffer from '@/components/CaptionBuffer'

export default function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [running, setRunning] = useState(true)
  const [threshold, setThreshold] = useState(0.45)
  const [recordOpen, setRecordOpen] = useState(false)
  const [signNames, setSignNames] = useState<string[]>([])
  const [captionText, setCaptionText] = useState('')

  // Fetch sign names from model meta once on mount
  useEffect(() => {
    fetch('/models/model_meta.json')
      .then(r => r.json())
      .then((m: { sign_names: string[] }) => setSignNames(m.sign_names))
      .catch(e => console.error('Failed to load model_meta.json', e))
  }, [])

  const handleVideoReady = useCallback(
    (video: HTMLVideoElement, canvas: HTMLCanvasElement) => {
      videoRef.current = video
      canvasRef.current = canvas
    },
    [],
  )

  const { state, clearHistory, latestFrameRef } = useInference(videoRef, canvasRef, running, threshold)

  // Accumulate captions when a new stable prediction arrives
  useEffect(() => {
    if (state.history.length === 0) return
    const latest = state.history[0]
    
    // Simple debounce/deduplication based on the prediction timestamp
    // The history array creates a new entry only when the stabilized sign changes.
    setCaptionText(prev => {
        const sign = latest.label.toLowerCase()
        if (sign === 'space') {
            return prev + ' '
        } else if (sign === 'clear') {
            // Delete the last word (everything after the last space)
            const parts = prev.trimEnd().split(' ')
            parts.pop() // Remove the last part
            return parts.length > 0 ? parts.join(' ') + ' ' : ''
        } else if (sign === 'del' || sign === 'backspace') {
            return prev.slice(0, -1)
        } else if (sign.length === 1 && /^[a-z]$/i.test(sign)) {
            // Append single letters
            return prev + sign
        }
        return prev
    })
  }, [state.history])

  return (
    <div className="app-shell">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg,#2dd4bf,#7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(45,212,191,.25)',
          }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>S</span>
          </div>
          <div>
            <div className="gradient-text" style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.1 }}>
              SignStream
            </div>
            <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.2 }}>Real-time ASL Recognition</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#334155', fontFamily: 'JetBrains Mono, monospace' }}>
            132 signs
          </span>
          <span style={{ color: '#1e293b' }}>·</span>
          <span style={{ fontSize: 12, color: '#334155' }}>GRU v3</span>
          <span style={{ color: '#1e293b' }}>·</span>
          <span style={{
            fontSize: 12, color: '#1d4ed8', background: 'rgba(59,130,246,.08)',
            padding: '2px 8px', borderRadius: 99, border: '1px solid rgba(59,130,246,.15)'
          }}>
            Client-side
          </span>
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main className="app-content">
        <div className="col-camera">
          <StatusBar
            status={state.status}
            errorMsg={state.errorMsg}
            e2eLatency={state.e2eLatency}
            onnxLatency={state.onnxLatency}
            onRecordClick={() => setRecordOpen(true)}
          />
          <div style={{ position: 'relative', width: '100%', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <CameraView
              onVideoReady={handleVideoReady}
              landmarks={state.landmarks}
              isRunning={running}
            />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 }}>
              <CaptionBuffer 
                text={captionText} 
                onClear={() => setCaptionText('')} 
              />
            </div>
          </div>
        </div>

        <div className="col-panel">
          <PredictionBadge
            prediction={state.prediction}
            confidence={state.confidence}
            handedness={state.handedness}
          />
          <ConfidenceBar confidence={state.confidence} topK={state.topK} />
          <HistoryFeed history={state.history} onClear={clearHistory} />
          <Settings
            threshold={threshold}
            onThresholdChange={setThreshold}
            isRunning={running}
            onToggle={() => setRunning(r => !r)}
          />
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="app-footer">
        Client-side · No data leaves your device · MediaPipe + ONNX Runtime Web
      </footer>

      {/* ── Record Mode Modal ───────────────────────────────────────────── */}
      {recordOpen && (
        <RecordMode
          signNames={signNames}
          latestFrameRef={latestFrameRef}
          onClose={() => setRecordOpen(false)}
        />
      )}
    </div>
  )
}
