import type { CircuitDocument, Component, Point, PropertyValue, Wire } from '../../model/types';
import {
    defaultDefForKind,
    fullSchxType,
    SCHX_SYMBOL_ELEMENT_TYPE,
    SCHX_WIRE_ELEMENT_TYPE,
    shortenSchxType,
} from './catalog';

export function serializeSchx(doc: CircuitDocument): string {
    const lines: string[] = [];
    lines.push('<?xml version="1.0" encoding="utf-8"?>');
    lines.push(`<Schematic ${formatAttrs(rootAttributes(doc))}>`);

    for (const component of doc.components) {
        lines.push(`  <Element ${formatAttrs(elementAttributes(component))}>`);
        lines.push(`    <Component ${formatAttrs(componentAttributes(component))} />`);
        lines.push('  </Element>');
    }

    for (const wire of doc.wires) {
        lines.push(`  <Element ${formatAttrs(wireAttributes(wire))} />`);
    }

    lines.push('</Schematic>');
    return `${lines.join('\n')}\n`;
}

function rootAttributes(doc: CircuitDocument): Record<string, string> {
    const attrs: Record<string, string> = {
        Name: doc.metadata.name,
        Description: doc.metadata.description,
        PartNumber: doc.metadata.partNumber,
    };
    for (const [key, value] of Object.entries(doc.rawAttributes)) {
        if (key === 'Name' || key === 'Description' || key === 'PartNumber') {
            continue;
        }
        attrs[key] = value;
    }
    return attrs;
}

function elementAttributes(component: Component): Record<string, string> {
    return {
        Type: SCHX_SYMBOL_ELEMENT_TYPE,
        Rotation: String(component.rotation),
        Flip: component.flipped ? 'true' : 'false',
        Position: pointToString(component.origin),
    };
}

function componentAttributes(component: Component): Record<string, string> {
    const type = component.sourceTypeName ?? guessSourceType(component);
    const attrs: Record<string, string> = { _Type: type };

    for (const [key, value] of Object.entries(component.properties)) {
        attrs[key] = stringifyPropertyValue(value);
    }

    if (component.kind === 'led' && attrs.Type === undefined) {
        attrs.Type = 'LED';
    }

    attrs.Name = component.name;
    return attrs;
}

function wireAttributes(wire: Wire): Record<string, string> {
    return {
        Type: SCHX_WIRE_ELEMENT_TYPE,
        A: pointToString(wire.endpoints[0]),
        B: pointToString(wire.endpoints[1]),
    };
}

function guessSourceType(component: Component): string {
    if (component.kind === 'led') {
        return fullSchxType('Diode');
    }

    const def = defaultDefForKind(component.kind);
    if (def === undefined) {
        return fullSchxType('Unknown');
    }
    const shortName = component.kind === 'tube-diode' ? 'TubeDiode' : def.shortType;
    return fullSchxType(shortName);
}

function stringifyPropertyValue(value: PropertyValue): string {
    if (typeof value === 'string') {
        return value;
    }
    return value.raw;
}

function pointToString(p: Point): string {
    return `${p.x},${p.y}`;
}

function formatAttrs(attrs: Record<string, string>): string {
    return Object.entries(attrs)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}="${escapeXml(value)}"`)
        .join(' ');
}

function escapeXml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

export { shortenSchxType };
