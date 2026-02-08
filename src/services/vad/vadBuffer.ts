import { AudioManager } from "../../modules/DataManager/AudioManager";

/** VADバッファの初期化オプション。 */
type VadBufferOptions = {
  onFlush: (audioManager: AudioManager) => void;
  onCountChange?: (count: number) => void;
};

/**
 * VADで得たAudioManagerセグメントをバッファして結合する。
 */
export class VadBuffer {
  private buffer: AudioManager[] = [];
  private onFlush: (audioManager: AudioManager) => void;
  private onCountChange?: (count: number) => void;

  /** コールバックを登録して初期化する。 */
  constructor({ onFlush, onCountChange }: VadBufferOptions) {
    this.onFlush = onFlush;
    this.onCountChange = onCountChange;
  }

  /** セグメントを追加して件数を通知する。 */
  addSegment(audioManager: AudioManager) {
    this.buffer.push(audioManager);
    this.onCountChange?.(this.buffer.length);
  }

  /**
   * バッファ内のセグメントを結合して送出する。
   * 空の場合は何もしない。
   */
  async flush() {
    if (this.buffer.length === 0) return;
    const merged = await AudioManager.concatAudioManagers(this.buffer);
    this.buffer = [];
    this.onCountChange?.(0);
    this.onFlush(merged);
  }

  /** バッファをクリアする。 */
  clear() {
    this.buffer = [];
    this.onCountChange?.(0);
  }

  /** バッファ内の件数を返す。 */
  getCount() {
    return this.buffer.length;
  }
}
