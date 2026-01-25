import { MicVAD } from "@ricky0123/vad-web";
import { AudioManager } from "../DataManager/AudioManager";

const VAD_ASSET_BASE = "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/";
const ORT_ASSET_BASE = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/";

export class VadAudioRecorder {
    private vad: MicVAD | undefined;
    onVoiceDetected: (audioManager: AudioManager) => void;

    constructor(onVoiceDetected: (audioManager: AudioManager) => void) {
        this.vad = undefined;
        this.onVoiceDetected = onVoiceDetected;
    }

    public async init(redemptionFrames: number = 4) {
        this.vad = await MicVAD.new({
            onSpeechEnd: ((audio: Float32Array) => {
                // Float32ArrayをAudioManagerに変換
                const audioManager = new AudioManager();
                // fromArrayBufferの代わりに新しいfromPCMDataメソッドを使用
                // @ricky0123/vad-webのデフォルトサンプルレートは16000Hz
                audioManager.fromPCMData(audio, 16000).then(() => {
                    this.onVoiceDetected(audioManager);
                });
            }).bind(this), // bindして、thisをVadAudioRecorderにする
            // redemptionFrames: redemptionFrames,
            baseAssetPath: VAD_ASSET_BASE,
            onnxWASMBasePath: ORT_ASSET_BASE,
            ortConfig: (ort) => {
                ort.env.logLevel = "error";
                ort.env.wasm.numThreads = 1;
                ort.env.wasm.simd = true;
            },
        });
    }

    public async startRecord() {
        if (!this.vad) {
            throw new Error("Vad is not initialized");
        }
        this.vad.start();
    }

    public async stopRecord() {
        if (!this.vad) {
            throw new Error("Vad is not initialized");
        }
        this.vad.pause();
    }
}

