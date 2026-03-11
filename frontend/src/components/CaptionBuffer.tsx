import { useState, useEffect } from 'react'

interface Props {
    text: string
    onClear: () => void
}

export default function CaptionBuffer({ text, onClear }: Props) {
    const [speaking, setSpeaking] = useState(false)

    // Check if speaking state matches actual synthesis state periodically
    useEffect(() => {
        const interval = setInterval(() => {
            if (speaking && !window.speechSynthesis.speaking) {
                setSpeaking(false)
            }
        }, 500)
        return () => clearInterval(interval)
    }, [speaking])

    const handleSpeak = () => {
        if (!text) return
        
        // Cancel any ongoing speech
        window.speechSynthesis.cancel()

        const utterance = new SpeechSynthesisUtterance(text)
        utterance.onend = () => setSpeaking(false)
        utterance.onerror = () => setSpeaking(false)
        
        setSpeaking(true)
        window.speechSynthesis.speak(utterance)
    }

    return (
        <div className="caption-buffer-container">
            <div className="caption-buffer glass">
                <div className="caption-header">
                    <span className="caption-title">Live Caption</span>
                    <div className="caption-actions">
                        <button 
                            className={`caption-btn speak-btn ${speaking ? 'speaking' : ''}`}
                            onClick={handleSpeak}
                            disabled={!text || speaking}
                            title="Speak text"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                            </svg>
                            {speaking ? 'Speaking...' : 'Speak'}
                        </button>
                        <button 
                            className="caption-btn clear-btn"
                            onClick={onClear}
                            disabled={!text}
                            title="Clear buffer"
                        >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            Clear
                        </button>
                    </div>
                </div>
                
                <div className="caption-text-area">
                    {text ? (
                        <p className="caption-content">{text}</p>
                    ) : (
                        <p className="caption-placeholder">Sign letters to build words...</p>
                    )}
                </div>
            </div>
        </div>
    )
}
