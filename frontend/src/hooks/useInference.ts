import { useCallback, useEffect, useRef, useState } from 'react'
import { initHandLandmarker, selectDominantHand } from '@/lib/mediapipe'
import type { HandLandmarkerResult } from '@mediapipe/tasks-vision'
import { normalizeLandmarks, ZERO_FRAME } from '@/lib/normalization'
import { FrameBuffer } from '@/lib/frameBuffer'
import { loadModel, runInference } from '@/lib/onnx'
import type { ModelMeta } from '@/lib/onnx'

export type PipelineStatus = 'loading' | 'ready' | 'tracking' | 'error'

export interface PredEntry {
    id: number
    label: string
    prob: number
    ts: number
}

export interface InferenceState {
    status: PipelineStatus
    errorMsg: string | null
    prediction: string | null
    confidence: number
    topK: Array<{ label: string; prob: number }>
    handedness: string | null
    history: PredEntry[]
    landmarks: HandLandmarkerResult['landmarks'] | null
    e2eLatency: number
    onnxLatency: number
}

const STABILITY_FRAMES = 3
const MAX_HISTORY = 500
let _idCounter = 0

export function useInference(
    videoRef: React.RefObject<HTMLVideoElement | null>,
    canvasRef: React.RefObject<HTMLCanvasElement | null>,
    isRunning: boolean,
    confidenceThreshold = 0.45,
) {
    const [state, setState] = useState<InferenceState>({
        status: 'loading',
        errorMsg: null,
        prediction: null,
        confidence: 0,
        topK: [],
        handedness: null,
        history: [],
        landmarks: null,
        e2eLatency: 0,
        onnxLatency: 0,
    })

    const metaRef = useRef<ModelMeta | null>(null)
    const bufferRef = useRef(new FrameBuffer())
    const rafRef = useRef<number | null>(null)
    const stabilizer = useRef<{ label: string; count: number }>({ label: '', count: 0 })
    const lastTsRef = useRef(-1)
    const landmarkerRef = useRef<Awaited<ReturnType<typeof initHandLandmarker>> | null>(null)
    const isInferring = useRef(false)

    /**
     * Shared ref: the most recent normalized float32[63] frame from the dominant hand.
     * Set to null when no hand is detected (zero-frame branch).
     * RecordMode reads this ref directly without triggering re-renders.
     */
    const latestFrameRef = useRef<number[] | null>(null)

    // Bootstrap
    useEffect(() => {
        let cancelled = false
            ; (async () => {
                try {
                    const [lm, meta] = await Promise.all([initHandLandmarker(), loadModel()])
                    if (cancelled) return
                    landmarkerRef.current = lm
                    metaRef.current = meta
                    setState(s => ({ ...s, status: 'ready' }))
                } catch (e) {
                    if (cancelled) return
                    setState(s => ({ ...s, status: 'error', errorMsg: String(e) }))
                }
            })()
        return () => { cancelled = true }
    }, [])

    const predictLoop = useCallback(() => {
        const video = videoRef.current
        const canvas = canvasRef.current
        const meta = metaRef.current
        const landmarker = landmarkerRef.current

        if (!video || !canvas || !meta || !landmarker || video.readyState < 2) {
            if (isRunning) rafRef.current = requestAnimationFrame(predictLoop)
            return
        }

        const now = performance.now()
        if (now <= lastTsRef.current) {
            rafRef.current = requestAnimationFrame(predictLoop)
            return
        }
        lastTsRef.current = now

        // Draw frame to hidden unmirrored canvas
        canvas.width = video.videoWidth || 1280
        canvas.height = video.videoHeight || 720
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(video, 0, 0)

        let result: HandLandmarkerResult
        try {
            result = landmarker.detectForVideo(canvas, now)
        } catch {
            rafRef.current = requestAnimationFrame(predictLoop)
            return
        }

        const dominant = selectDominantHand(result)

        setState(s => ({
            ...s,
            landmarks: result.landmarks,
            status: dominant ? 'tracking' : (s.status === 'tracking' ? 'ready' : s.status),
        }))

        let frame: Float32Array
        let isZero: boolean

        if (dominant) {
            frame = normalizeLandmarks(dominant.landmark)
            isZero = false
            // Expose normalized frame for RecordMode (no re-render — it's a ref)
            latestFrameRef.current = Array.from(frame)
        } else {
            frame = new Float32Array(ZERO_FRAME)
            isZero = true
            latestFrameRef.current = null
        }

        bufferRef.current.push(frame, isZero)

        if (bufferRef.current.isFull() && !bufferRef.current.isMostlyEmpty() && !isInferring.current) {
            isInferring.current = true
            const e2eStartMs = performance.now()
            const tensor = bufferRef.current.toTensor()
            runInference(tensor, meta.seq_length, meta.n_features, meta.sign_names)
                .then(res => {
                    const e2eLatency = performance.now() - e2eStartMs
                    if (res.topProb < confidenceThreshold) return
                    if (res.topLabel === stabilizer.current.label) {
                        stabilizer.current.count++
                    } else {
                        stabilizer.current = { label: res.topLabel, count: 1 }
                    }
                    setState(s => {
                        const shouldAddHistory =
                            stabilizer.current.count >= STABILITY_FRAMES && s.history[0]?.label !== res.topLabel
                        return {
                            ...s,
                            prediction: res.topLabel,
                            confidence: res.topProb,
                            topK: res.topK,
                            handedness: dominant?.handedness ?? s.handedness,
                            e2eLatency,
                            onnxLatency: res.inferenceLatency,
                            history: shouldAddHistory
                                ? [{ id: ++_idCounter, label: res.topLabel, prob: res.topProb, ts: Date.now() }, ...s.history].slice(0, MAX_HISTORY)
                                : s.history,
                        }
                    })
                })
                .catch(e => console.warn('[ONNX]', e))
                .finally(() => { isInferring.current = false })
        }

        if (isRunning) rafRef.current = requestAnimationFrame(predictLoop)
    }, [videoRef, canvasRef, isRunning, confidenceThreshold])

    useEffect(() => {
        if (isRunning && state.status !== 'loading' && state.status !== 'error') {
            rafRef.current = requestAnimationFrame(predictLoop)
        }
        return () => {
            if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
        }
    }, [isRunning, state.status, predictLoop])

    const clearHistory = useCallback(() => {
        setState(s => ({ ...s, history: [], prediction: null, confidence: 0, topK: [], handedness: null }))
        bufferRef.current.reset()
        stabilizer.current = { label: '', count: 0 }
    }, [])

    return { state, clearHistory, latestFrameRef }
}
