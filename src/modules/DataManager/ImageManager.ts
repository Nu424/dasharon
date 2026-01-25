/*
# ImageManager.ts
画像を管理・編集・変換するクラス

## 更新履歴
- 20241230
    - 作成(ImageUtil.tsを参考に)

## 使い方
```typescript
import { ImageManager } from './ImageManager';

const imageManager = new ImageManager();

// ---画像の読み込み
// ダイアログから画像を読み込む
imageManager.fromDialog().then((blob) => {
    console.log(blob);
});

// Base64文字列からBlobオブジェクトを生成する
imageManager.fromBase64('data:image/png;base64,xxxxxx').then((blob) => {
    console.log(blob);
});

// img要素からBlobオブジェクトを生成する
const img = new Image();
img.src = 'data:image/png;base64,xxxxxx';
imageManager.fromImageElement(img).then((blob) => {
    console.log(blob);
});

// ---画像の編集
// 画像をリサイズする
imageManager.resize({ width: 100, height: 100 }).then((blob) => {
    console.log(blob);
});

// ---画像の形式変換
// BlobオブジェクトをBase64文字列に変換する
imageManager.toBase64().then((base64) => {
    console.log(base64);
});

// Blobオブジェクトをimg要素に変換する
imageManager.toImageElement().then((img) => {
    console.log(img);
});

// 画像をダウンロードする
imageManager.download();
```
*/

import { splitBase64 } from "./util";

export class ImageManager {
    imageBlob: Blob | undefined;
    constructor(blob?: Blob) {
        this.imageBlob = blob;
    }

    // ----------
    // ---編集
    // ----------
    /**
     * 画像をリサイズする   
     * @param {Blob} blob 画像のBlobオブジェクト
     * @param {number} width リサイズ後の幅
     * @param {number} height リサイズ後の高さ
     * @param {boolean} keepAspect アスペクト比を保持するかどうか
     * @returns {Promise<Blob>} リサイズ後の画像のBlobオブジェクト
     */
    async resize({ blob, width, height, keepAspect = true }: { blob?: Blob, width: number, height: number, keepAspect?: boolean }): Promise<Blob> {
        if (!blob) {
            if (!this.imageBlob) {
                throw new Error('Error: blob is undefined');
            }
            blob = this.imageBlob;
        }
        return new Promise<Blob>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let targetWidth = width;
                let targetHeight = height;

                if (keepAspect) {
                    const aspectRatio = img.width / img.height;
                    if (width / height > aspectRatio) {
                        targetWidth = height * aspectRatio;
                    } else {
                        targetHeight = width / aspectRatio;
                    }
                }

                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject('Error: Unable to get canvas context');
                    return;
                }
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                canvas.toBlob((resizedBlob) => {
                    if (resizedBlob) {
                        resolve(resizedBlob);
                    } else {
                        reject('Error: canvas.toBlob returned null');
                    }
                });
            };
            img.onerror = () => {
                reject('Error: img.onload');
            };
            img.src = URL.createObjectURL(blob);
        });
    }

    // ----------
    // ---読み込み
    // ----------
    /**
     * Base64文字列からBlobオブジェクトを生成する
     * @param base64 Base64文字列
     * @returns Blobオブジェクト
     * @notes this.imageBlobに読み込んだ画像が保存される
     */
    async fromBase64(base64: string): Promise<Blob> {
        let { mimeType, base64Data } = splitBase64(base64);
        if (mimeType === '') {
            mimeType = 'image/png';
        }
        const byteString = atob(base64Data);
        const byteNumbers = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) {
            byteNumbers[i] = byteString.charCodeAt(i);
        }

        const blob = new Blob([byteNumbers], { type: mimeType });
        this.imageBlob = blob;
        return blob;
    }

    /**
     * URLから画像を読み込む
     * @param url 画像のURL
     * @returns Blobオブジェクト
     * @notes this.imageBlobに読み込んだ画像が保存される
     */
    async fromUrl(url: string): Promise<Blob> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error: fetch failed with status ${response.status}`);
        }
        const blob = await response.blob();
        this.imageBlob = blob;
        return blob;
    }

    /**
     * img要素からBlobオブジェクトを生成する
     * @param img img要素
     * @returns Blobオブジェクト
     * @notes this.imageBlobに読み込んだ画像が保存される
     */
    async fromImageElement(img: HTMLImageElement): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject('Error: Unable to get canvas context');
                return;
            }
            ctx.drawImage(img, 0, 0);
            canvas.toBlob((blob) => {
                if (blob) {
                    this.imageBlob = blob;
                    resolve(blob);
                } else {
                    reject('Error: canvas.toBlob returned null');
                }
            });
        });
    }

    /**
     * ダイアログから画像を読み込む
     * @returns Blobオブジェクト
     * @notes this.imageBlobに読み込んだ画像が保存される
     */
    async fromDialog(): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = () => {
                if (!input.files) {
                    reject('Error: input.files is undefined');
                    return;
                }
                const file = input.files[0];
                if (!file) {
                    reject('Error: input.files[0] is undefined');
                    return;
                }
                const reader = new FileReader();
                reader.onload = async () => {
                    if (typeof reader.result === 'string') {
                        const resultBlob = await this.fromBase64(reader.result);
                        this.imageBlob = resultBlob;
                        resolve(resultBlob);
                    } else {
                        reject('Error: reader.result is not string');
                    }
                };
                reader.onerror = () => {
                    reject('Error: reader.readAsDataURL');
                };
                reader.readAsDataURL(file);
            };
            input.click();
        });
    }

    // ----------
    // ---形式変換
    // ----------
    /**
     * BlobオブジェクトをBase64文字列に変換する
     * @param blob Blobオブジェクト
     * @returns Base64文字列
     * @notes blobが指定されていない場合、this.imageBlobが使用される
     */
    async toBase64(blob?: Blob): Promise<string> {
        if (!blob) {
            if (!this.imageBlob) {
                throw new Error('Error: blob is undefined');
            }
            blob = this.imageBlob;
        }
        return new Promise
            ((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const base64 = reader.result;
                    if (typeof base64 === 'string') {
                        resolve(base64);
                    } else {
                        reject('base64 is not string');
                    }
                };
                reader.onerror = () => {
                    reject('Error: reader.readAsDataURL');
                };
                // ---実際の読み込み
                reader.readAsDataURL(blob);
            });
    }

    /**
     * Blobオブジェクトをimg要素に変換する
     * @param blob Blobオブジェクト
     * @returns img要素
     * @notes blobが指定されていない場合、this.imageBlobが使用される
     */
    async toImageElement(blob?: Blob): Promise<HTMLImageElement> {
        if (!blob) {
            if (!this.imageBlob) {
                throw new Error('Error: blob is undefined');
            }
            blob = this.imageBlob;
        }
        return new Promise
            ((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    resolve(img);
                };
                img.onerror = () => {
                    reject('Error: img.onload');
                };
                img.src = URL.createObjectURL(blob);
            });
    }

    /**
     * 画像をダウンロードする
     * @param blob Blobオブジェクト
     * @param filename ダウンロードするファイル名
     * @notes blobが指定されていない場合、this.imageBlobが使用される
     */
    async download(blob?: Blob, filename = 'image.png'): Promise<void> {
        if (!blob) {
            if (!this.imageBlob) {
                throw new Error('Error: blob is undefined');
            }
            blob = this.imageBlob;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
}
