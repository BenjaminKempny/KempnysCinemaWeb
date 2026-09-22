import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import focusManager from '../components/focusManager';
import layoutManager from '../components/layoutManager';
import scrollManager from '../components/scrollManager';
import { appRouter } from '../components/router/appRouter';
import inputManager from './inputManager';
import { enable } from './keyboardNavigation';

vi.mock('../components/layoutManager', () => ({ default: { tv: false, modern: true } }));
vi.mock('../components/scrollManager', () => ({ default: { isEnabled: () => false, scrollToElement: vi.fn() } }));
vi.mock('../components/apphost', () => ({ appHost: { supports: () => false } }));
vi.mock('../components/playback/playbackmanager', () => ({ playbackManager: {} }));
vi.mock('../components/router/appRouter', () => ({
    appRouter: { canGoBack: vi.fn(() => true), back: vi.fn() }
}));
vi.mock('./browser', () => ({ default: {} }));
vi.mock('./settings/appSettings', () => ({ default: { enableGamepad: () => false } }));

function control(parent, left, top, tag = 'button') {
    const element = document.createElement(tag);
    const rect = { left, top, width: 100, height: 100, right: left + 100, bottom: top + 100 };
    element.getBoundingClientRect = () => rect;
    element.getClientRects = () => [rect];
    element.scrollIntoView = vi.fn();
    parent.append(element);
    return element;
}

function press(key, repeat = false) {
    const event = new KeyboardEvent('keydown', { key, repeat, bubbles: true, cancelable: true });
    document.activeElement.dispatchEvent(event);
    return event;
}

describe('desktop D-pad integration', () => {
    let listeners;
    beforeAll(() => {
        const windowListeners = vi.spyOn(window, 'addEventListener');
        const documentListeners = vi.spyOn(document, 'addEventListener');
        enable();
        listeners = [
            ...windowListeners.mock.calls.map(args => [window, ...args]),
            ...documentListeners.mock.calls.map(args => [document, ...args])
        ];
        windowListeners.mockRestore();
        documentListeners.mockRestore();
    });

    afterAll(() => {
        for (const [target, name, listener, options] of listeners) {
            target.removeEventListener(name, listener, options);
        }
    });

    beforeEach(() => {
        vi.clearAllMocks();
        layoutManager.modern = true;
    });

    afterEach(() => {
        document.body.innerHTML = '';
        document.documentElement.classList.remove('directionalNavigation');
    });

    it('moves spatially in all four directions, scrolls the target and activates once', () => {
        // Deliberately not in visual/DOM order.
        const bottomRight = control(document.body, 120, 120);
        const topLeft = control(document.body, 0, 0);
        const bottomLeft = control(document.body, 0, 120);
        const topRight = control(document.body, 120, 0);
        const activate = vi.fn();
        topLeft.addEventListener('click', activate);
        topLeft.focus();

        for (const [key, target] of [
            ['ArrowRight', topRight], ['ArrowDown', bottomRight],
            ['ArrowLeft', bottomLeft], ['ArrowUp', topLeft]
        ]) {
            expect(press(key).defaultPrevented).toBe(true);
            expect(document.activeElement).toBe(target);
            expect(target.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
        }
        expect(press('Enter').defaultPrevented).toBe(true);
        press('Enter', true);
        expect(activate).toHaveBeenCalledOnce();
    });

    it('stays in a horizontal row, reaches offscreen content and leaves vertically', () => {
        const row = document.createElement('div');
        row.className = 'focuscontainer-right';
        document.body.append(row);
        const first = control(row, 0, 0);
        const far = control(row, 2000, 0);
        const lower = control(document.body, 0, 200);
        first.focus();
        press('ArrowRight');
        expect(document.activeElement).toBe(far);
        expect(far.scrollIntoView).toHaveBeenCalled();
        press('ArrowRight');
        expect(document.activeElement).toBe(far);
        press('ArrowDown');
        expect(document.activeElement).toBe(lower);
    });

    it('restores navigation after removal and discovers dynamically appended controls', () => {
        const first = control(document.body, 0, 0);
        first.focus();
        const added = control(document.body, 120, 0);
        press('ArrowRight');
        expect(document.activeElement).toBe(added);
        added.remove();
        press('ArrowLeft');
        expect(document.activeElement).toBe(first);
    });

    it('keeps custom scrolling with the existing scroll manager', () => {
        const row = document.createElement('div');
        row.setAttribute('data-scroll-mode-x', 'custom');
        document.body.append(row);
        const target = control(row, 2000, 0);
        press('ArrowRight');
        expect(document.activeElement).toBe(target);
        expect(scrollManager.scrollToElement).toHaveBeenCalledWith(target, false);
        expect(target.scrollIntoView).not.toHaveBeenCalled();
    });

    it('routes Escape and Backspace through the existing router without repeats', () => {
        control(document.body, 0, 0).focus();
        expect(press('Escape').defaultPrevented).toBe(true);
        press('Escape', true);
        expect(press('Backspace').defaultPrevented).toBe(true);
        press('Backspace', true);
        expect(appRouter.back).toHaveBeenCalledTimes(2);
        appRouter.canGoBack.mockReturnValueOnce(false);
        expect(press('Escape').defaultPrevented).toBe(false);
    });

    it('honors existing command handlers before moving focus or routing back', () => {
        const first = control(document.body, 0, 0);
        control(document.body, 120, 0);
        const onCommand = event => event.preventDefault();
        inputManager.on(first, onCommand);
        first.focus();
        try {
            expect(press('ArrowRight').defaultPrevented).toBe(true);
            expect(document.activeElement).toBe(first);
            expect(press('Escape').defaultPrevented).toBe(true);
            expect(appRouter.back).not.toHaveBeenCalled();
        } finally {
            inputManager.off(first, onCommand);
        }
    });

    it('does not route behind a portal dialog', () => {
        const dialog = document.createElement('div');
        dialog.setAttribute('role', 'dialog');
        document.body.append(dialog);
        control(dialog, 0, 0).focus();
        expect(press('Backspace').defaultPrevented).toBe(true);
        expect(appRouter.back).not.toHaveBeenCalled();
    });

    it('keeps text editing, mouse activation and wheel scrolling native', () => {
        const input = control(document.body, 0, 0, 'input');
        input.focus();
        for (const key of ['ArrowLeft', 'ArrowRight', 'Backspace', 'Enter']) {
            expect(press(key).defaultPrevented).toBe(false);
        }
        const button = control(document.body, 120, 0);
        const click = vi.fn();
        button.addEventListener('click', click);
        press('ArrowDown');
        const pointer = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        button.dispatchEvent(pointer);
        button.click();
        const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true });
        button.dispatchEvent(wheel);
        expect(pointer.defaultPrevented).toBe(false);
        expect(wheel.defaultPrevented).toBe(false);
        expect(click).toHaveBeenCalledOnce();
        expect(button.scrollIntoView).not.toHaveBeenCalled();
    });

    it('does not consume arrows or Enter when there is no navigable content', () => {
        expect(press('ArrowDown').defaultPrevented).toBe(false);
        expect(press('Enter').defaultPrevented).toBe(false);
        expect(focusManager.isCurrentlyFocusable(document.body)).toBe(false);
    });
});
