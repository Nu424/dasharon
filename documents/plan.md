# だしゃろん（設計・実装計画書 v0.2）
「だらだら喋るだけで、構造化された議論メモ（Markdown）が更新され続ける」フロント完結ツール

---

## 1. 目的 / 方針
### 目的
- 一人ブレスト・思考メモを中心に、会議メモ/議事録的にも使える「構造化メモ」を、音声入力だけで作る
- **勝手に入力が終了しない**（特にVAD）ことを最優先に、PTT/VAD/ホールド/猶予を丁寧に作る

### 基本方針
- フロントのみ（React/Vite/TS + Tailwind + Zustand）
- STT/LLMはOpenRouter API（キーはlocalStorage保存）
- **Markdownでメモを生成し、react-markdownでレンダリング**
- LLMはストリーミングなし、**速さ重視**
- **編集は「録音〜LLM処理完了」まで禁止**（誤更新・競合を避ける）

---

## 2. 要件まとめ（確定）
### 入力
- モード：**PTT（デフォルト） / VAD（切替可能）**
- **猶予秒数（デフォ2秒、設定で変更可）**
- 猶予中は録音継続し、猶予時間を過ぎて終了する場合は**末尾の猶予分をトリム**してSTTへ

### VAD特有
- **ホールド（発話状態保持）**あり  
  - 発話終了（`onSpeechEnd`）ごとに **AudioManager をバッファへ追加**
  - バッファにデータがある場合、**STTへ送信を試みる**（送信可否はホールドで制御）
    - ホールドON：送らない（バッファに溜める）
    - ホールドOFF：送る（バッファを順次フラッシュ）
  - **ホールド状態に「猶予」は設けない**（ホールド解除＝即フラッシュ）
  - フラッシュ時は **バッファ内のAudioManagerを結合してからSTT**（STT回数を減らし、文脈を保ちやすくする）

### STT
- 新規音声セグメントごとにSTT
- 文字起こしは**句読点あり / 改行なし**を狙う（可能ならSTT側のprompt等で指定）
- STT言語：設定（プルダウン + 自由入力）

### 議論メモ更新（LLM）
- 入力：`新しく追加された文字起こし` + `現在の議論メモ` + `まとめ方指示（プリセット/カスタム）`
- 出力：**更新後の議論メモ全文（Markdown本文のみ）**  
  ※「更新部分だけ」ではなく、更新後の全文を返させる（実装/信頼性優先）
- まとめ言語：設定（プルダウン + 自由入力）

### 保存/表示
- 議論メモ：常時表示（Markdownレンダリング）、コピー、編集（編集ボタン押下時のみtextarea）
- 文字起こしログ：**別管理で蓄積**し、設定から閲覧・コピー可能
- localStorage（Zustand persist）
- 音声は保存しない
- 履歴(Undo)なし

### その他
- タイムアウト：**90秒**
- 自動リトライ：あり（回数は実装で規定）
- Chrome優先、PWA不要
- APIキー注意書きあり

---

## 3. 画面 / UI設計（1画面 + 設定モーダル）
### レイアウト
- 上〜中央：議論メモ表示エリア
  - 通常：`react-markdown`でレンダリング表示
  - 操作：`コピー` / `編集` / `設定`（右上など）
- 下部固定：音声入力コントロールバー
  - PTTモード：大型PTTボタン + 状態表示（録音中/猶予カウント/処理中）
  - VADモード：マイクON/OFF + ホールドボタン + 状態表示

### 状態表示（必須）
- 録音中（PTT）/ 監視中（VAD）
- 猶予カウントダウン（例：2.0 → 0）
- STT中 / LLM中（処理中）
- エラー（STT/LLM）

### 編集体験
- 編集ボタンで編集モード（textarea）
- **録音/STT/LLM中は編集ボタンを無効化**（要件）
- 編集モード中は音声入力も無効化（安全策・実装簡略のため推奨）

---

## 4. 状態遷移（概要）
### 音声セグメント生成（PTT）
- `idle`
  - pointerDown → `recording`
- `recording`
  - pointerUp → `graceCounting`（猶予カウント開始、録音継続）
