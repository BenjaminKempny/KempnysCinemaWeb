/**
 * Module for performing keyboard navigation.
 * @module components/input/keyboardnavigation
 */

import browser from './browser';
import inputManager from './inputManager';
import layoutManager from '../components/layoutManager';
import appSettings from './settings/appSettings';
import { getKeyName, isContentEditable, isInteractiveElement, isMediaKey, isNavigationKey } from './keyboardUtils';

export { getKeyName, isInteractiveElement, isMediaKey, isNavigationKey };

export function enable() {
    const hasMediaSession = 'mediaSession' in navigator;
    window.addEventListener('keydown', function (e) {
        if (e.defaultPrevented) return;

        // Skip modified keys
        if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;

        const key = getKeyName(e);

        // Ignore navigation keys for non-TV
        if (!layoutManager.tv && isNavigationKey(key)) {
            return;
        }

        // Ignore Media Keys for non-TV platform having MediaSession API
        if (!browser.tv && isMediaKey(key) && hasMediaSession) {
            return;
        }

        let capture = true;
        const activeElement = document.activeElement;
        const canActivate = !layoutManager.tv || !e.repeat;

        switch (key) {
            case 'ArrowLeft':
                if (!isInteractiveElement(activeElement)) {
                    inputManager.handleCommand('left');
                } else {
                    capture = false;
                }
                break;
            case 'ArrowUp':
                if (activeElement?.tagName === 'SELECT' || activeElement?.tagName === 'TEXTAREA' || isContentEditable(activeElement)) {
                    capture = false;
                } else {
                    inputManager.handleCommand('up');
                }
                break;
            case 'ArrowRight':
                if (!isInteractiveElement(activeElement)) {
                    inputManager.handleCommand('right');
                } else {
                    capture = false;
                }
                break;
            case 'ArrowDown':
                if (activeElement?.tagName === 'SELECT' || activeElement?.tagName === 'TEXTAREA' || isContentEditable(activeElement)) {
                    capture = false;
                } else {
                    inputManager.handleCommand('down');
                }
                break;

            case 'Enter':
                if (layoutManager.tv && activeElement?.tagName !== 'SELECT' && !isInteractiveElement(activeElement)) {
                    if (canActivate) {
                        inputManager.handleCommand('select');
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

            // HACK: Hisense TV (VIDAA OS) uses Backspace for Back action
            case 'Backspace':
                if (browser.tv && browser.hisense && browser.vidaa && !isInteractiveElement(activeElement)) {
                    if (canActivate) {
                        inputManager.handleCommand('back');
                    }
                } else {
                    capture = false;
                }
                break;

            case 'Escape':
                if (layoutManager.tv) {
                    if (canActivate) {
                        inputManager.handleCommand('back');
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
