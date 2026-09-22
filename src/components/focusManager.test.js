import { afterEach, describe, expect, it, vi } from 'vitest';

import focusManager from './focusManager';

vi.mock('./scrollManager', () => ({ default: { isEnabled: () => true } }));

function button(parent, left, top, width = 100, height = 100) {
    const element = document.createElement('button');
    const rect = { left, top, width, height, right: left + width, bottom: top + height };
    element.getBoundingClientRect = () => rect;
    element.getClientRects = () => [rect];
    parent.appendChild(element);
    return element;
}

afterEach(() => {
    document.body.innerHTML = '';
});

describe('directional focus navigation', () => {
    it('stops at the right edge of a row but allows returning left to the sidebar', () => {
        const sidebar = button(document.body, 0, 0);
        const row = document.createElement('div');
        row.className = 'focuscontainer-right';
        document.body.appendChild(row);
        const first = button(row, 120, 0);
        const last = button(row, 240, 0);
        button(document.body, 360, 120);
        first.focus();
        focusManager.moveRight();
        expect(document.activeElement).toBe(last);
        focusManager.moveRight();
        expect(document.activeElement).toBe(last);
        focusManager.moveLeft();
        expect(document.activeElement).toBe(first);
        focusManager.moveLeft();
        expect(document.activeElement).toBe(sidebar);
    });

    it('keeps navigation in an ARIA dialog and initializes its first control', () => {
        const dialog = document.createElement('div');
        dialog.setAttribute('role', 'dialog');
        dialog.tabIndex = -1;
        document.body.appendChild(dialog);
        const inside = button(dialog, 0, 0);
        button(document.body, 110, 0);
        dialog.focus();
        focusManager.moveRight();
        expect(document.activeElement).toBe(inside);
        focusManager.moveRight();
        expect(document.activeElement).toBe(inside);
    });

    it('uses the innermost scope when focus is lost', () => {
        const outer = document.createElement('div');
        const inner = document.createElement('div');
        document.body.append(outer, inner);
        button(outer, 0, 0);
        const target = button(inner, 200, 0);
        focusManager.pushScope(outer);
        focusManager.pushScope(inner);
        try {
            focusManager.moveRight();
            expect(document.activeElement).toBe(target);
        } finally {
            focusManager.popScope();
            focusManager.popScope();
        }
    });

    it('skips hidden, inert, disabled and negative tabindex controls', () => {
        const source = button(document.body, 0, 0);
        button(document.body, 110, 0).style.visibility = 'hidden';
        button(document.body, 120, 0).setAttribute('inert', '');
        button(document.body, 130, 0).disabled = true;
        button(document.body, 140, 0).tabIndex = -1;
        button(document.body, 150, 0).setAttribute('aria-hidden', 'true');
        const target = button(document.body, 160, 0);
        source.focus();
        focusManager.moveRight();
        expect(document.activeElement).toBe(target);
    });

    it('prefers the same row over a closer diagonal target in directional regions', () => {
        const region = document.createElement('div');
        region.setAttribute('data-directional-navigation', '');
        document.body.appendChild(region);
        const source = button(region, 0, 0);
        button(region, 110, 110);
        const target = button(region, 300, 0);
        source.focus();
        focusManager.moveRight();
        expect(document.activeElement).toBe(target);
    });

    it('keeps the column when moving between differently sized rows', () => {
        const region = document.createElement('div');
        region.setAttribute('data-directional-navigation', '');
        document.body.appendChild(region);
        const source = button(region, 120, 0, 200);
        button(region, 0, 120, 180);
        const target = button(region, 190, 120, 180);
        source.focus();
        focusManager.moveDown();
        expect(document.activeElement).toBe(target);
    });

    it('does not change distance-based navigation outside directional regions', () => {
        const source = button(document.body, 0, 0);
        const target = button(document.body, 110, 110);
        button(document.body, 300, 0);
        source.focus();
        focusManager.moveRight();
        expect(document.activeElement).toBe(target);
    });

    it('recognizes visible fixed controls and rejects detached controls', () => {
        const target = button(document.body, 0, 0);
        target.style.position = 'fixed';
        expect(focusManager.isCurrentlyFocusable(target)).toBe(true);
        target.remove();
        expect(focusManager.isCurrentlyFocusable(target)).toBe(false);
        expect(focusManager.isCurrentlyFocusable(null)).toBe(false);
    });
});
