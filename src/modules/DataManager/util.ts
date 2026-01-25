export function splitBase64(base64: string): { mimeType: string, base64Data: string } {
    if (!base64.startsWith('data:')) {
        return { mimeType: '', base64Data: base64 };
    } else {
        const [mimeType, base64Data] = base64.split(',');
        return { mimeType, base64Data };
    }
}