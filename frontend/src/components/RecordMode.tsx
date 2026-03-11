import { useState, useRef, useEffect, useCallback } from 'react'

// ── Constants ──────────────────────────────────────────────────────────────────
const N_FEATURES = 63
const SEQ_LENGTH = 16
const RECORD_FRAMES = 48   // ~1.6 s at 30 fps
const WINDOW_STRIDE = 4
const TAKES_GOAL = 20
const ZERO_FRAME_ARR = new Array<number>(N_FEATURES).fill(0)

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = 'idle' | 'countdown' | 'recording' | 'saved'

interface CaptureEntry {
    label: string
    sequences: number[][]  // each element: 16*63 = 1008 numbers
}

interface Props {
    signNames: string[]
    latestFrameRef: React.MutableRefObject<number[] | null>
    onClose: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract overlapping 16-frame windows with stride 4 from a raw 48-frame buffer */
function extractWindows(rawFrames: number[][]): number[][] {
    const windows: number[][] = []
    const padded = rawFrames.length >= SEQ_LENGTH
        ? rawFrames
        : [...new Array(SEQ_LENGTH - rawFrames.length).fill(ZERO_FRAME_ARR), ...rawFrames]

    for (let start = 0; start + SEQ_LENGTH <= padded.length; start += WINDOW_STRIDE) {
        const window: number[] = []
        for (let t = start; t < start + SEQ_LENGTH; t++) {
            window.push(...padded[t])
        }
        windows.push(window)
    }
    return windows
}

function downloadJson(data: unknown, filename: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RecordMode({ signNames, latestFrameRef, onClose }: Props) {
    const [search, setSearch] = useState('')
    const [selectedSign, setSelectedSign] = useState<string | null>(signNames[0] ?? null)
    const [phase, setPhase] = useState<Phase>('idle')
    const [countdown, setCountdown] = useState(3)
    const [captures, setCaptures] = useState<CaptureEntry[]>([])
    const [lastTakeCount, setLastTakeCount] = useState(0)
    const [previewing, setPreviewing] = useState<boolean>(false)
    const [previewFrameIdx, setPreviewFrameIdx] = useState(0)

    // Refs to avoid stale closures inside rAF / intervals
    const selectedSignRef = useRef<string | null>(selectedSign)
    const rawFramesRef = useRef<number[][]>([])
    const rafRef = useRef<number | null>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const phaseRef = useRef<Phase>('idle')

    useEffect(() => { selectedSignRef.current = selectedSign }, [selectedSign])
    useEffect(() => { phaseRef.current = phase }, [phase])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
            if (intervalRef.current != null) clearInterval(intervalRef.current)
        }
    }, [])

    // ── Take counter helpers ───────────────────────────────────────────────────
    const getTakeCount = useCallback((label: string) => {
        const entry = captures.find(c => c.label === label)
        if (!entry) return 0
        // Each take adds (RECORD_FRAMES - SEQ_LENGTH) / WINDOW_STRIDE + 1 windows
        // Reverse: count = sequences.length / windowsPerTake (approx)
        const windowsPerTake = Math.floor((RECORD_FRAMES - SEQ_LENGTH) / WINDOW_STRIDE) + 1
        return Math.round(entry.sequences.length / windowsPerTake)
    }, [captures])

    // ── Recording ─────────────────────────────────────────────────────────────
    const startCountdown = useCallback(() => {
        if (!selectedSignRef.current) return
        setPhase('countdown')
        setCountdown(3)

        let count = 3
        intervalRef.current = setInterval(() => {
            count--
            if (count <= 0) {
                clearInterval(intervalRef.current!)
                intervalRef.current = null
                startRecording()
            } else {
                setCountdown(count)
            }
        }, 1000)
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const startRecording = useCallback(() => {
        rawFramesRef.current = []
        setPhase('recording')

        const tick = () => {
            const frame = latestFrameRef.current
                ? [...latestFrameRef.current]
                : [...ZERO_FRAME_ARR]

            rawFramesRef.current.push(frame)

            if (rawFramesRef.current.length >= RECORD_FRAMES) {
                // Done — process and save
                const windows = extractWindows(rawFramesRef.current)
                const label = selectedSignRef.current!

                setCaptures(prev => {
                    const idx = prev.findIndex(c => c.label === label)
                    if (idx >= 0) {
                        const next = [...prev]
                        next[idx] = { label, sequences: [...next[idx].sequences, ...windows] }
                        return next
                    }
                    return [...prev, { label, sequences: windows }]
                })

                const windowsPerTake = Math.floor((RECORD_FRAMES - SEQ_LENGTH) / WINDOW_STRIDE) + 1
                setLastTakeCount(wpt => wpt + windowsPerTake) // trigger re-render indicator
                setPhase('saved')
                rafRef.current = null
                return
            }

            rafRef.current = requestAnimationFrame(tick)
        }

        rafRef.current = requestAnimationFrame(tick)
    }, [latestFrameRef])

    const handleRecord = useCallback(() => {
        if (phase !== 'idle' && phase !== 'saved') return
        if (!selectedSign) return
        setPreviewing(false) // Exit preview if recording again
        startCountdown()
    }, [phase, selectedSign, startCountdown])

    const startPreview = useCallback(() => {
        if (rawFramesRef.current.length === 0) return
        setPreviewing(true)
        setPreviewFrameIdx(0)
        
        let frame = 0
        const tick = () => {
            frame++
            if (frame >= rawFramesRef.current.length) {
                setPreviewing(false)
                rafRef.current = null
                return
            }
            setPreviewFrameIdx(frame)
            rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
    }, [])

    // ── Export ────────────────────────────────────────────────────────────────
    const handleExport = useCallback(() => {
        downloadJson({ version: 1, captures }, 'my_captures.json')
    }, [captures])

    // ── Filtered sign list ────────────────────────────────────────────────────
    const filtered = search.trim()
        ? signNames.filter(n => n.toLowerCase().includes(search.toLowerCase()))
        : signNames

    // ── Status box content ────────────────────────────────────────────────────
    const totalSequences = captures.reduce((acc, c) => acc + c.sequences.length, 0)

    const phaseInfo = (): { icon: string; text: string } => {
        switch (phase) {
            case 'idle': return { icon: '💡', text: 'Select a sign, then press Record. Hold the sign steady for ~1.6 s.' }
            case 'countdown': return { icon: '⏳', text: 'Get ready...' }
            case 'recording': return { icon: '🔴', text: 'Recording — hold the sign!' }
            case 'saved': return { icon: '✅', text: `Take saved! Press Record again for another take.` }
        }
    }

    const info = phaseInfo()
    const currentTakes = selectedSign ? getTakeCount(selectedSign) : 0
    const takePct = Math.min(100, (currentTakes / TAKES_GOAL) * 100)

    const canRecord = !!selectedSign && (phase === 'idle' || phase === 'saved')

    return (
        <div className="rm-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
            <div className="rm-modal">

                {/* ── Header ──────────────────────────────────────────────────── */}
                <div className="rm-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="rm-title">Record Mode</span>
                        <span className="rm-badge">
                            {totalSequences} seq · {captures.length} signs
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                            className="rm-export-btn"
                            onClick={handleExport}
                            disabled={captures.length === 0}
                            title="Download my_captures.json"
                        >
                            ↓ Export JSON
                        </button>
                        <button className="rm-close-btn" onClick={onClose} title="Close">✕</button>
                    </div>
                </div>

                {/* ── Body ────────────────────────────────────────────────────── */}
                <div className="rm-body">

                    {/* LEFT — Sign list */}
                    <div className="rm-sign-col">
                        <input
                            className="rm-search"
                            type="text"
                            placeholder="Search signs…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        <div className="rm-sign-list">
                            {filtered.map(name => {
                                const takes = getTakeCount(name)
                                const isDone = takes >= TAKES_GOAL
                                const isActive = name === selectedSign
                                return (
                                    <button
                                        key={name}
                                        className={`rm-sign-item${isActive ? ' rm-sign-active' : ''}${isDone ? ' rm-sign-done' : ''}`}
                                        onClick={() => {
                                            setSelectedSign(name)
                                            if (phase === 'saved') setPhase('idle')
                                        }}
                                    >
                                        <span className="rm-sign-name">{name}</span>
                                        <span className={`rm-take-badge${isDone ? ' rm-take-done' : ''}`}>
                                            {takes}/{TAKES_GOAL}
                                        </span>
                                    </button>
                                )
                            })}
                            {filtered.length === 0 && (
                                <p style={{ fontSize: 12, color: '#475569', textAlign: 'center', padding: '16px 0' }}>
                                    No signs match "{search}"
                                </p>
                            )}
                        </div>
                    </div>

                    {/* RIGHT — Recording panel */}
                    <div className="rm-record-col">

                        {/* Selected sign */}
                        <div className="rm-selected-sign">
                            {selectedSign ?? <span style={{ color: '#475569' }}>— select a sign —</span>}
                        </div>

                        {/* Progress bar */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                <span style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 500 }}>
                                    Takes
                                </span>
                                <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: currentTakes >= TAKES_GOAL ? '#4ade80' : '#94a3b8' }}>
                                    {currentTakes} / {TAKES_GOAL}
                                </span>
                            </div>
                            <div className="rm-progress-track">
                                <div
                                    className="rm-progress-fill"
                                    style={{
                                        width: `${takePct}%`,
                                        background: currentTakes >= TAKES_GOAL ? '#4ade80' : 'linear-gradient(90deg,#3b82f6,#7c3aed)',
                                    }}
                                />
                            </div>
                        </div>

                        {/* Countdown number */}
                        {phase === 'countdown' && (
                            <div className="rm-countdown">{countdown}</div>
                        )}

                        {/* Status box */}
                        <div className={`rm-info-box${phase === 'recording' ? ' rm-info-recording' : ''}`}>
                            <span style={{ fontSize: 18 }}>{info.icon}</span>
                            <span style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5, flex: 1 }}>{info.text}</span>
                            {phase === 'saved' && rawFramesRef.current.length > 0 && (
                                <button
                                    onClick={startPreview}
                                    disabled={previewing}
                                    style={{
                                        fontSize: 11, background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
                                        border: '1px solid rgba(59,130,246,0.3)', borderRadius: 6,
                                        padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap'
                                    }}
                                >
                                    {previewing ? 'Playing...' : '▶ Preview Last Take'}
                                </button>
                            )}
                        </div>

                        {/* Preview Canvas layer */}
                        {previewing && (
                            <div style={{
                                width: '100%', height: 180, background: '#07090f',
                                borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)',
                                position: 'relative', overflow: 'hidden', display: 'flex',
                                alignItems: 'center', justifyContent: 'center'
                            }}>
                                <PlaybackCanvas frameData={rawFramesRef.current[previewFrameIdx]} />
                            </div>
                        )}

                        {/* Record button */}
                        <button
                            className={`rm-record-button${!canRecord ? ' rm-record-disabled' : ''}`}
                            onClick={handleRecord}
                            disabled={!canRecord}
                        >
                            {phase === 'recording' ? (
                                <>
                                    <span className="rm-rec-dot" />
                                    Recording…
                                </>
                            ) : phase === 'countdown' ? (
                                `Get ready… ${countdown}`
                            ) : (
                                <>
                                    <span className="rm-rec-dot-static" />
                                    Record  ({RECORD_FRAMES} frames)
                                </>
                            )}
                        </button>

                        {/* Instructions footer */}
                        <p style={{ fontSize: 11, color: '#334155', textAlign: 'center', lineHeight: 1.6, marginTop: 'auto' }}>
                            Aim for {TAKES_GOAL} takes per sign &nbsp;·&nbsp; Each take yields {Math.floor((RECORD_FRAMES - SEQ_LENGTH) / WINDOW_STRIDE) + 1} training sequences<br />
                            Export JSON → run the fine-tuning notebook
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Mini Canvas Player for normalized float data ──────────────────────────────
function PlaybackCanvas({ frameData }: { frameData: number[] }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !frameData || frameData.length < 63) return
        const ctx = canvas.getContext('2d')!
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        const CONNECTIONS = [
            [0, 1], [1, 2], [2, 3], [3, 4],
            [0, 5], [5, 6], [6, 7], [7, 8],
            [0, 9], [9, 10], [10, 11], [11, 12],
            [0, 13], [13, 14], [14, 15], [15, 16],
            [0, 17], [17, 18], [18, 19], [19, 20],
            [5, 9], [9, 13], [13, 17],
        ]

        // Transform normalized data [-1, 1] back to canvas coordinates [0, width/height]
        // Note: the Y axis is flipped in normal canvas operations vs mediapipe.
        const LMs: { x: number, y: number }[] = []
        for (let i = 0; i < 21; i++) {
            const x = (frameData[i * 3] + 1) / 2 * canvas.width
            const y = (frameData[i * 3 + 1] + 1) / 2 * canvas.height
            LMs.push({ x, y })
        }

        ctx.strokeStyle = 'rgba(45, 212, 191, 0.7)'
        ctx.lineWidth = 2
        for (const [a, b] of CONNECTIONS) {
            ctx.beginPath()
            ctx.moveTo(canvas.width - LMs[a].x, LMs[a].y)
            ctx.lineTo(canvas.width - LMs[b].x, LMs[b].y)
            ctx.stroke()
        }

        for (let i = 0; i < LMs.length; i++) {
            ctx.beginPath()
            ctx.arc(canvas.width - LMs[i].x, LMs[i].y, i === 0 ? 5 : 3, 0, Math.PI * 2)
            ctx.fillStyle = i === 0 ? '#7c3aed' : '#2dd4bf'
            ctx.fill()
        }
    }, [frameData])

    return (
        <canvas ref={canvasRef} width={240} height={180} style={{ width: 240, height: 180 }} />
    )
}
