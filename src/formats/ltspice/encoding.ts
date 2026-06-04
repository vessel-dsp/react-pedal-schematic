// LTspice writes .asc files in Windows-1252 on Windows builds, so lone bytes like
// 0xB5 (µ) appear that aren't valid UTF-8. Strict UTF-8 decoding throws on those;
// fall back to Windows-1252 (a superset of Latin-1 within the printable range we
// care about). This is the same heuristic many cross-platform parsers use.
export function decodeLtspiceBytes(bytes: Uint8Array): string {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        return new TextDecoder('windows-1252').decode(bytes);
    }
}
