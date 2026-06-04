import { toNetlistView, type NetlistComponent } from '../../model/netlist';
import type { CircuitDocument } from '../../model/types';

export function serializeSpiceNetlist(doc: CircuitDocument): string {
    const lines: string[] = [];
    const titleLine = doc.metadata.name.trim();
    if (titleLine.length > 0) {
        lines.push(`.TITLE ${titleLine}`);
    } else {
        lines.push('* circuit-preview-editor — serialized netlist');
    }

    const view = toNetlistView(doc);
    for (const entry of view.components) {
        const formatted = formatComponent(entry);
        if (formatted !== null) {
            lines.push(formatted);
        }
    }

    for (const directive of doc.directives) {
        lines.push(directive);
    }

    lines.push('.END');
    return `${lines.join('\n')}\n`;
}

function formatComponent(entry: NetlistComponent): string | null {
    if (entry.spiceLetter === null) {
        return `* ${entry.id} (${entry.kind}) skipped — needs subcircuit expansion`;
    }
    const id = ensurePrefix(entry.id, entry.spiceLetter);
    const nodes = entry.nodes.join(' ');
    const tail = entry.model ?? entry.value?.raw ?? '';
    const extras = entry.extras.spiceExtras ?? '';
    const parts = [id, nodes, tail, extras].filter((s) => typeof s === 'string' && s.length > 0);
    return parts.join(' ').trim();
}

function ensurePrefix(id: string, letter: string): string {
    return id.charAt(0).toUpperCase() === letter ? id : `${letter}${id}`;
}
