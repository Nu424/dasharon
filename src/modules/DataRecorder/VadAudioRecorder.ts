import { MicVAD } from "@ricky0123/vad-web"
import { AudioManager } from "../DataManager/AudioManager";

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
            redemptionFrames: redemptionFrames,
        })
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

