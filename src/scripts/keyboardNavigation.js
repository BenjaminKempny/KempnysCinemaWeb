/**
 * Module for performing keyboard navigation.
 * @module components/input/keyboardnavigation
 */

import browser from './browser';
import inputManager from './inputManager';
import layoutManager from '../components/layoutManager';
import appSettings from './settings/appSettings';
import { getKeyName, isContentEditable, isInteractiveElement, isMediaKey, isNavigationKey } from './keyboardUtils';

import './keyboardNavigation.scss';

export { getKeyName, isInteractiveElement, isMediaKey, isNavigationKey };

function navigationCommand(command) {
    const wasDirectional = document.documentElement.classList.contains('directionalNavigation');
    document.documentElement.classList.add('directionalNavigation');
    const handled = inputManager.handleCommand(command) !== false;
    if (!handled && !wasDirectional) document.documentElement.classList.remove('directionalNavigation');
    return handled;
}

export function enable() {
    const hasMediaSession = 'mediaSession' in navigator;
    const pointerInput = () => document.documentElement.classList.remove('directionalNavigation');
    document.addEventListener('mousedown', pointerInput, { passive: true });
    document.addEventListener('touchstart', pointerInput, { passive: true });
    window.addEventListener('keydown', function (e) {
        if (e.defaultPrevented || e.isComposing) return;

        // Skip modified keys
        if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;

        const key = getKeyName(e);
        const directional = layoutManager.tv || layoutManager.modern;

        // The legacy desktop layout keeps its existing keyboard shortcuts.
        if (!directional && isNavigationKey(key)) {
            return;
        }

        // Ignore Media Keys for non-TV platform having MediaSession API
        if (!browser.tv && isMediaKey(key) && hasMediaSession) {
            return;
        }

        let capture = true;
        const activeElement = document.activeElement;
        const canActivate = !directional || !e.repeat;

        switch (key) {
            case 'ArrowLeft':
                if (!isInteractiveElement(activeElement)) {
                    capture = navigationCommand('left');
                } else {
                    capture = false;
                }
                break;
            case 'ArrowUp':
                if (activeElement?.matches('select, textarea, input[type="number"], input[type="range"]') || isContentEditable(activeElement)) {
                    capture = false;
                } else {
                    capture = navigationCommand('up');
                }
                break;
            case 'ArrowRight':
                if (!isInteractiveElement(activeElement)) {
                    capture = navigationCommand('right');
                } else {
                    capture = false;
                }
                break;
            case 'ArrowDown':
                if (activeElement?.matches('select, textarea, input[type="number"], input[type="range"]') || isContentEditable(activeElement)) {
                    capture = false;
                } else {
                    capture = navigationCommand('down');
                }
                break;

            case 'Enter':
                if (directional && activeElement?.tagName !== 'SELECT' && !isInteractiveElement(activeElement)) {
                    if (canActivate) {
                        capture = navigationCommand('select');
                    }
                } else {
                    capture = false;
                }
                break;
            case 'GamepadA':
                if (canActivate) {
                    inputManager.handleCommand('select');
                }
                break;
            case 'Back':
                if (canActivate) {
                    inputManager.handleCommand('back');
                }
                break;

            case 'Backspace':
                if (directional && activeElement?.tagName !== 'SELECT' && !isInteractiveElement(activeElement)) {
                    if (canActivate) {
                        capture = navigationCommand('back');
                    }
                } else {
                    capture = false;
                }
                break;

            case 'Escape':
                if (directional) {
                    if (canActivate) {
                        capture = navigationCommand('back');
                    }
                } else {
                    capture = false;
                }
                break;

            case 'Find':
                inputManager.handleCommand('search');
                break;
            case 'BrowserHome':
                inputManager.handleCommand('home');
                break;

            case 'MediaPlay':
                inputManager.handleCommand('play');
                break;
            case 'Pause':
                inputManager.handleCommand('pause');
                break;
            case 'MediaPlayPause':
                inputManager.handleCommand('playpause');
                break;
            case 'MediaRewind':
                inputManager.handleCommand('rewind');
                break;
            case 'MediaFastForward':
                inputManager.handleCommand('fastforward');
                break;
            case 'MediaStop':
                inputManager.handleCommand('stop');
                break;
            case 'MediaTrackPrevious':
                inputManager.handleCommand('previoustrack');
                break;
            case 'MediaTrackNext':
                inputManager.handleCommand('nexttrack');
                break;

            default:
                capture = false;
        }

        if (capture) {
            console.debug('disabling default event handling');
            e.preventDefault();
        }
    });
}

export function canEnableGamepad() {
    // Not needed for UWP
    return !browser.edgeUwp;
}

// Gamepad initialisation. No script is required if no gamepads are present at init time, saving a bit of resources.
// Whenever the gamepad is connected, we hand all the control of the gamepad to gamepadtokey.js by removing the event handler
function attachGamepadScript() {
    console.log('Gamepad connected! Attaching gamepadtokey.js script');
    window.removeEventListener('gamepadconnected', attachGamepadScript);
    import('./gamepadtokey');
}

// No need to check for gamepads manually at load time, the eventhandler will be fired for that
if (navigator.getGamepads && appSettings.enableGamepad() && canEnableGamepad()) {
    window.addEventListener('gamepadconnected', attachGamepadScript);
}

export default {
    enable: enable,
    getKeyName: getKeyName,
    isNavigationKey,
    canEnableGamepad
};