- `graceCounting`
  - pointerDown（猶予内）→ `recording`（猶予キャンセル）
  - 猶予終了 → `finalizing`（録音停止・末尾トリム・Blob確定）
- `finalizing`
  - Blob確定 → STTキューへ投入 → `idle`

### VAD + ホールド
- `src/modules/DataRecorder/VadAudioRecorder.ts` は `MicVAD` を利用し、基本的に `onSpeechEnd(audio: Float32Array)` で「1発話分のPCM」がコールバックされる。
- よってアプリ側の状態は「録音開始/停止」というより **「VAD監視（listening）/セグメント確定（segmentReady）」** を中心に設計する。
- VAD監視ON中：
  - `onSpeechEnd` → `segmentReady`（AudioManager化）→ **VADバッファへ追加**
  - バッファ追加後、**バッファフラッシュを試行**
    - ホールドOFF：バッファを **結合→1本化して** STTキューへ投入
    - ホールドON：何もしない（溜める）
  - ホールドOFFへ切り替えた瞬間：**即フラッシュ**（猶予なし）

補足：
- 「勝手に終わらない」を担保する手段は、VAD側の調整（`redemptionFrames` 等）ではなく **ホールドで“送らない”こと**に寄せる
- VADの分割が細かくなっても、STTは「順次キュー処理」にしてAPI過負荷を避ける

---

## 5. データ設計（Zustand store案）
persist対象は `settings / memo / transcripts`（runtimeは非persist）

### settings（persist）
```ts
type Settings = {
  openRouterApiKey: string;

  sttModel: string;
  llmModel: string;

  inputMode: "PTT" | "VAD";
  graceMs: number;          // default 2000

  sttLanguage: string;      // dropdown + free (例 "ja", "en", "auto")
  summaryLanguage: string;  // 例 "ja"

  memoStylePresetId: string;      // 例 "structured_minutes"
  memoStyleCustomInstruction: string; // ユーザー追記

  timeoutMs: number;        // default 90000
  retryCount: number;       // default 2（合計3回）
};
```

### memo（persist）
```ts
type MemoState = {
  markdown: string;
};
```

### transcripts（persist）
```ts
type TranscriptEntry = {
  id: string;
  createdAt: number;
  text: string;
  mode: "PTT" | "VAD";
};

type TranscriptState = {
  entries: TranscriptEntry[];
  // サイズ肥大対策：上限を設ける（例：最新N件 or 文字数上限）
};
```

### runtime（非persist）
```ts
type RuntimeState = {
  recording: {
    status: "idle" | "recording" | "grace" | "finalizing" | "listening";
    graceRemainingMs: number;
    vadHoldActive: boolean;
  };

  processing: {
    sttRunning: boolean;
    llmRunning: boolean;
    pendingTranscriptText: string; // 未反映分（LLM入力用に連結）
    queueCount: number;            // 音声セグメント待ち等
  };

  // 任意：VADバッファの可視化（実装時に必要なら追加）
  // vadBuffer: { count: number };

  ui: {
    settingsOpen: boolean;
    editOpen: boolean;
    error?: { stage: "STT" | "LLM"; message: string };
  };
};
```

---

## 6. 音声入力・録音設計（猶予＋末尾トリムの最適解）
### 6.1 録音方式（推奨）
結論：**PTTは「チャンク化できる録音API」へ寄せる必要がある**。

現状 `src/modules/DataRecorder/AudioRecorder.ts` は `MediaRecorder.start()` を *timeslice無し* で開始し、停止時に `requestData()` でまとめて `recordedChunks` を受け取る設計になっている。  
このままだと「猶予中に録音を継続し、猶予分だけ末尾をトリム」の実装が難しい（停止時に一括Blob化されるため）。

対応方針（推奨）：`AudioRecorder` を拡張して **timeslice 付きで開始**し、チャンクを保持できるようにする。

- `timeslice = 250ms`（推奨、精度と負荷のバランス）
- 録音中：`dataavailable`で `chunks: Blob[]` を配列にpush
- 「猶予終了で停止」時：
  - `trimChunks = ceil(graceMs / timeslice)` を末尾からdrop
  - `new Blob(chunksAfterTrim, { type: mimeType })` をSTTへ

