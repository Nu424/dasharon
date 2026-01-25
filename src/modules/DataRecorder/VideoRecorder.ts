export class VideoRecorder {
    private recorder: MediaRecorder | undefined;
    private recordedChunks: Blob[];
    private stream: MediaStream | undefined;

    constructor() {
        this.recorder = undefined;
        this.recordedChunks = [];
        this.stream = undefined;
    }

    /**
     * 録画を開始する
     */
    public async startRecord() {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
    public pauseRecord() {
        if (!this.recorder) {
            console.error("Recorder is not initialized");
            return;
        }
        this.recorder.pause();
    }

    /**
     * 録画を再開する
     */
    public resumeRecord() {
        if (!this.recorder) {
            console.error("Recorder is not initialized");
            return;
        }
        this.recorder.resume();
    }

    /**
     * 録画を終了し、映像データを取得する
     * @returns 録画データのBlobオブジェクト
     */
    public async stopRecord(): Promise<Blob | void> {
        if (!this.recorder) {
            console.error("Recorder is not initialized");
            return;
        }

        return new Promise((resolve) => {
            this.recorder!.onstop = () => {
                const videoBlob = new Blob(this.recordedChunks, { type: "video/webm" });
                this.cleanup();
                resolve(videoBlob);
            };
            this.recorder!.requestData();
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
