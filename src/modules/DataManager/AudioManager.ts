/*
# AudioManager.ts
音声を管理・変換するクラス

## 更新履歴
- 20241230
    - 作成

## 使い方
```typescript
import { AudioManager } from './AudioManager';

const audioManager = new AudioManager();

// ---音声の読み込み
// URLから音声を読み込む
audioManager.fromUrl('https://example.com/audio.mp3').then(() => {
    console.log('Audio loaded');
});

// Fileから音声を読み込む
const file = new File([''], 'audio.mp3');
audioManager.fromFile(file).then(() => {
    console.log('Audio loaded');
});

// ダイアログから音声を読み込む
audioManager.fromDialog().then(() => {
    console.log('Audio loaded');
});

// ---再生コントロール
audioManager.play(); // 再生
audioManager.pause(); // 一時停止
audioManager.stop(); // 停止
audioManager.seek(10); // 再生位置を10秒に移動
audioManager.setVolume(0.5); // 音量を50%に設定

// ---再生コントロール-情報取得
console.log(audioManager.getDuration()); // 音声の長さを取得
console.log(audioManager.getCurrentTime()); // 現在の再生位置を取得
console.log(audioManager.isPlaying()); // 再生中かどうかを取得

// ---形式変換
audioManager.toBase64().then((base64) => {
    console.log(base64);
});
audioManager.toFile('audio.mp3').then((file) => {
    console.log(file);
});
```
*/

import { splitBase64 } from "./util";

export class AudioManager {
    audioBlob: Blob | undefined;
    audioElement: HTMLAudioElement | undefined;

    onEnded: (() => void) | undefined;

    /**
     * PCMキャッシュ（VAD由来など、fromPCMData() で生成した場合に保持する）
     * - これがある場合、Blobをデコードせずに高速に結合できる
     * - 現状は mono を想定（createWavBlobFromPCM が mono 固定）
     */
    pcmData: Float32Array | undefined;
    pcmSampleRate: number | undefined;

    // ----------
    // ---再生コントロール
    // ----------
    /**
     * 音声を再生する
     */
    play(): void {
        if (this.audioElement) {
            this.audioElement.onended = this.onEnded ?? (() => { });
            this.audioElement.play();
        } else {
            throw new Error("No audio to play");
        }
    }

    /**
     * 音声を一時停止する
     */
    pause(): void {
        if (this.audioElement) {
            this.audioElement.pause();
        } else {
            throw new Error("No audio to pause");
        }
    }

