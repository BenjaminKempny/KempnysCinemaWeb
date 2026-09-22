/**
 * Key name mapping.
 */
const KeyNames = {
    8: 'Backspace',
    13: 'Enter',
    19: 'Pause',
    27: 'Escape',
    37: 'ArrowLeft',
    38: 'ArrowUp',
    39: 'ArrowRight',
    40: 'ArrowDown',
    179: 'MediaPlayPause',

    // UWP WebView section start --
    // Navigation Up/Down/Left/Right is part of TVJS directionalnavigation-1.0.0.0.js
    // Unsure what this is used for. Media remote?
    138: 'NavigationUp',
    139: 'NavigationDown',
    140: 'NavigationLeft',
    141: 'NavigationRight',
    195: 'GamepadA',
    // Currently Xbox UWP WebView 2 sends code 27 (Escape instead) despite being undocumented
    // Desktop UWP unchanged
    196: 'GamepadB',
    203: 'GamepadDPadUp',
    204: 'GamepadDPadDown',
    205: 'GamepadDPadLeft',
    206: 'GamepadDPadRight',
    // Currently Xbox UWP WebView 2 sends Arrow keycodes despite being undocumented
    // Desktop UWP unchanged
    // Left Thumbstick
    211: 'GamepadLeftThumbUp',
    212: 'GamepadLeftThumbDown',
    214: 'GamepadLeftThumbLeft',
    213: 'GamepadLeftThumbRight',
    // End of UWP WebView Section

    // MediaRewind (Tizen/WebOS)
    412: 'MediaRewind',
    // MediaStop (Tizen/WebOS)
    413: 'MediaStop',
    // MediaPlay (Tizen/WebOS)
    415: 'MediaPlay',
    // MediaFastForward (Tizen/WebOS)
    417: 'MediaFastForward',
    // Back (WebOS)
    461: 'Back',
    // Back (Tizen)
    10009: 'Back',
    // MediaTrackPrevious (Tizen)
    10232: 'MediaTrackPrevious',
    // MediaTrackNext (Tizen)
    10233: 'MediaTrackNext',
    // MediaPlayPause (Tizen)
    10252: 'MediaPlayPause'
};

const KeyAliases = {
    Left: 'ArrowLeft',
    Up: 'ArrowUp',
    Right: 'ArrowRight',
    Down: 'ArrowDown',
    Esc: 'Escape',
    Select: 'Enter',
    BrowserBack: 'Back',
    GoBack: 'Back',
    MediaPause: 'Pause',
    // GamepadA needs special case handling
    GamepadB: 'Escape',
    NavigationUp: 'ArrowUp',
    NavigationDown: 'ArrowDown',
    NavigationLeft: 'ArrowLeft',
    NavigationRight: 'ArrowRight',
    GamepadDPadUp: 'ArrowUp',
    GamepadDPadDown: 'ArrowDown',
    GamepadDPadLeft: 'ArrowLeft',
    GamepadDPadRight: 'ArrowRight',
    GamepadLeftThumbUp: 'ArrowUp',
    GamepadLeftThumbDown: 'ArrowDown',
    GamepadLeftThumbLeft: 'ArrowLeft',
    GamepadLeftThumbRight: 'ArrowRight'
};

/**
 * Keys used for keyboard navigation.
 */
const NavigationKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'BrowserHome', 'Find'];

/**
 * Keys used for media playback control.
 */
const MediaKeys = ['MediaRewind', 'MediaStop', 'MediaPlay', 'Pause', 'MediaFastForward', 'MediaTrackPrevious', 'MediaTrackNext', 'MediaPlayPause'];

/**
 * Elements for which navigation should be constrained.
 */
const InteractiveElements = ['INPUT', 'TEXTAREA'];

/**
 * Types of INPUT element for which navigation shouldn't be constrained.
 */
const NonInteractiveInputElements = ['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'reset', 'submit'];

/**
 * Returns key name from event.
 *
 * @param {KeyboardEvent} event - Keyboard event.
 * @return {string} Key name.
 */
export function getKeyName(event) {
    const code = event.code === 'Unidentified' ? '' : event.code;
    const key = KeyNames[event.keyCode] || code || event.key || '';
    return KeyAliases[key] || key;
}

/**
 * Returns _true_ if key is used for navigation.
 *
 * @param {string} key - Key name.
 * @return {boolean} _true_ if key is used for navigation.
 */
export function isNavigationKey(key) {
    return NavigationKeys.indexOf(key) != -1;
}

/**
 * Returns _true_ if key is used for media playback control.
 *
 * @param {string} key - Key name.
 * @return {boolean} _true_ if key is used for media playback control.
 */
export function isMediaKey(key) {
    return MediaKeys.includes(key);
}

export function isContentEditable(element) {
    const editable = element?.closest('[contenteditable]');
    return !!(element?.isContentEditable || (editable
        && ['', 'true', 'plaintext-only'].includes(editable.getAttribute('contenteditable').toLowerCase())));
}

/**
 * Returns _true_ if the element is interactive.
 *
 * @param {Element | null} element - Element.
 * @return {boolean} _true_ if the element is interactive.
 */
export function isInteractiveElement(element) {
    if (element && InteractiveElements.includes(element.tagName)) {
        if (element.tagName === 'INPUT') {
            return !NonInteractiveInputElements.includes(element.type);
        }

        return true;
    }

    return isContentEditable(element);
}
