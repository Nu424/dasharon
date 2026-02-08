import { useCallback, useEffect, useRef, useState } from "react";

/** グレースリリース制御のオプション。 */
type UseGraceReleaseOptions = {
  graceMs: number;
  tickMs?: number;
  onGraceEnd: () => void;
};

/** グレースリリース制御の戻り値。 */
type UseGraceReleaseResult = {
  isPressed: boolean;
  isGraceCounting: boolean;
  remainingMs: number;
  press: () => void;
  release: () => void;
  cancel: () => void;
};

/**
 * PTTの猶予タイマーを管理するフック。
 */
export function useGraceRelease({
  graceMs,
  tickMs = 50,
  onGraceEnd,
}: UseGraceReleaseOptions): UseGraceReleaseResult {
  const [isPressed, setIsPressed] = useState(false);
  const [isGraceCounting, setIsGraceCounting] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);

  /** タイマーを停止して参照をクリアする。 */
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** 猶予カウントを開始する。 */
  const startGrace = useCallback(() => {
    clearTimer();
    if (graceMs <= 0) {
      setIsGraceCounting(false);
      setRemainingMs(0);
      onGraceEnd();
      return;
    }
    // 開始時刻を記録して残り時間を定期更新する。
    startedAtRef.current = Date.now();
    setIsGraceCounting(true);
    setRemainingMs(graceMs);
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      const nextRemaining = Math.max(0, graceMs - elapsed);
      setRemainingMs(nextRemaining);
      if (nextRemaining <= 0) {
        clearTimer();
        setIsGraceCounting(false);
        onGraceEnd();
      }
    }, tickMs);
  }, [clearTimer, graceMs, onGraceEnd, tickMs]);

  /** 押下開始時の状態に戻す。 */
  const press = useCallback(() => {
    clearTimer();
    setIsPressed(true);
    setIsGraceCounting(false);
    setRemainingMs(0);
  }, [clearTimer]);

  /** 押下解除で猶予カウントを開始する。 */
  const release = useCallback(() => {
    setIsPressed(false);
    startGrace();
  }, [startGrace]);

  /** 猶予や押下状態を強制終了する。 */
  const cancel = useCallback(() => {
    clearTimer();
    setIsPressed(false);
    setIsGraceCounting(false);
    setRemainingMs(0);
  }, [clearTimer]);

  // アンマウント時にタイマーを停止する。
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return { isPressed, isGraceCounting, remainingMs, press, release, cancel };
}
