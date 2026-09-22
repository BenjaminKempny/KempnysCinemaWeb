import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import browser from './browser';
import inputManager from './inputManager';
import layoutManager from '../components/layoutManager';
import keyboardNavigation, { enable, getKeyName, isInteractiveElement, isMediaKey, isNavigationKey } from './keyboardNavigation';
import * as keyboardUtils from './keyboardUtils';

vi.mock('./browser', () => ({ default: {} }));
vi.mock('./inputManager', () => ({ default: { handleCommand: vi.fn() } }));
vi.mock('../components/layoutManager', () => ({ default: { tv: true } }));
vi.mock('./settings/appSettings', () => ({ default: { enableGamepad: () => false } }));

function press(options) {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...options });
    window.dispatchEvent(event);
    return event;
}

function focus(markup) {
    document.body.innerHTML = markup;
    const element = document.body.firstElementChild;
    element.focus();
    expect(document.activeElement).toBe(element);
    return element;
}

describe('keyboard navigation', () => {
    let keydownListener;

    beforeAll(() => {
        const addEventListener = vi.spyOn(window, 'addEventListener');
        enable();
        keydownListener = addEventListener.mock.calls.find(([name]) => name === 'keydown')[1];
        addEventListener.mockRestore();
    });

    afterAll(() => {
        window.removeEventListener('keydown', keydownListener);
        document.body.innerHTML = '';
    });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'debug').mockImplementation(vi.fn());
        layoutManager.tv = true;
        layoutManager.modern = false;
        document.documentElement.classList.remove('directionalNavigation');
        Object.assign(browser, { tv: true, hisense: false, vidaa: false });
        document.body.innerHTML = '';
    });

    it('preserves the existing public utility exports', () => {
        expect(getKeyName).toBe(keyboardUtils.getKeyName);
        expect(isInteractiveElement).toBe(keyboardUtils.isInteractiveElement);
        expect(isMediaKey).toBe(keyboardUtils.isMediaKey);
        expect(isNavigationKey).toBe(keyboardUtils.isNavigationKey);
        expect(keyboardNavigation.getKeyName).toBe(getKeyName);
        expect(keyboardNavigation.isNavigationKey).toBe(isNavigationKey);
    });

    it.each([
        [{ key: 'ArrowUp' }, 'ArrowUp'],
        [{ key: 'Enter', code: 'Unidentified' }, 'Enter'],
        [{ key: 'MediaPlayPause', code: '' }, 'MediaPlayPause'],
        [{ key: 'BrowserBack' }, 'Back'],
        [{ key: 'GoBack' }, 'Back'],
        [{ key: 'Select' }, 'Enter'],
        [{ key: 'Esc' }, 'Escape'],
        [{ key: 'Left' }, 'ArrowLeft'],
        [{ key: 'Right' }, 'ArrowRight'],
        [{ key: 'Up' }, 'ArrowUp'],
        [{ key: 'Down' }, 'ArrowDown'],
        [{ key: 'MediaPause' }, 'Pause'],
        [{ key: 'GamepadB' }, 'Escape'],
        [{ key: 'GamepadDPadDown' }, 'ArrowDown'],
        [{ code: 'NavigationLeft' }, 'ArrowLeft'],
        [{ keyCode: 8 }, 'Backspace'],
        [{ keyCode: 19 }, 'Pause'],
        [{ keyCode: 179 }, 'MediaPlayPause'],
        [{ keyCode: 461, code: 'KeyB', key: 'b' }, 'Back'],
        [{ keyCode: 10009, code: 'Unidentified' }, 'Back'],
        [{ keyCode: 195 }, 'GamepadA'],
        [{ keyCode: 10252 }, 'MediaPlayPause'],
        [{ code: 'KeyQ', key: 'a' }, 'KeyQ'],
        [{ code: 'Space', key: ' ' }, 'Space'],
        [{}, '']
    ])('normalizes %j to %s', (event, expected) => {
        expect(getKeyName(event)).toBe(expected);
    });

    it.each(['Enter', 'GamepadA', 'Select'])('activates %s once and cancels native activation', key => {
        focus('<button>Play</button>');
        expect(press({ key }).defaultPrevented).toBe(true);
        expect(press({ key, repeat: true }).defaultPrevented).toBe(true);
        expect(inputManager.handleCommand.mock.calls).toEqual([['select']]);
    });

    it.each(['Back', 'BrowserBack', 'GoBack', 'Escape', 'GamepadB', 'Backspace'])('does not repeat %s in TV mode', key => {
        Object.assign(browser, { hisense: true, vidaa: true });
        expect(press({ key }).defaultPrevented).toBe(true);
        expect(press({ key, repeat: true }).defaultPrevented).toBe(true);
        expect(inputManager.handleCommand.mock.calls).toEqual([['back']]);
    });

    it.each(['Enter', 'Back'])('allows rapid separate %s presses without debouncing', key => {
        press({ key });
        press({ key });
        expect(inputManager.handleCommand).toHaveBeenCalledTimes(2);
    });

    it.each([
        ['ArrowUp', 'up'],
        ['ArrowDown', 'down'],
        ['ArrowLeft', 'left'],
        ['ArrowRight', 'right']
    ])('keeps %s repeats for navigation', (key, command) => {
        expect(press({ key }).defaultPrevented).toBe(true);
        expect(press({ key, repeat: true }).defaultPrevented).toBe(true);
        expect(inputManager.handleCommand.mock.calls).toEqual([[command], [command]]);
    });

    it.each([
        '<input>',
        '<textarea></textarea>',
        '<select><option>One</option></select>',
        '<div contenteditable="true" tabindex="0">Text</div>'
    ])('preserves native Enter for %s', markup => {
        focus(markup);
        expect(press({ key: 'Enter' }).defaultPrevented).toBe(false);
        expect(inputManager.handleCommand).not.toHaveBeenCalled();
    });

    it.each(['checkbox', 'radio', 'button', 'submit', 'reset'])('activates %s inputs with remote Enter', type => {
        const element = focus(`<input type="${type}">`);
        const click = vi.fn();
        element.addEventListener('click', click);
        inputManager.handleCommand.mockImplementationOnce(command => {
            if (command === 'select') element.click();
        });

        expect(press({ key: 'Enter' }).defaultPrevented).toBe(true);
        expect(press({ key: 'Enter', repeat: true }).defaultPrevented).toBe(true);
        expect(inputManager.handleCommand.mock.calls).toEqual([['select']]);
        expect(click).toHaveBeenCalledOnce();
        if (type === 'checkbox' || type === 'radio') {
            expect(element.checked).toBe(true);
        }
    });

    it.each([
        '<textarea></textarea>',
        '<div contenteditable="true" tabindex="0">Text</div>',
        '<div contenteditable="" tabindex="0">Text</div>',
        '<div contenteditable="plaintext-only" tabindex="0">Text</div>'
    ])('preserves all editing arrows for %s', markup => {
        focus(markup);
        for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
            expect(press({ key, repeat: true }).defaultPrevented).toBe(false);
        }
        expect(inputManager.handleCommand).not.toHaveBeenCalled();
    });

    it('preserves select up/down but allows left/right focus navigation', () => {
        focus('<select><option>One</option><option>Two</option></select>');
        expect(press({ key: 'ArrowUp' }).defaultPrevented).toBe(false);
        expect(press({ key: 'ArrowDown', repeat: true }).defaultPrevented).toBe(false);
        expect(press({ key: 'ArrowLeft' }).defaultPrevented).toBe(true);
        expect(press({ key: 'ArrowRight' }).defaultPrevented).toBe(true);
        expect(inputManager.handleCommand.mock.calls).toEqual([['left'], ['right']]);
    });

    it('preserves text input horizontal editing and vertical navigation', () => {
        focus('<input>');
        expect(press({ key: 'ArrowLeft' }).defaultPrevented).toBe(false);
        expect(press({ key: 'ArrowRight' }).defaultPrevented).toBe(false);
        press({ key: 'ArrowUp' });
        press({ key: 'ArrowDown' });
        expect(inputManager.handleCommand.mock.calls).toEqual([['up'], ['down']]);
    });

    it.each(['number', 'range'])('preserves native value adjustment for %s inputs', type => {
        focus(`<input type="${type}">`);
        for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
            expect(press({ key }).defaultPrevented).toBe(false);
        }
        expect(inputManager.handleCommand).not.toHaveBeenCalled();
    });

    it.each([
        '<input>',
        '<textarea></textarea>',
        '<div contenteditable="true" tabindex="0">Text</div>'
    ])('does not hijack Hisense Backspace in %s', markup => {
        Object.assign(browser, { hisense: true, vidaa: true });
        focus(markup);
        expect(press({ keyCode: 8 }).defaultPrevented).toBe(false);
        expect(press({ keyCode: 8, repeat: true }).defaultPrevented).toBe(false);
        expect(inputManager.handleCommand).not.toHaveBeenCalled();
    });

    it('recognizes inherited contenteditable and explicit non-editable children', () => {
        focus('<div contenteditable="true" tabindex="0"><span tabindex="0">Text</span><span contenteditable="false" tabindex="0">Button</span></div>');
        const [editable, nonEditable] = document.querySelectorAll('span');
        editable.focus();
        expect(press({ key: 'Enter' }).defaultPrevented).toBe(false);
        expect(press({ key: 'ArrowLeft' }).defaultPrevented).toBe(false);
        nonEditable.focus();
        expect(press({ key: 'Enter' }).defaultPrevented).toBe(true);
        expect(inputManager.handleCommand.mock.calls).toEqual([['select']]);
    });

    it('uses ordinary Backspace for TV back navigation', () => {
        expect(press({ keyCode: 8 }).defaultPrevented).toBe(true);
        expect(inputManager.handleCommand).toHaveBeenCalledWith('back');
    });

    it('preserves desktop Enter and arrow behavior and existing GamepadA support', () => {
        layoutManager.tv = false;
        expect(press({ key: 'Enter' }).defaultPrevented).toBe(false);
        expect(press({ key: 'ArrowLeft' }).defaultPrevented).toBe(false);
        expect(press({ key: 'Escape' }).defaultPrevented).toBe(false);
        expect(press({ key: 'GamepadA', repeat: true }).defaultPrevented).toBe(true);
        expect(inputManager.handleCommand.mock.calls).toEqual([['select']]);
    });

    it.each([
        ['ArrowUp', 'up'], ['ArrowDown', 'down'], ['ArrowLeft', 'left'], ['ArrowRight', 'right'],
        ['Enter', 'select'], ['Escape', 'back'], ['Backspace', 'back']
    ])('supports %s in the modern desktop layout', (key, command) => {
        layoutManager.tv = false;
        layoutManager.modern = true;
        focus('<button>Movie</button>');
        expect(press({ key }).defaultPrevented).toBe(true);
        expect(inputManager.handleCommand).toHaveBeenCalledWith(command);
    });

    it.each(['ArrowUp', 'Enter', 'Escape', 'Backspace'])('does not cancel unused %s', key => {
        inputManager.handleCommand.mockReturnValueOnce(false);
        expect(press({ key }).defaultPrevented).toBe(false);
        expect(document.documentElement.classList.contains('directionalNavigation')).toBe(false);
    });

    it('switches focus styling without cancelling pointer or wheel events', () => {
        press({ key: 'ArrowRight' });
        expect(document.documentElement.classList.contains('directionalNavigation')).toBe(true);
        const mouse = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        document.body.dispatchEvent(mouse);
        expect(mouse.defaultPrevented).toBe(false);
        expect(document.documentElement.classList.contains('directionalNavigation')).toBe(false);
        const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true });
        document.body.dispatchEvent(wheel);
        expect(wheel.defaultPrevented).toBe(false);
    });

    it('does not handle IME composition keys', () => {
        expect(press({ key: 'Enter', isComposing: true }).defaultPrevented).toBe(false);
        expect(inputManager.handleCommand).not.toHaveBeenCalled();
    });

    it.each([
        [{ keyCode: 19 }, 'pause'],
        [{ key: 'MediaPause' }, 'pause'],
        [{ keyCode: 179 }, 'playpause'],
        [{ key: 'MediaPlay' }, 'play']
    ])('dispatches media event %j', (event, command) => {
        expect(press(event).defaultPrevented).toBe(true);
        expect(inputManager.handleCommand).toHaveBeenCalledWith(command);
    });

    it.each(['ctrlKey', 'altKey', 'metaKey', 'shiftKey'])('ignores %s modified events', modifier => {
        expect(press({ key: 'Enter', [modifier]: true }).defaultPrevented).toBe(false);
        expect(inputManager.handleCommand).not.toHaveBeenCalled();
    });

    it('leaves already handled events alone', () => {
        const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
        event.preventDefault();
        window.dispatchEvent(event);
        expect(inputManager.handleCommand).not.toHaveBeenCalled();
    });
});
