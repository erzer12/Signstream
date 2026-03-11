import type { PipelineStatus } from '@/hooks/useInference'

interface Props {
    status: PipelineStatus
    errorMsg: string | null
    e2eLatency?: number
    onnxLatency?: number
    onRecordClick: () => void
}

const LABELS: Record<PipelineStatus, string> = {
    loading: 'Loading model…',
    ready: 'Ready — show your hand',
    tracking: 'Tracking  ·  Live',
    error: 'Error',
}

export default function StatusBar({ status, errorMsg, e2eLatency, onnxLatency, onRecordClick }: Props) {
    return (
        <div className="status-bar">
            <span className={`dot dot-${status}`} />
            <span style={{ color: status === 'tracking' ? '#2dd4bf' : undefined }}>
                {LABELS[status]}
            </span>
            
            {status === 'tracking' && e2eLatency !== undefined && onnxLatency !== undefined && (
                <span style={{
                    fontSize: 10,
                    color: '#64748b',
                    fontFamily: 'JetBrains Mono, monospace',
                    background: 'rgba(255,255,255,0.05)',
                    padding: '2px 6px',
                    borderRadius: 4,
                    marginLeft: 8
                }}>
                    E2E {Math.round(e2eLatency)}ms · ONNX {Math.round(onnxLatency)}ms
                </span>
            )}

            {status === 'error' && errorMsg && (
                <span style={{
                    fontSize: 11, color: '#f87171',
                    fontFamily: 'JetBrains Mono, monospace',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240,
                }}>
                    {errorMsg}
                </span>
            )}

            {status === 'loading' && (
                <svg style={{ width: 14, height: 14, animation: 'spin 1s linear infinite', color: '#2dd4bf' }}
                    fill="none" viewBox="0 0 24 24">
                    <circle style={{ opacity: .25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path style={{ opacity: .75 }} fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
            )}

            {/* spacer pushes Record button to the right */}
            <span style={{ flex: 1 }} />

            <button
                className="record-btn"
                onClick={onRecordClick}
                title="Open Record Mode — capture your own sign sequences"
            >
                <span className="rec-dot-static" />
                Record
            </button>
        </div>
    )
}
