import { useState } from 'react'
import type { PredEntry } from '@/hooks/useInference'

interface Props { history: PredEntry[]; onClear: () => void }

export default function HistoryFeed({ history, onClear }: Props) {
    const [showAll, setShowAll] = useState(false)
    const [isHidden, setIsHidden] = useState(false)
    const displayedHistory = showAll ? history : history.slice(0, 10)

    return (
        <div className="glass" style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: showAll && !isHidden ? 1 : 'none', maxHeight: showAll && !isHidden ? '100%' : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>
                    History
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button
                        onClick={() => setIsHidden(!isHidden)}
                        style={{
                            fontSize: 11, color: '#475569', background: 'rgba(255,255,255,0.05)', border: 'none',
                            cursor: 'pointer', padding: '2px 8px', borderRadius: 6,
                            transition: 'background .2s, color .2s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#e2e8f0')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
                    >
                        {isHidden ? 'Show' : 'Hide'}
                    </button>
                    {!isHidden && history.length > 10 && (
                        <button
                            onClick={() => setShowAll(!showAll)}
                            style={{
                                fontSize: 11, color: '#475569', background: 'rgba(255,255,255,0.05)', border: 'none',
                                cursor: 'pointer', padding: '2px 8px', borderRadius: 6,
                                transition: 'background .2s, color .2s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#e2e8f0')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
                        >
                            {showAll ? 'Show Less' : 'View Full'}
                        </button>
                    )}
                    {!isHidden && history.length > 0 && (
                        <button
                            onClick={onClear}
                            style={{
                                fontSize: 11, color: '#475569', background: 'none', border: 'none',
                                cursor: 'pointer', padding: '2px 6px', borderRadius: 6,
                                transition: 'color .2s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#475569')}
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {!isHidden && (
                history.length === 0 ? (
                    <p style={{ fontSize: 12, color: '#334155', textAlign: 'center', padding: '8px 0' }}>
                        No predictions yet
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, overflowY: showAll ? 'auto' : 'visible', paddingRight: showAll ? 4 : 0 }}>
                        {displayedHistory.map((entry, i) => (
                            <div key={entry.id} className={`history-item${i === 0 && !showAll ? ' first' : ''}`}>
                                <span style={{ fontWeight: 600, fontSize: 13, color: i === 0 && !showAll ? '#2dd4bf' : '#94a3b8', flex: 1 }}>
                                    {entry.label}
                                </span>
                                <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: '#475569', minWidth: 28, textAlign: 'right' }}>
                                    {Math.round(entry.prob * 100)}%
                                </span>
                            </div>
                        ))}
                    </div>
                )
            )}
        </div>
    )
}
