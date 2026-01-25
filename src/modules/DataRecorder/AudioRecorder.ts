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

    constructor() {
        this.recorder = undefined;
        this.recordedChunks = [];
        this.stream = undefined;
    }

    /**
     * 録音を開始する
     */
    public async startRecord() {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.recorder = new MediaRecorder(this.stream);
        this.recordedChunks = [];

        this.recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };

        this.recorder.start();
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
     * @returns 録音した音声のAudioManager
     */
    public async stopRecord(): Promise<AudioManager | void> {
        if (!this.recorder) {
            console.error("recorder is not initialized");
            return;
        }

        return new Promise((resolve) => {
            this.recorder!.onstop = () => {
                const audioBlob = new Blob(this.recordedChunks, { type: this.recordedChunks[0].type });
                const audioManager = new AudioManager();
                audioManager.fromBlob(audioBlob);
                this.cleanup();
                resolve(audioManager);
            };
            this.recorder!.requestData(); // 明示的にデータを取得。これで確実に、「ondataavailable→onstop」の流れになる
            this.recorder!.stop();
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
    }
}