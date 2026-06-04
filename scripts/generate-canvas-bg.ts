#!/usr/bin/env bun
// Generate a tiny repeatable PNG of light-gray dots for the SchematicView canvas
// background. Output: playground/src/assets/canvas-dot-bg.png
//
// Tile is 20×20 (CSS pixels) with a single 2×2 dot anchored at the upper-left
// corner. The dot uses rgba(0, 0, 0, 0.16) so it sits gently on any background.
// Run with:  bun run scripts/generate-canvas-bg.ts

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const TILE = 20;
const DOT_SIZE = 2;
const DOT_COLOR: readonly [number, number, number, number] = [0, 0, 0, 41]; // ~16% black

function buildRgba(): Uint8Array {
    const stride = TILE * 4;
    const out = new Uint8Array(TILE * stride);
    for (let y = 0; y < DOT_SIZE; y += 1) {
        for (let x = 0; x < DOT_SIZE; x += 1) {
            const i = y * stride + x * 4;
            out[i] = DOT_COLOR[0];
            out[i + 1] = DOT_COLOR[1];
            out[i + 2] = DOT_COLOR[2];
            out[i + 3] = DOT_COLOR[3];
        }
    }
    return out;
}

function withRowFilters(pixels: Uint8Array): Uint8Array {
    // PNG filter byte (0 = none) at the start of each scanline.
    const stride = TILE * 4;
    const out = new Uint8Array(TILE * (stride + 1));
    for (let y = 0; y < TILE; y += 1) {
        out[y * (stride + 1)] = 0;
        out.set(pixels.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
    }
    return out;
}

function crc32(data: Uint8Array): number {
    let c = 0xffffffff;
    for (let i = 0; i < data.length; i += 1) {
        c ^= data[i]!;
        for (let k = 0; k < 8; k += 1) {
            c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
        }
    }
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
    const typeBytes = new TextEncoder().encode(type);
    const out = new Uint8Array(8 + data.length + 4);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length, false);
    out.set(typeBytes, 4);
    out.set(data, 8);
    const crcInput = new Uint8Array(typeBytes.length + data.length);
    crcInput.set(typeBytes, 0);
    crcInput.set(data, typeBytes.length);
    view.setUint32(8 + data.length, crc32(crcInput), false);
    return out;
}

function ihdr(): Uint8Array {
    const buf = new Uint8Array(13);
    const view = new DataView(buf.buffer);
    view.setUint32(0, TILE, false);
    view.setUint32(4, TILE, false);
    buf[8] = 8; // bit depth
    buf[9] = 6; // color type: RGBA
    buf[10] = 0; // compression
    buf[11] = 0; // filter
    buf[12] = 0; // interlace
    return buf;
}

function buildPng(): Uint8Array {
    const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const idat = chunk('IDAT', deflateSync(withRowFilters(buildRgba())));
    const ihdrChunk = chunk('IHDR', ihdr());
    const iend = chunk('IEND', new Uint8Array(0));
    const total = signature.length + ihdrChunk.length + idat.length + iend.length;
    const out = new Uint8Array(total);
    let off = 0;
    out.set(signature, off); off += signature.length;
    out.set(ihdrChunk, off); off += ihdrChunk.length;
    out.set(idat, off); off += idat.length;
    out.set(iend, off);
    return out;
}

const outputPath = resolve(import.meta.dir, '../playground/src/assets/canvas-dot-bg.png');
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, buildPng());
console.log(`wrote ${outputPath} (${TILE}×${TILE} px)`);
