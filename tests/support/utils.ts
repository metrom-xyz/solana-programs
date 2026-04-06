export function toLe64(value: number | bigint): Buffer {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64LE(BigInt(value));
    return buffer;
}

export function toLe32(value: number): Buffer {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32LE(value);
    return buffer;
}

export function hexTo32Array(hex: string): number[] {
    if (hex.startsWith("0x")) hex = hex.slice(2);

    const buffer = Buffer.from(hex, "hex");

    if (buffer.length !== 32) {
        throw new Error("Expected 32 bytes");
    }

    return Array.from(buffer);
}
