import { ImageManager } from "../DataManager/ImageManager";

export class FrameManager {
    public frames: ImageManager[];
    constructor() {
        this.frames = [];
    }

    async fromVideoBlob(videoBlob: Blob, intervalSecond: number = 2, doResetFrames = true): Promise<void> {
        // ---以前のフレームをリセットする
        if (doResetFrames) {
            this.frames = [];
        }

        // ---ビデオを読み込む
        const videoUrl = URL.createObjectURL(videoBlob);
        const videoElement = document.createElement("video");
        videoElement.src = videoUrl;

        // ---フレーム取得用のcanvasを用意する
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Error: Unable to get canvas context");
        }

        // ---ビデオ読み込み後、フレームを取得する
        return new Promise<void>((resolve) => {
            videoElement.onloadeddata = async () => {
                const videoWidth = videoElement.videoWidth;
                const videoHeight = videoElement.videoHeight;
                canvas.width = videoWidth;
                canvas.height = videoHeight;

                const duration = videoElement.duration;
                for (let i = 0; i <= duration; i += intervalSecond) {
                    videoElement.currentTime = i;
                    await new Promise((resolve) => { videoElement.onseeked = resolve; });
                    context.drawImage(videoElement, 0, 0, videoWidth, videoHeight);
                    canvas.toBlob((blob) => {
                        if (blob) {
                            this.frames.push(new ImageManager(blob));
                        }
                    });
                }
                resolve();
            };

            // ---ビデオをロードする
            videoElement.load();
        });
    }
}