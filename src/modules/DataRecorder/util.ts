/**
 * カメラ・マイクへのアクセス権限を取得する
 */
export async function getPermission() {
    // ---すでに権限を取得している場合、何もしない
    // @ts-ignore
    const cameraPermission = await navigator.permissions.query({ name: 'camera' });
    // @ts-ignore
    const microphonePermission = await navigator.permissions.query({ name: 'microphone' });
    if (cameraPermission.state === 'granted' && microphonePermission.state === 'granted') {
        return;
    }

    // ---権限を取得する
    const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    mediaStream.getTracks().forEach(track => {
        track.stop();
    });
}

/**
 * デバイスのリストを取得する
 * @returns 使用可能なデバイスのリスト
 */
export async function listDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices;
}

/**
 * デバイス名からデバイスを取得する
 * @param name デバイス名。'*'を指定すると全てのデバイスを取得する
 * @param searchMode 検索モード('exact': 完全一致, 'partial': 部分一致)
 * @param deviceType デバイスの種類('audioinput': 音声入力, 'audiooutput': 音声出力, 'videoinput': 映像入力, 'all': 全て)
 * @returns デバイスの検索結果
 */
export async function searchDeviceByName(name: string, searchMode: 'exact' | 'partial' = 'partial', deviceType: 'audioinput' | 'audiooutput' | 'videoinput' | 'all' = 'all') {
    const devices = await listDevices();
    return devices.filter(device => {
        if (deviceType !== 'all' && device.kind !== deviceType) {
            return false;
        }
        if (name === "*") {
            return true;
        }
        if (searchMode === 'exact') {
            return device.label === name;
        } else {
            return device.label.includes(name);
        }
    });
}