これにより **TSでの波形編集/再エンコード無し**で、要件の「猶予分トリム」を実現できる。

代替（リスクあり）：停止後にWebAudioでデコード→PCMを切り出してWAVへ再エンコード（実装コストが上がるので後回し）。

### 6.2 猶予判定の共通化
PTTボタン/ホールドボタン双方で使うため、以下をフック化推奨：

- `useGraceRelease({ graceMs })`
  - `press()` / `release()` を受け、`isPressed / isGraceCounting / remainingMs` を提供
  - releaseでタイマー開始、pressでキャンセル

UIはこの `remainingMs` をカウントダウン表示に利用。

---

## 7. STT・LLM処理設計（キュー＋逐次反映）
### 7.1 全体フロー
1) 音声セグメントBlob確定  
2) STT（OpenRouter）  
3) transcriptEntriesに追加（persist）  
4) `pendingTranscriptText` に追記  
5) LLMで議論メモ更新（OpenRouter）  
6) memo.markdown更新（persist）

### 7.2 キュー戦略（最適）
- 音声セグメントは複数発生しうるので、**STTは順次処理**（API過負荷回避）
- LLMも順次処理
- `pendingTranscriptText` をバッファにし、LLM実行中に新しいSTTが来たら追記しておき、LLM完了後に次のLLMを起動

これにより「だらだら喋る」中でも取りこぼしなく更新できます。

### 7.3 タイムアウト・リトライ
- `timeoutMs = 90_000`
- `retryCount = 2`（合計3回）  
  - 例：1回目失敗→1s待ち→2回目→3s待ち→3回目
- 失敗時：
  - STT失敗：runtime.errorに表示（「再試行」は自動で完了。最終失敗時は諦める/または手動再試行導線）
  - LLM失敗：`pendingTranscriptText` を保持したまま「再解析」ボタンを出す（推奨）

---

## 8. OpenRouter API 呼び出し設計（抽象化）
`documents/how_to_use-LLMAPI.md` に基づき、呼び出し仕様を確定する。

### 8.1 共通fetchラッパ
- `openRouterFetch(path, { method, headers, body, timeoutMs, retryCount })`
  - Authorization付与
  - AbortControllerでtimeout
  - リトライ（指数バックオフ）

### 8.2 STTサービスI/F
- エンドポイント：`POST https://openrouter.ai/api/v1/speech-to-text`
- 入力形式：`messages[].content[]` に `{ type: "input_audio", input_audio: { data, format } }` を含める（Base64）
- `transcribeAudio({ audioManager, model, language?, instructionText?, timeoutMs, retryCount }) => Promise<string>`
  - `AudioManager.toBase64()` は **DataURL** を返すので、`data:...;base64,` 以降の Base64 部分だけを抽出して `input_audio.data` に渡す
  - `input_audio.format` は MIME から推定（例：`audio/wav` → `"wav"`、`audio/webm` → `"webm"`）
- 期待する出力：句読点あり・改行なし  
  - `instructionText`（例：「句読点を付けて、改行せずに文字起こしして」）を `content: [{ type:"text", text: ... }]` として同梱する

### 8.3 LLMサービスI/F
- エンドポイント：`POST https://openrouter.ai/api/v1/chat/completions`
- `updateMemo({ currentMemo, newTranscriptText, styleInstruction, summaryLanguage, model, temperature?, maxTokens?, timeoutMs, retryCount }) => Promise<string>`
  - `stream: false`（要件：速さ重視、ストリーミング不要）
  - **返答はMarkdown本文のみ**（コードフェンスや解説は禁止）

### 8.4 コスト計測（任意）
- 生成コストを見たい場合：`GET https://openrouter.ai/api/v1/generation?id=<生成ID>`（計画書段階では任意機能）

---

