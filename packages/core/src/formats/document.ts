import type { CircuitDocument, DocumentSource } from '../model/types';
import { parseLtspiceAsc } from './ltspice/parser';
import { serializeLtspiceAsc } from './ltspice/serializer';
import { parseSchx } from './schx/parser';
import { serializeSchx } from './schx/serializer';
import { parseSpiceNetlist } from './spice/parser';
import { serializeSpiceNetlist } from './spice/serializer';
import { parseInterchangeYaml } from './interchange/parser';
import { serializeInterchangeYaml } from './interchange/serializer';
import { parseCircuitJsonDocument, serializeCircuitJsonDocument } from './circuit-json/serializer';

export type CircuitFormat = 'schx' | 'spice' | 'ltspice-asc';

export type CircuitDocumentFileFormat = CircuitFormat | 'vdsp' | 'yaml' | 'circuit-json';

export type ParseCircuitDocumentOptions = Readonly<{
    filename?: string;
    format?: CircuitFormat;
}>;

export type ParseCircuitDocumentFileOptions = Readonly<{
    filename: string;
}>;

export type SerializeVdspCircuitDocumentOptions = Readonly<{
    filename?: string;
    source?: DocumentSource;
}>;

export type SerializeCircuitDocumentFileOptions = Readonly<{
    format: CircuitDocumentFileFormat;
    filename?: string;
}>;

export type ConvertCircuitDocumentFileOptions = Readonly<{
    inputFilename: string;
    outputFormat: CircuitDocumentFileFormat;
    outputFilename?: string;
}>;

export type VdspSchemaValidationIssue = Readonly<{
    code: 'vdsp-schema-invalid';
    message: string;
    path?: string;
}>;

export type VdspSchemaValidationResult =
    | Readonly<{
        valid: true;
        document: CircuitDocument;
        errors: readonly [];
    }>
    | Readonly<{
        valid: false;
        errors: readonly VdspSchemaValidationIssue[];
    }>;

export const vdspFileExtension = '.vdsp';

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

export function isVdspFilename(filename: string): boolean {
    return filename.trim().toLowerCase().endsWith(vdspFileExtension);
}

export function detectCircuitDocumentFileFormat(filename: string): CircuitDocumentFileFormat | null {
    const lower = filename.trim().toLowerCase();
    if (lower.endsWith('.vdsp')) {
        return 'vdsp';
    }
    if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
        return 'yaml';
    }
    if (lower.endsWith('.circuit.json')) {
        return 'circuit-json';
    }
    return detectCircuitFormat(filename);
}

export function vdspFilenameFromName(name: string): string {
    const slug = name
        .normalize('NFKD')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
    return `${slug || 'untitled-preset'}${vdspFileExtension}`;
}

export function parseVdspCircuitDocument(source: string): CircuitDocument {
    return parseInterchangeYaml(source);
}

export function validateVdspCircuitDocumentSchema(source: string): VdspSchemaValidationResult {
    try {
        return {
            valid: true,
            document: parseVdspCircuitDocument(source),
            errors: [],
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const path = pathFromSchemaMessage(message);
        return {
            valid: false,
            errors: [{
                code: 'vdsp-schema-invalid',
                message,
                ...(path === undefined ? {} : { path }),
            }],
        };
    }
}

export function parseCircuitDocumentFile(
    source: string,
    options: ParseCircuitDocumentFileOptions,
): CircuitDocument {
    const format = detectCircuitDocumentFileFormat(options.filename);
    if (format === null) {
        throw new Error(`unsupported circuit document file extension: ${options.filename}`);
    }
    if (format === 'vdsp' || format === 'yaml') {
        return parseInterchangeYaml(source);
    }
    if (format === 'circuit-json') {
        const parsed: unknown = JSON.parse(source);
        return parseCircuitJsonDocument(parsed, options.filename === undefined ? {} : { filename: options.filename });
    }
    return parseCircuitDocument(source, {
        filename: options.filename,
        format,
    });
}

export function serializeCircuitDocumentFile(
    document: CircuitDocument,
    options: SerializeCircuitDocumentFileOptions,
): string {
    switch (options.format) {
        case 'vdsp':
        case 'yaml':
            return serializeVdspCircuitDocument(
                document,
                options.filename === undefined ? {} : { filename: options.filename },
            );
        case 'schx':
            return serializeSchx(document);
        case 'ltspice-asc':
            return serializeLtspiceAsc(document);
        case 'spice':
            return serializeSpiceNetlist(document);
        case 'circuit-json':
            return `${JSON.stringify(serializeCircuitJsonDocument(document).elements, null, 2)}\n`;
    }
}

export function convertCircuitDocumentFile(
    source: string,
    options: ConvertCircuitDocumentFileOptions,
): string {
    return serializeCircuitDocumentFile(parseCircuitDocumentFile(source, {
        filename: options.inputFilename,
    }), {
        format: options.outputFormat,
        ...(options.outputFilename === undefined ? {} : { filename: options.outputFilename }),
    });
}

export function serializeVdspCircuitDocument(
    document: CircuitDocument,
    options: SerializeVdspCircuitDocumentOptions = {},
): string {
    return serializeInterchangeYaml(document, {
        source: vdspSource(document, options),
    });
}

function vdspSource(
    document: CircuitDocument,
    options: SerializeVdspCircuitDocumentOptions,
): DocumentSource {
    const source: Record<string, string> = {
        ...(document.source ?? {}),
        ...(options.source ?? {}),
    };
    if (source.format === undefined) {
        source.format = 'interchange';
    }
    if (options.filename !== undefined) {
        source.filename = normalizeVdspFilename(options.filename, document.metadata.name);
    }
    if (source.filename === undefined || source.filename.length === 0) {
        source.filename = vdspFilenameFromName(document.metadata.name);
    }
    return source;
}

function normalizeVdspFilename(filename: string | undefined, fallbackName: string): string {
    const trimmed = filename?.trim() ?? '';
    if (trimmed.length === 0) {
        return vdspFilenameFromName(fallbackName);
    }
    if (isVdspFilename(trimmed)) {
        return trimmed;
    }
    const withoutExtension = trimmed.replace(/\.[^.\\\/]+$/, '');
    return `${withoutExtension || 'untitled-preset'}${vdspFileExtension}`;
}

function pathFromSchemaMessage(message: string): string | undefined {
    const colonIndex = message.indexOf(':');
    if (colonIndex <= 0) {
        return undefined;
    }
    const candidate = message.slice(0, colonIndex);
    if (/^[A-Za-z_][A-Za-z0-9_]*(?:\[\d+\])?(?:\.[A-Za-z_][A-Za-z0-9_]*(?:\[\d+\])?)*$/.test(candidate)) {
        return candidate;
    }
    return undefined;
}
