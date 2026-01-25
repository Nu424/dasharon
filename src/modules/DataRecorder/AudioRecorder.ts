/*
# AudioRecorder.ts
録音を行うクラス

## 使用例
```ts
// ---インスタンスの作成
const audioRecorder = new AudioRecorder()

// ---録音を開始する
await audioRecorder.startRecord()

// ---録音を終了する
const audio = await audioRecorder.stopRecord()

// ---録音した音声を再生する
audio.play()

## 開発メモ
- requestData()で途中のデータを取り出すのは無理そう
    - 代替: 都度AudioRecorderを作成する
    - 原因
        - 途中のデータを取り出すと、音声データが断片的になってしまい、再生できない
        - やろうとするとChunksみたいなのにデータをためて、それを結合→再生となるが、それだと毎回すべて再生することになる……
        
```

*/

import { AudioManager } from "../DataManager/AudioManager";

export class AudioRecorder {
    private recorder: MediaRecorder | undefined;
    private recordedChunks: Blob[];
    private stream: MediaStream | undefined;
    private timesliceMs: number | undefined;

    constructor() {
        this.recorder = undefined;
        this.recordedChunks = [];
        this.stream = undefined;
        this.timesliceMs = undefined;
    }

    /**
     * 録音を開始する
     */
    public async startRecord(timesliceMs: number = 250) {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.recorder = new MediaRecorder(this.stream);
        this.recordedChunks = [];
        this.timesliceMs = timesliceMs;

        this.recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };

        this.recorder.start(timesliceMs);
    }

    /**
     * 録画を一時停止する
     */
    public async pauseRecord() {
        if (!this.recorder) {
            console.error("recorder is not initialized");
            return;
        }
        this.recorder.pause();
    }

    /**
     * 録画を再開する
     */
    public async resumeRecord() {
        if (!this.recorder) {
            console.error("recorder is not initialized");
            return;
        }
        this.recorder.resume();
    }

    /**
     * 録音を終了し、音声データを取得する
     * @param trimMs 猶予分などで末尾をトリムする長さ（ミリ秒）
     * @returns 録音した音声のAudioManager
     */
    public async stopRecord(trimMs: number = 0): Promise<AudioManager | void> {
        if (!this.recorder) {
            console.error("recorder is not initialized");
            return;
        }

        return new Promise((resolve) => {
            this.recorder!.onstop = () => {
                const chunks = this.trimChunksByMs(trimMs);
                if (chunks.length === 0) {
                    this.cleanup();
                    resolve();
                    return;
                }
                const audioBlob = new Blob(chunks, { type: chunks[0].type || this.recorder?.mimeType });
                const audioManager = new AudioManager();
                audioManager.fromBlob(audioBlob);
                this.cleanup();
                resolve(audioManager);
            };
            if (this.recorder!.state !== "inactive") {
                this.recorder!.requestData(); // 明示的にデータを取得。これで確実に、「ondataavailable→onstop」の流れになる
                this.recorder!.stop();
            } else {
                this.cleanup();
                resolve();
            }
        });
    }

    /**
     * リソースを解放する
     */
    private cleanup() {
        this.recorder = undefined;
        this.recordedChunks = [];
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = undefined;
        }
        this.timesliceMs = undefined;
    }

    /**
     * 末尾を猶予分トリムする（timeslice前提）
     */
    private trimChunksByMs(trimMs: number): Blob[] {
        const chunks = [...this.recordedChunks];
        if (!this.timesliceMs || trimMs <= 0) {
            return chunks;
        }
        const trimCount = Math.ceil(trimMs / this.timesliceMs);
        const safeTrimCount = Math.min(trimCount, chunks.length);
        if (safeTrimCount > 0) {
            chunks.splice(chunks.length - safeTrimCount, safeTrimCount);
        }
        return chunks;
    }
}