## 9. プロンプト設計（LLM）
### 9.1 スタイル（プリセット + カスタム）
- プリセットは「テンプレ固定」ではなく**行動指針（構造化の方針）**として用意
- 例（案）：
  - `structured_minutes`: 論点/要点/決定/次アクション/未解決 を重視
  - `brainstorm`: アイデア群のクラスタリング、仮説、次に試すこと
  - `tech_notes`: 前提/制約/選択肢/判断/リスク

ユーザーのカスタム指示はプリセット末尾に追記して統合。

### 9.2 LLM入力（概形）
- System（固定）：
  - 「あなたは議論メモの編集者。既存のMarkdownメモを破壊せず、必要箇所を更新し、構造が見通しよい形に保つ」
- User（毎回）：
  - summaryLanguage指定
  - 既存メモ
  - 新規文字起こし（pending分）
  - スタイル指示（preset+custom）
  - 制約：「**更新後のメモ本文のみ出力**」「コードフェンス禁止」「冗長な前置き禁止」

---

## 10. 設定画面設計（モーダル）
セクション案：
1) API
- OpenRouter APIキー入力（注意書き付き）
2) Models
- STTモデル
- LLMモデル
3) Audio
- 入力モード（PTT/VAD）
- 猶予秒数（ms/秒入力、デフォ2秒）
4) Language
- STT言語（プルダウン + 自由入力）
- まとめ言語（プルダウン + 自由入力）
5) Memo Style
- プリセット選択
- カスタム指示入力
6) Data
- 議論メモ削除
- 文字起こしログ閲覧（textarea/readonly）+ コピー + 削除

---

## 11. 非機能・注意点
- **APIキーはlocalStorageに平文保存**：設定画面に注意書きを出す
- Markdownレンダリングは `rehype-sanitize` 等で安全側に（念のため）
- localStorage肥大対策：
  - transcriptEntriesは上限（例：最新300件 or 総文字数上限）を設け、超過分は古いものから削除（設定に「ログ上限」追加も可）

---

## 12. 実装マイルストーン（おすすめ順）
1) **プロジェクト雛形**
- Vite+React+TS、Tailwind、Zustand persist、react-markdown導入
2) **UI骨格**
- 1画面レイアウト、メモ表示/コピー/編集モーダル、設定モーダル（入れ物）
3) **状態管理**
- settings/memo/transcriptsのpersist、runtimeの状態（録音/処理中/エラー）
4) **PTT実装（最優先）**
- useGraceRelease、猶予カウント
- `src/modules/DataRecorder/AudioRecorder.ts` を **timeslice対応**に拡張し、録音チャンク保持→猶予分の末尾トリムを可能にする
5) **OpenRouter STT接続**
- 音声Blob→文字起こし、ログ蓄積、エラー/リトライ/タイムアウト
6) **OpenRouter LLM接続**
- pendingTranscriptText→メモ更新、Markdown出力厳守、編集ロック
7) **VAD + ホールド**
- `VadAudioRecorder`（`onSpeechEnd`ベース）を前提に、発話終了ごとに `AudioManager` を **VADバッファへ追加**し、ホールドOFFなら **即フラッシュでSTT**（ホールドONなら溜める）
- UIは「VAD監視中/ホールド中/処理中（STT/LLM）」の状態を明確に出す
8) **設定の仕上げ**
- モデル切替、言語、スタイルプリセット+カスタム、ログ閲覧/コピー/削除
9) **仕上げ**
- レスポンシブ、視認性、エラーUX、簡易テスト（手動チェック表）

---

## 13. 実装前に潰す検証項目
現時点で仕様は概ね確定したので、「実装前に潰す検証項目」に置き換える。

- **PTTの末尾トリム**：`AudioRecorder` を timeslice 対応に改修できるか（`MediaRecorder.start(timeslice)` + chunk保持）
- **STTの音声フォーマット互換性**：PTT録音の MIME（例：`audio/webm`）を `input_audio.format` に渡した場合に、選定モデルで受理されるか（不可ならWAV変換が必要）
- **VADホールドのUX**：`onSpeechEnd`で分割される前提で、ホールドONは「送らず溜める」、ホールドOFFは「即フラッシュ」の体験が「勝手に終わらない」を満たすか
