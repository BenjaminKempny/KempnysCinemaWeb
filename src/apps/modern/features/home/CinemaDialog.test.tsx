import type { DialogProps } from '@mui/material/Dialog';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import layoutManager from 'components/layoutManager';
import browser from 'scripts/browser';
import { getKeyName, isInteractiveElement } from 'scripts/keyboardUtils';

import CinemaDialog from './CinemaDialog';

vi.mock('components/layoutManager', () => ({ default: { tv: true } }));
vi.mock('scripts/browser', () => ({ default: { tv: true, hisense: false, vidaa: false } }));
vi.mock('scripts/keyboardUtils', () => ({
    getKeyName: vi.fn(),
    isInteractiveElement: vi.fn()
}));

let container: HTMLDivElement;
let root: Root;
const close = vi.fn();
const backgroundKeyDown = vi.fn();

function renderDialog(props: Partial<DialogProps> = {}) {
    act(() => {
        root.render(<CinemaDialog open onClose={close} transitionDuration={0} {...props}>
            <input aria-label='Collection name' />
        </CinemaDialog>);
    });
}

function press(options: KeyboardEventInit, normalizedKey = options.key || '') {
    vi.mocked(getKeyName).mockReturnValue(normalizedKey);
    const target = document.querySelector('input');
    if (!target) throw new Error('Dialog input missing');
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...options });
    act(() => {
        target.dispatchEvent(event);
    });
    return event;
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    layoutManager.tv = true;
    layoutManager.modern = false;
    Object.assign(browser, { tv: true, hisense: false, vidaa: false });
    vi.mocked(isInteractiveElement).mockReturnValue(false);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    window.addEventListener('keydown', backgroundKeyDown);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.removeEventListener('keydown', backgroundKeyDown);
    vi.unstubAllGlobals();
});

describe('Cinema dialog remote Back', () => {
    it.each([
        { key: 'Unidentified', keyCode: 10009 },
        { key: '', keyCode: 461 },
        { key: 'BrowserBack' },
        { key: 'GoBack' }
    ])('closes and contains normalized Back: %j', options => {
        renderDialog();
        const event = press(options, 'Back');
        expect(getKeyName).toHaveBeenCalledWith(event);
        expect(event.defaultPrevented).toBe(true);
        expect(close).toHaveBeenCalledOnce();
        expect(close).toHaveBeenCalledWith(expect.anything(), 'escapeKeyDown');
        expect(backgroundKeyDown).not.toHaveBeenCalled();
    });

    it.each([
        { key: 'GamepadB', keyCode: 196 },
        { key: 'Unidentified', keyCode: 27 },
        { key: 'Esc' }
    ])('closes for normalized TV Escape: %j', options => {
        renderDialog();
        press(options, 'Escape');
        expect(close).toHaveBeenCalledOnce();
        expect(backgroundKeyDown).not.toHaveBeenCalled();
    });

    it.each(['Back', 'Escape'])('contains %s when closing is disabled', key => {
        renderDialog({ disableEscapeKeyDown: true });
        press({ key });
        expect(close).not.toHaveBeenCalled();
        expect(backgroundKeyDown).not.toHaveBeenCalled();
    });

    it.each(['Back', 'Escape'])('contains %s while pending without an onClose', key => {
        renderDialog({ onClose: undefined });
        press({ key });
        expect(close).not.toHaveBeenCalled();
        expect(backgroundKeyDown).not.toHaveBeenCalled();
    });

    it('lets MUI handle ordinary Escape exactly once', () => {
        const onKeyDown = vi.fn();
        renderDialog({ onKeyDown });
        press({ key: 'Escape' });
        expect(onKeyDown).toHaveBeenCalledOnce();
        expect(close).toHaveBeenCalledOnce();
        expect(close).toHaveBeenCalledWith(expect.anything(), 'escapeKeyDown');
        expect(backgroundKeyDown).not.toHaveBeenCalled();
    });

    it.each(['Back', 'Escape', 'GamepadB'])('does not close repeatedly for held %s', key => {
        renderDialog();
        const normalized = key === 'GamepadB' ? 'Escape' : key;
        press({ key }, normalized);
        press({ key, repeat: true }, normalized);
        expect(close).toHaveBeenCalledOnce();
        expect(backgroundKeyDown).not.toHaveBeenCalled();
        press({ key }, normalized);
        expect(close).toHaveBeenCalledTimes(2);
    });

    it('composes onKeyDown and honors caller cancellation for remote Back', () => {
        const onKeyDown = vi.fn((event: React.KeyboardEvent) => event.preventDefault());
        renderDialog({ onKeyDown });
        press({ key: 'Back' });
        expect(onKeyDown).toHaveBeenCalledOnce();
        expect(close).not.toHaveBeenCalled();
        expect(backgroundKeyDown).not.toHaveBeenCalled();
    });

    it('does not interpret Escape aliases outside TV layout', () => {
        layoutManager.tv = false;
        renderDialog();
        expect(press({ key: 'GamepadB' }, 'Escape').defaultPrevented).toBe(false);
        expect(close).not.toHaveBeenCalled();
        expect(backgroundKeyDown).toHaveBeenCalledOnce();
    });

    it('does not interfere with editing and arrow keys', () => {
        vi.mocked(isInteractiveElement).mockReturnValue(true);
        const onKeyDown = vi.fn();
        renderDialog({ onKeyDown });
        for (const key of ['a', 'Enter', 'ArrowLeft', 'Backspace']) {
            expect(press({ key }).defaultPrevented).toBe(false);
        }
        expect(onKeyDown).toHaveBeenCalledTimes(4);
        expect(close).not.toHaveBeenCalled();
    });

    it.each(['ctrlKey', 'altKey', 'metaKey', 'shiftKey'])('ignores remote Back with %s', modifier => {
        renderDialog();
        expect(press({ key: 'Back', [modifier]: true }).defaultPrevented).toBe(false);
        expect(close).not.toHaveBeenCalled();
    });

    it('handles Backspace on desktop outside editable elements', () => {
        layoutManager.tv = false;
        layoutManager.modern = true;
        renderDialog();
        expect(press({ key: 'Backspace' }).defaultPrevented).toBe(true);
        expect(close).toHaveBeenCalledOnce();
        expect(isInteractiveElement).toHaveBeenCalledWith(document.querySelector('input'));
        expect(backgroundKeyDown).not.toHaveBeenCalled();
    });

    it('contains Backspace when dismissal is disabled', () => {
        renderDialog({ disableEscapeKeyDown: true });
        expect(press({ key: 'Backspace' }).defaultPrevented).toBe(true);
        expect(close).not.toHaveBeenCalled();
        expect(backgroundKeyDown).not.toHaveBeenCalled();
    });

    it('keeps Hisense Backspace native in editable text', () => {
        Object.assign(browser, { hisense: true, vidaa: true });
        vi.mocked(isInteractiveElement).mockReturnValue(true);
        renderDialog();
        expect(press({ key: 'Backspace' }).defaultPrevented).toBe(false);
        expect(close).not.toHaveBeenCalled();
    });

    it('passes through other MUI Dialog props', () => {
        renderDialog({ className: 'cinemaDialog', fullWidth: true, maxWidth: 'md', 'aria-label': 'Manage collection' });
        expect(document.querySelector('.cinemaDialog')).not.toBeNull();
        expect(document.querySelector('.cinemaDialog')?.getAttribute('aria-label')).toBe('Manage collection');
    });
});