    /**
     * 音声を停止する
     */
    stop(): void {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.currentTime = 0;
        } else {
            throw new Error("No audio to stop");
        }
    }

    /**
     * 音声を再生位置に移動する
     * @param time 再生位置(秒)
     */
    seek(time: number): void {
        if (this.audioElement) {
            this.audioElement.currentTime = time;
        } else {
            throw new Error("No audio to seek");
        }
    }

    /**
     * 音量を設定する
     * @param volume 音量(0~1)
     */
    setVolume(volume: number): void {
        if (this.audioElement) {
            this.audioElement.volume = volume;
        } else {
            throw new Error("No audio to set volume");
        }
    }

    // ----------
    // ---再生コントロール-情報取得
    // ----------
    /**
     * 音声の長さを取得する
     * @returns 音声の長さ(秒)
     */
    getDuration(): number {
        if (this.audioElement) {
            return this.audioElement.duration;
        } else {
            throw new Error("No audio to get duration");
        }
    }

    /**
     * 現在の再生位置を取得する
     * @returns 再生位置(秒)
     */
    getCurrentTime(): number {
        if (this.audioElement) {
            return this.audioElement.currentTime;
        } else {
            throw new Error("No audio to get current time");
        }
    }

    /**
     * 音声が再生中かどうかを取得する
     * @returns 再生中かどうか
     */
    isPlaying(): boolean {
        if (this.audioElement) {
            return !this.audioElement.paused;
        } else {
            throw new Error("No audio to check if playing");
        }
    }

    // ----------
    // ---読み込み
    // ----------
    // 読み込みでは、this.audioBlobとthis.audioElementの両方を設定する
    // データの主はthis.audioBlob。this.audioElementは再生のためのサブ的なもの…とする

    /**
     * ArrayBufferから音声を読み込む
     * @param arrayBuffer 音声のArrayBuffer
     * @param type ArrayBufferの形式('mp3', 'wav', 'ogg'など)
     */
    async fromArrayBuffer(arrayBuffer: ArrayBuffer, type: string): Promise<void> {
        const blob = new Blob([arrayBuffer], { type: `audio/${type}` });
        this.audioBlob = blob;
        this.audioElement = new Audio(URL.createObjectURL(blob));
        this.stop();
    }

    /**
     * Float32Array（PCMデータ）からWAVフォーマットの音声を作成する
     * @param pcmData PCMデータ（Float32Array）
     * @param sampleRate サンプリングレート（デフォルト: 16000Hz）
     */
    async fromPCMData(pcmData: Float32Array, sampleRate: number = 16000): Promise<void> {
        // PCMキャッシュ（結合用）
        this.pcmData = pcmData;
        this.pcmSampleRate = sampleRate;

        // WAVヘッダーを追加してBlobに変換
        const wavBlob = this.createWavBlobFromPCM(pcmData, sampleRate);
        this.audioBlob = wavBlob;
        this.audioElement = new Audio(URL.createObjectURL(wavBlob));
        this.stop();
    }

    /**
     * Float32Array（PCMデータ）からWAV形式のBlobを作成する
     * @param pcmData PCMデータ（Float32Array）
     * @param sampleRate サンプリングレート（デフォルト: 16000Hz）
     * @returns WAV形式のBlob
     */
    private createWavBlobFromPCM(pcmData: Float32Array, sampleRate: number = 16000): Blob {
        // PCMデータを16ビット整数に変換
        const numSamples = pcmData.length;
        const intData = new Int16Array(numSamples);
        
        // Float32Array（-1.0〜1.0）をInt16Array（-32768〜32767）に変換
        for (let i = 0; i < numSamples; i++) {
            // クリッピング処理
            let sample = Math.max(-1.0, Math.min(1.0, pcmData[i]));
            // スケーリング
            intData[i] = sample < 0 ? sample * 32768 : sample * 32767;
        }

        // WAVヘッダーの作成
        const wavHeader = new ArrayBuffer(44);
        const view = new DataView(wavHeader);

        // "RIFF" チャンク記述子
        this.writeString(view, 0, 'RIFF');
        // ファイルサイズ (36 + データサイズ)
        view.setUint32(4, 36 + intData.byteLength, true);
        // "WAVE" フォーマット
        this.writeString(view, 8, 'WAVE');
        
        // "fmt " サブチャンク
        this.writeString(view, 12, 'fmt ');
        // サブチャンク1のサイズ (16 for PCM)
        view.setUint32(16, 16, true);
        // オーディオフォーマット (1 for PCM)
        view.setUint16(20, 1, true);
        // チャンネル数
        view.setUint16(22, 1, true);
        // サンプルレート
        view.setUint32(24, sampleRate, true);
        // バイトレート (サンプルレート * チャンネル数 * バイト/サンプル)
        view.setUint32(28, sampleRate * 2, true);
        // ブロックサイズ (チャンネル数 * バイト/サンプル)
        view.setUint16(32, 2, true);
        // サンプルあたりのビット数
        view.setUint16(34, 16, true);
        
        // "data" サブチャンク
        this.writeString(view, 36, 'data');
        // サブチャンク2のサイズ (サンプル数 * チャンネル数 * バイト/サンプル)
        view.setUint32(40, intData.byteLength, true);

        // WAVファイルの作成（ヘッダー + データ）
        const wavFile = new Uint8Array(wavHeader.byteLength + intData.byteLength);
        wavFile.set(new Uint8Array(wavHeader), 0);
        wavFile.set(new Uint8Array(intData.buffer), wavHeader.byteLength);

        return new Blob([wavFile], { type: 'audio/wav' });
    }

    /**
     * DataViewにテキスト文字列を書き込む
     * @param view DataView
     * @param offset 開始オフセット
     * @param string 書き込む文字列
     */
    private writeString(view: DataView, offset: number, string: string): void {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    /**
     * Blobから音声を読み込む
     * @param blob 音声のBlobオブジェクト
     */
    async fromBlob(blob: Blob): Promise<void> {
        this.audioBlob = blob;
        this.audioElement = new Audio(URL.createObjectURL(blob));
        // blob由来はPCMが不明なのでキャッシュは破棄
        this.pcmData = undefined;
        this.pcmSampleRate = undefined;
        this.stop();
    }

    async fromBase64(base64: string, mayMimeType?: string): Promise<void> {
        let { mimeType, base64Data } = splitBase64(base64);
        if (mimeType === '') {
            mimeType = mayMimeType ?? 'audio/mp3';
        }
        const arrayBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)).buffer;
        const blob = new Blob([arrayBuffer], { type: mimeType });
        this.audioBlob = blob;
        this.audioElement = new Audio(URL.createObjectURL(blob));
        this.pcmData = undefined;
        this.pcmSampleRate = undefined;
        this.stop();
    }

    /**
     * URLから音声を読み込む
     * @param url 音声のURL
     */
    async fromUrl(url: string): Promise<void> {
        // ---Blobの作成
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error: fetch failed with status ${response.status}`);
        }
        const blob = await response.blob();
        this.audioBlob = blob;

        // ---AudioElementの作成
        this.audioElement = new Audio(URL.createObjectURL(blob));
        this.pcmData = undefined;
        this.pcmSampleRate = undefined;
        this.stop();
    }

    /**
     * Fileから音声を読み込む
     * @param file 音声ファイル
     */
    async fromFile(file: File): Promise<void> {
        const blob = file;
        this.audioBlob = blob;
        this.audioElement = new Audio(URL.createObjectURL(blob));
        this.pcmData = undefined;
        this.pcmSampleRate = undefined;
        this.stop();
    }

    /**
     * ダイアログから音声を読み込む
     */
    async fromDialog(): Promise<void> {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'audio/*';
            input.onchange = () => {
                if (input.files && input.files.length > 0) {
                    const file = input.files[0];
                    this.fromFile(file).then(() => {
                        resolve();
                    });
                } else {
                    reject(new Error("No file selected"));
                }
            };
            input.click();
        }
        );
    }

    // ----------
    // ---形式変換
    // ----------
    /**
     * 音声をBase64に変換する
     * @returns Base64文字列
     */
    async toBase64(): Promise<string> {
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
            reader.onloadend = () => {
                if (reader.result) {
                    const base64 = reader.result.toString()//.split(',')[1];
                    resolve(base64);
                } else {
                    reject(new Error("Failed to convert audio to base64"));
                }
            };
            reader.onerror = () => {
                reject(new Error("Failed to read audio blob"));
            };
            // ---実際の読み込み
            if (this.audioBlob) {
                reader.readAsDataURL(this.audioBlob);
            } else {
                reject(new Error("No audio blob to convert to base64"));
            }
        });
    }

    /**
     * 音声をFileに変換する
     * @param filename ファイル名
     * @returns Fileオブジェクト
     */
    async toFile(filename: string): Promise<File> {
        if (this.audioBlob) {
            return new File([this.audioBlob], filename);
        } else {
            throw new Error("No audio blob to convert to file");
        }
    }

    /**
     * 音声をダウンロードする
     * @param filename ファイル名
     */
    async download(filename: string = "audio.mp3"): Promise<void> {
        const file = await this.toFile(filename);
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * 複数の AudioManager を結合する（VADバッファのフラッシュ用）
     * @notes
     * - 全てが fromPCMData() 由来（pcmData がある）なら、PCM連結→WAV生成で安全に結合できる
     * - それ以外（blob由来）は現状サポート外（webm等は単純結合できないため）
     */
    static async concatAudioManagers(audioManagers: AudioManager[]): Promise<AudioManager> {
        // ---結合可能性の検討
        if (audioManagers.length === 0) {
            throw new Error("No audioManagers to concat");
        }

        const sampleRate = audioManagers[0].pcmSampleRate;
        if (!sampleRate) {
            throw new Error("pcmSampleRate is undefined (concat requires PCM-backed AudioManager)");
        }

        for (const am of audioManagers) {
            if (!am.pcmData || !am.pcmSampleRate) {
                throw new Error("concat requires PCM-backed AudioManager (created via fromPCMData)");
            }
            if (am.pcmSampleRate !== sampleRate) {
                throw new Error("pcmSampleRate mismatch");
            }
        }

        // ---結合
        const totalLength = audioManagers.reduce((sum, am) => sum + (am.pcmData?.length ?? 0), 0);
        const merged = new Float32Array(totalLength);
        let offset = 0;
        for (const am of audioManagers) {
            merged.set(am.pcmData!, offset);
            offset += am.pcmData!.length;
        }

        // ---結合後のAudioManagerを作成
        const mergedAudio = new AudioManager();
        await mergedAudio.fromPCMData(merged, sampleRate);
        return mergedAudio;
    }
}