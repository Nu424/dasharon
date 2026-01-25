/*
# AudioQueuePlayer.ts
AudioManagerをキューとして再生するクラス

## 更新履歴
- 20241231
    - 作成

## 使い方
```typescript
import { AudioManager } from "./AudioManager";
import { AudioQueuePlayer } from "./AudioQueuePlayer";

const audioQueuePlayer = new AudioQueuePlayer();

// ---コールバックの設定
audioQueuePlayer.onAllEnded = () => {
    console.log("All audio ended");
}
audioQueuePlayer.onChangeQueue = () => {
    console.log("Queue changed");
}

// ---キューの操作
const audioManager1 = new AudioManager();
const audioManager2 = new AudioManager();
audioQueuePlayer.add(audioManager1);
audioQueuePlayer.add(audioManager2);
audioQueuePlayer.remove(audioManager1);
audioQueuePlayer.clear();

// ---再生コントロール
audioQueuePlayer.play();
audioQueuePlayer.pause();
audioQueuePlayer.stop();
```
*/

import { AudioManager } from "./AudioManager";

export class AudioQueuePlayer {
    queue: AudioManager[];
    constructor() {
        this.queue = [];
    }
    currentAudioManager: AudioManager | undefined;
    onAllEnded: (() => void) | undefined; // 全ての音声が再生し終わった時のコールバック
    onChangeQueue: (() => void) | undefined; // キューが変更された時のコールバック

    // ----------
    // ---キューの操作
    // ----------
    /**
     * AudioManagerをキューに追加する
     * @param audioManager 追加するAudioManager
     */
    public add(audioManager: AudioManager): void {
        this.onChangeQueue?.();
        this.queue.push(audioManager);
    }

    /**
     * AudioManagerをキューから削除する
     * @param audioManager 削除するAudioManager
     */
    public remove(audioManager: AudioManager): void {
        this.onChangeQueue?.();
        this.queue = this.queue.filter((audio) => audio !== audioManager);
    }

    /**
     * キューをクリアする
     */
    public clear(): void {
        this.onChangeQueue?.();
        this.queue = [];
    }

    /**
     * キューの先頭のAudioManagerを取り出す
     * @returns キューの先頭のAudioManager
     */
    public async popQueue(): Promise<AudioManager | undefined> {
        this.onChangeQueue?.();
        return this.queue.shift();
    }

    /**
     * キューを取り出して、再生する
     * @param waitTime 次の音声を再生するまでの待ち時間(ミリ秒)
     */
    private async playNextQueue(waitTime: number = 0): Promise<void> {
        const popeedAudioManager = await this.popQueue();
        if (popeedAudioManager) {
            this.currentAudioManager = popeedAudioManager;
            await this.wait(waitTime);
            popeedAudioManager.onEnded = this.playNextQueue.bind(this);
            popeedAudioManager.play();
        } else {
            this.onAllEnded?.();
        }
    }

    // ----------
    // ---キューの再生コントロール
    // ----------
    /**
     * キューを再生する
     * @param waitTime 次の音声を再生するまでの待ち時間(ミリ秒)
     */
    public async play(waitTime: number = 0): Promise<void> {
        if (this.queue.length > 0) {
            this.playNextQueue(waitTime);
        }
    }

    /**
     * キューを一時停止する
     * @note 一時停止した後再生すると、中断した位置から再生される
     */
    public async pause(): Promise<void> {
        if (this.currentAudioManager) {
            this.currentAudioManager.pause();
        }
    }

    /**
     * キューを停止する
     * @note 停止した後再生すると、停止したAudioManagerの次から再生される
     */
    public async stop(): Promise<void> {
        if (this.currentAudioManager) {
            this.currentAudioManager.stop();
            this.currentAudioManager = undefined;
        }
    }

    /**
     * [内部用]指定時間待つ
     * @param time 待ち時間(ミリ秒)
     */
    private async wait(time: number): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, time);
        });
    }
}