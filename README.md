## だしゃろん 🎙️📝

**だらだら喋るだけで、構造化された議論メモ（Markdown）が育つ**フロント完結アプリです。  
PTT / VAD + ホールド / 猶予カウントで「勝手に終わらない」を重視しています。

- **公開URL（GitHub Pages）**: `https://nu424.github.io/dasharon/`

---

## 使い方（最短）🚀

1. **「設定」**を開く
2. **OpenRouter APIキー**を入れる（※ローカル保存）
3. **モデル**を選ぶ（STT / LLM）
4. 下のバーで音声入力 → 自動で **STT → LLM → メモ更新**

---

## 音声入力のコツ 🎧

### PTT（デフォ）🖐️
- **押す**: 録音開始
- **離す**: 猶予カウント開始（デフォ 1s、設定で変更可）
- **猶予が0**: 送信確定（末尾の猶予分はトリムしてSTTへ）

### VAD（自動検出）🫧
- **マイクON**: 発話を自動で区切って溜める
- **ホールドON**: “送らない”ので考える間も安心（バッファに溜まる）
- **ホールドOFF**: 解除した瞬間に **まとめてフラッシュ→STT**（猶予なし）

---

## できること ✨

- **議論メモ（Markdown）**の自動更新・表示（GFM対応）
- **コピー**（メモ / 文字起こしログ）
- **編集**（処理中は安全のためロック）
- 設定：APIキー / STT・LLMモデル / 言語 / 入力モード / 猶予 / スタイルプリセット

---

## 注意（大事）🔐

- **APIキーは localStorage に保存**されます（共有PCでは注意！）
- **Chrome 推奨**（マイク権限が必要です）
- STT/LLM は OpenRouter を使うため **利用料金が発生**する場合があります

---

## 開発者向け（ざっくり理解）🧩

### 処理の流れ（1本の音声セグメント）
`Audio(PTT/VAD)` → `STT(OpenRouter)` → `transcriptsに追加` → `pendingに追記` → `LLM(OpenRouter)` → `memo(markdown)更新`

- **逐次処理**: STT/LLMはキューで順番に流して、詰まりやAPI過負荷を避けます
- **LLM失敗時**: pending を保持して「再解析」で復帰できる設計です

### まず読むべきコード 📌
- **UI/状態/録音制御の中心**: `src/App.tsx`
- **STT→LLMの逐次パイプライン**: `src/services/pipeline/processingLoop.ts`
- **PTT録音（timeslice/末尾トリム対応）**: `src/modules/DataRecorder/AudioRecorder.ts`
- **VAD録音（onSpeechEndでPCM→AudioManager）**: `src/modules/DataRecorder/VadAudioRecorder.ts`
- **VADバッファ結合→flush**: `src/services/vad/vadBuffer.ts`
- **OpenRouter STT/LLM**: `src/services/openRouter/stt.ts` / `src/services/openRouter/llm.ts`
- **Zustand（settings/memo/transcripts永続化）**: `src/store/useAppStore.ts`
- **UI部品**: `src/components/*`（`ControlBar`, `MemoPane`, `SettingsModal`, `TranscriptLogModal`）
- **猶予カウント**: `src/hooks/useGraceRelease.ts`
- **メモのスタイル指示**: `src/constants/memoStylePresets.ts`

### ローカル開発 🛠️

```bash
npm install
npm run dev
```

- **build**: `npm run build`
- **preview**: `npm run preview`

---

## GitHub Pages 公開 🌐

このリポジトリは GitHub Actions で Pages にデプロイします。

- **Workflow**: `.github/workflows/deploy.yml`
- **Vite base**: `vite.config.ts`（CIでは `/<repo>/` を自動設定）

手順：
1. GitHub の **Settings → Pages** で **Build and deployment: GitHub Actions** を選ぶ
2. `main` に push → Actions が走って公開

---

## ドキュメント 📚

- 仕様の元ネタ: `documents/concept.txt`
- 設計メモ: `documents/plan.md`
- OpenRouterの扱い: `documents/how_to_use-LLMAPI.md`
