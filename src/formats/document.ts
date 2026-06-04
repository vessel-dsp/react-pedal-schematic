import type { CircuitDocument } from '../model/types';
import { parseLtspiceAsc } from './ltspice/parser';
import { parseSchx } from './schx/parser';
import { parseSpiceNetlist } from './spice/parser';

export type CircuitFormat = 'schx' | 'spice' | 'ltspice-asc';

export type ParseCircuitDocumentOptions = Readonly<{
    filename?: string;
    format?: CircuitFormat;
}>;

export function detectCircuitFormat(filename: string): CircuitFormat | null {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.schx')) {
        return 'schx';
    }
    if (lower.endsWith('.cir') || lower.endsWith('.net') || lower.endsWith('.spice')) {
        return 'spice';
    }
    if (lower.endsWith('.asc')) {
        return 'ltspice-asc';
    }
    return null;
}

export function parseCircuitDocument(
    source: string,
    options: ParseCircuitDocumentOptions = {},
): CircuitDocument {
    const format = options.format ?? detectFormat(source, options.filename);
    if (format === null) {
        throw new Error('unsupported circuit format: provide a supported filename or explicit format');
    }

    switch (format) {
        case 'schx':
            return parseSchx(source);
        case 'spice':
            return parseSpiceNetlist(source);
        case 'ltspice-asc':
            return parseLtspiceAsc(source);
    }
}

function detectFormat(source: string, filename: string | undefined): CircuitFormat | null {
    if (filename !== undefined) {
        return detectCircuitFormat(filename);
    }
    const firstLine = source
        .replace(/^﻿/, '')
        .split(/\r?\n/)
        .find((line) => line.trim().length > 0)
        ?.trim() ?? '';

    if (firstLine.startsWith('<?xml') || firstLine.startsWith('<Schematic')) {
        return 'schx';
    }
    if (firstLine.toUpperCase().startsWith('VERSION ')) {
        return 'ltspice-asc';
    }
    if (firstLine.startsWith('.') || /^[A-Za-z]/.test(firstLine)) {
        return 'spice';
    }
    return null;
}
