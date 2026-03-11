import * as ort from 'onnxruntime-web'

export interface ModelMeta {
    mode: string
    sign_names: string[]
    seq_length: number
    n_features: number
    model_type: string
    hidden_size: number
    num_layers: number
    best_val_acc: number
    cv_acc_mean: number
    cv_acc_std: number
}

let session: ort.InferenceSession | null = null
let meta: ModelMeta | null = null

export async function loadModel(): Promise<ModelMeta> {
    if (session && meta) return meta

    // Load metadata
    const metaRes = await fetch('/models/model_meta.json')
    if (!metaRes.ok) throw new Error('Failed to load model_meta.json')
    meta = await metaRes.json() as ModelMeta

    // Configure WASM backend
    ort.env.wasm.numThreads = 1
    ort.env.wasm.simd = true

    session = await ort.InferenceSession.create('/models/model.onnx', {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
    })

    console.log('[ONNX] Session loaded. Input:', session.inputNames, 'Output:', session.outputNames)
    return meta
}

export interface InferenceResult {
    topLabel: string
    topProb: number
    topK: Array<{ label: string; prob: number }>
    inferenceLatency: number
}

/**
 * Run inference on a flattened Float32Array of shape [1, SEQ_LENGTH, N_FEATURES].
 */
export async function runInference(
    flatData: Float32Array,
    seqLength: number,
    nFeatures: number,
    signNames: string[],
): Promise<InferenceResult> {
    if (!session || !meta) throw new Error('Model not loaded')

    const tensor = new ort.Tensor('float32', flatData, [1, seqLength, nFeatures])
    const feeds: Record<string, ort.Tensor> = {}
    feeds[session.inputNames[0]] = tensor

    const startMs = performance.now()
    const results = await session.run(feeds)
    const inferenceLatency = performance.now() - startMs

    const logits = results[session.outputNames[0]].data as Float32Array

    // Softmax
    const maxLogit = Math.max(...logits)
    const exps = logits.map(v => Math.exp(v - maxLogit))
    const sumExp = exps.reduce((a, b) => a + b, 0)
    const probs = exps.map(v => v / sumExp)

    // Top-3
    const indexed = Array.from(probs).map((p, i) => ({ label: signNames[i] ?? `#${i}`, prob: p }))
    indexed.sort((a, b) => b.prob - a.prob)
    const topK = indexed.slice(0, 3)

    return {
        topLabel: topK[0].label,
        topProb: topK[0].prob,
        topK,
        inferenceLatency,
    }
}
