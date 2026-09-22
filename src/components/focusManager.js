import dom from '../utils/dom';
import scrollManager from './scrollManager';
import layoutManager from './layoutManager';

const scopes = [];
function pushScope(elem) {
    scopes.push(elem);
}

function popScope() {
    if (scopes.length) {
        scopes.length -= 1;
    }
}

function autoFocus(view, defaultToFirst, findAutoFocusElement) {
    let element;
    if (findAutoFocusElement !== false) {
        element = view.querySelector('*[autofocus]');
        if (isCurrentlyFocusable(element)) {
            focus(element);
            return element;
        }
    }

    if (defaultToFirst !== false) {
        element = getFocusableElements(view, 1, 'noautofocus')[0];

        if (element) {
            focus(element);
            return element;
        }
    }

    return null;
}

function focus(element) {
    try {
        element.focus({
            preventScroll: scrollManager.isEnabled() || layoutManager.modern
        });
    } catch (err) {
        console.error('Error in focusManager.autoFocus: ' + err);
    }
    if (layoutManager.modern && !scrollManager.isEnabled() && document.activeElement === element) {
        if (element.closest('[data-scroll-mode-x="custom"], [data-scroll-mode-y="custom"]')) {
            // Transformed legacy scrollers handle their own axis on focus.
            scrollManager.scrollToElement(element, false);
        } else {
            element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
        }
    }
}

const focusableTagNames = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'];
const focusableContainerTagNames = ['BODY', 'DIALOG'];
const focusableQuery = focusableTagNames.map(function (t) {
    if (t === 'A') t += '[href]';
    if (t === 'INPUT') {
        t += ':not([type="range"]):not([type="file"])';
    }
    return t + ':not([tabindex="-1"]):not(:disabled)';
}).join(',') + ',.focusable,[tabindex]';

function isFocusable(elem) {
    return elem?.matches?.(focusableQuery) || false;
}

function normalizeFocusable(elem, originalElement) {
    if (elem) {
        const tagName = elem.tagName;
        if (!tagName || tagName === 'HTML' || tagName === 'BODY') {
            elem = originalElement;
        }
    }

    return elem;
}

function focusableParent(elem) {
    const originalElement = elem;

    while (!isFocusable(elem)) {
        const parent = elem.parentNode;

        if (!parent) {
            return normalizeFocusable(elem, originalElement);
        }

        elem = parent;
    }

    return normalizeFocusable(elem, originalElement);
}

// Determines if a focusable element can be focused at a given point in time
function isCurrentlyFocusableInternal(elem) {
    if (!elem || !document.documentElement.contains(elem)
        || elem.closest('[hidden], [inert], [aria-hidden="true"], [aria-disabled="true"]')
        || elem.matches(':disabled, [disabled]') || (elem.hasAttribute('tabindex') && elem.tabIndex < 0)) {
        return false;
    }
    if (!elem.getClientRects().length) {
        return false;
    }
    const style = window.getComputedStyle(elem);
    if (style.visibility === 'hidden' || style.visibility === 'collapse' || style.opacity === '0') return false;
    for (let parent = elem.parentElement; parent; parent = parent.parentElement) {
        if (window.getComputedStyle(parent).opacity === '0') return false;
    }
    return true;
}

// Determines if a focusable element can be focused at a given point in time
function isCurrentlyFocusable(elem) {
    if (!isFocusable(elem)) {
        return false;
    }
    if (!elem.classList?.contains('focusable')) {
        if (elem.disabled) {
            return false;
        }

        if (elem.getAttribute('tabindex') === '-1') {
            return false;
        }

        if (elem.tagName === 'INPUT') {
            const type = elem.type;
            if (type === 'range') {
                return false;
            }
            if (type === 'file') {
                return false;
            }
        }
    }

    return isCurrentlyFocusableInternal(elem);
}

function getDefaultScope() {
    if (scopes.length) return scopes[scopes.length - 1];
    const dialogs = document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"], .dialog.opened');
    for (let i = dialogs.length - 1; i >= 0; i--) {
        const dialog = dialogs[i];
        if (!dialog.closest('[hidden], [inert], [aria-hidden="true"]')
            && dialog.getClientRects().length && window.getComputedStyle(dialog).visibility !== 'hidden') {
            return dialog;
        }
    }
    return document.body;
}

function getFocusableElements(parent, limit, excludeClass) {
    const elems = (parent || getDefaultScope()).querySelectorAll(focusableQuery);
    const focusableElements = [];

    for (let i = 0, length = elems.length; i < length; i++) {
        const elem = elems[i];

        if (excludeClass && elem.classList.contains(excludeClass)) {
            continue;
        }

        if (isCurrentlyFocusable(elem)) {
            focusableElements.push(elem);

            if (limit && focusableElements.length >= limit) {
                break;
            }
        }
    }

    return focusableElements;
}

function isFocusContainer(elem, direction) {
    if (focusableContainerTagNames.indexOf(elem.tagName) !== -1
        || elem.getAttribute('role') === 'dialog'
        || elem.getAttribute('role') === 'alertdialog'
        || elem === getDefaultScope()) {
        return true;
    }

    const classList = elem.classList;

    if (classList.contains('focuscontainer')) {
        return true;
    }

    if (direction === 0) {
        if (classList.contains('focuscontainer-x')) {
            return true;
        }
        if (classList.contains('focuscontainer-left')) {
            return true;
        }
    } else if (direction === 1) {
        if (classList.contains('focuscontainer-x')) {
            return true;
        }
        if (classList.contains('focuscontainer-right')) {
            return true;
        }
    } else if (direction === 2) {
        if (classList.contains('focuscontainer-y')) {
            return true;
        }
    } else if (direction === 3) {
        if (classList.contains('focuscontainer-y')) {
            return true;
        }
        if (classList.contains('focuscontainer-down')) {
            return true;
        }
    }

    return false;
}

function getFocusContainer(elem, direction) {
    while (!isFocusContainer(elem, direction)) {
        elem = elem.parentNode;

        if (!elem) {
            return getDefaultScope();
        }
    }

    return elem;
}

function getOffset(elem) {
    let box;

    // Support: BlackBerry 5, iOS 3 (original iPhone)
    // If we don't have gBCR, just use 0,0 rather than error
    if (elem.getBoundingClientRect) {
        box = elem.getBoundingClientRect();
    } else {
        box = {
            top: 0,
            left: 0,
            width: 0,
            height: 0
        };
    }

    if (box.right === null) {
        // Create a new object because some browsers will throw an error when trying to set data onto the Rect object
        const newBox = {
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height
        };

        box = newBox;

        box.right = box.left + box.width;
        box.bottom = box.top + box.height;
    }

    return box;
}

function nav(activeElement, direction, container, focusableElements) {
    activeElement = activeElement || document.activeElement;

    if (activeElement) {
        activeElement = focusableParent(activeElement);
    }
    const scope = getDefaultScope();
    if (scope !== document.body && !scope.contains(activeElement)) {
        activeElement = null;
    }

    container = container || (activeElement ? getFocusContainer(activeElement, direction) : getDefaultScope());

    if (!isCurrentlyFocusable(activeElement) || activeElement === container) {
        return !!autoFocus(container, true, false);
    }

    const focusableContainer = dom.parentWithClass(activeElement, 'focusable');

    const rect = getOffset(activeElement);

    // Get elements and work out x/y points
    const point1x = parseFloat(rect.left) || 0;
    const point1y = parseFloat(rect.top) || 0;
    const point2x = parseFloat(point1x + rect.width - 1) || point1x;
    const point2y = parseFloat(point1y + rect.height - 1) || point1y;

    const sourceMidX = rect.left + (rect.width / 2);
    const sourceMidY = rect.top + (rect.height / 2);

    const focusable = focusableElements || container.querySelectorAll(focusableQuery);

    const maxDistance = Infinity;
    let minDistance = maxDistance;
    let nearestElement;
    const directional = layoutManager.modern || !!activeElement.closest('[data-directional-navigation]');
    let nearestAligned = false;
    let nearestCrossDistance = Infinity;

    for (let i = 0, length = focusable.length; i < length; i++) {
        const curr = focusable[i];

        if (curr === activeElement) {
            continue;
        }
        // Don't refocus into the same container
        if (curr === focusableContainer) {
            continue;
        }
        if (curr.matches(':disabled, [tabindex="-1"]')) {
            continue;
        }

        const elementRect = getOffset(curr);
        const midX = elementRect.left + (elementRect.width / 2);
        const midY = elementRect.top + (elementRect.height / 2);
        const contained = directional && elementRect.left >= rect.left && elementRect.right <= rect.right
            && elementRect.top >= rect.top && elementRect.bottom <= rect.bottom;

        // not currently visible
        if (!elementRect.width && !elementRect.height) {
            continue;
        }

        switch (direction) {
            case 0:
                // left
                if (directional ? contained || midX >= sourceMidX : elementRect.left >= rect.left) {
                    continue;
                }
                if (!directional && elementRect.right === rect.right) {
                    continue;
                }
                break;
            case 1:
                // right
                if (directional ? contained || midX <= sourceMidX : elementRect.right <= rect.right) {
                    continue;
                }
                if (!directional && elementRect.left === rect.left) {
                    continue;
                }
                break;
            case 2:
                // up
                if (directional ? midY >= sourceMidY : elementRect.top >= rect.top) {
                    continue;
                }
                if (!directional && elementRect.bottom >= rect.bottom) {
                    continue;
                }
                break;
            case 3:
                // down
                if (directional ? midY <= sourceMidY : elementRect.bottom <= rect.bottom) {
                    continue;
                }
                if (!directional && elementRect.top <= rect.top) {
                    continue;
                }
                break;
            default:
                break;
        }

        if (!isCurrentlyFocusable(curr)) {
            continue;
        }

        const x = elementRect.left;
        const y = elementRect.top;
        const x2 = x + elementRect.width - 1;
        const y2 = y + elementRect.height - 1;

        const intersectX = intersects(point1x, point2x, x, x2);
        const intersectY = intersects(point1y, point2y, y, y2);

        let distX;
        let distY;

        switch (direction) {
            case 0:
                // left
                distX = Math.abs(point1x - Math.min(point1x, x2));
                distY = intersectY ? 0 : Math.abs(sourceMidY - midY);
                break;
            case 1:
                // right
                distX = Math.abs(point2x - Math.max(point2x, x));
                distY = intersectY ? 0 : Math.abs(sourceMidY - midY);
                break;
            case 2:
                // up
                distY = Math.abs(point1y - Math.min(point1y, y2));
                distX = intersectX ? 0 : Math.abs(sourceMidX - midX);
                break;
            case 3:
                // down
                distY = Math.abs(point2y - Math.max(point2y, y));
                distX = intersectX ? 0 : Math.abs(sourceMidX - midX);
                break;
            default:
                break;
        }

        const dist = Math.sqrt(distX * distX + distY * distY);
        const aligned = direction < 2 ? intersectY : intersectX;
        const crossDistance = direction < 2 ? Math.abs(sourceMidY - midY) : Math.abs(sourceMidX - midX);
        // Prefer the current row/column, and preserve the column when gaps tie.
        const isNearer = dist < minDistance
            || (directional && dist === minDistance && crossDistance < nearestCrossDistance);
        if ((!directional && isNearer)
            || (directional && ((aligned && !nearestAligned) || (aligned === nearestAligned && isNearer)))) {
            nearestElement = curr;
            minDistance = dist;
            nearestAligned = aligned;
            nearestCrossDistance = crossDistance;
        }
    }

    if (nearestElement) {
        // See if there's a focusable container, and if so, send the focus command to that
        if (activeElement) {
            const nearestElementFocusableParent = dom.parentWithClass(nearestElement, 'focusable');
            if (nearestElementFocusableParent
                    && nearestElementFocusableParent !== nearestElement
                    && focusableContainer !== nearestElementFocusableParent
                    && isCurrentlyFocusable(nearestElementFocusableParent)
            ) {
                nearestElement = nearestElementFocusableParent;
            }
        }
        focus(nearestElement);
    }
    // At a navigation boundary the key is still consumed, without scrolling the page.
    return true;
}

function intersectsInternal(a1, a2, b1, b2) {
    return (b1 >= a1 && b1 <= a2) || (b2 >= a1 && b2 <= a2);
}

function intersects(a1, a2, b1, b2) {
    // eslint-disable-next-line sonarjs/arguments-order
    return intersectsInternal(a1, a2, b1, b2) || intersectsInternal(b1, b2, a1, a2);
}

function sendText(text) {
    const elem = document.activeElement;

    elem.value = text;
}

function focusFirst(container, focusableSelector) {
    const elems = container.querySelectorAll(focusableSelector);

    for (let i = 0, length = elems.length; i < length; i++) {
        const elem = elems[i];

        if (isCurrentlyFocusableInternal(elem)) {
            focus(elem);
            break;
        }
    }
}

function focusLast(container, focusableSelector) {
    const elems = [].slice.call(container.querySelectorAll(focusableSelector), 0).reverse();

    for (let i = 0, length = elems.length; i < length; i++) {
        const elem = elems[i];

        if (isCurrentlyFocusableInternal(elem)) {
            focus(elem);
            break;
        }
    }
}

function moveFocus(sourceElement, container, focusableSelector, offset) {
    const elems = container.querySelectorAll(focusableSelector);
    const list = [];
    let i;
    let length;
    let elem;

    for (i = 0, length = elems.length; i < length; i++) {
        elem = elems[i];

        if (isCurrentlyFocusableInternal(elem)) {
            list.push(elem);
        }
    }

    let currentIndex = -1;

    for (i = 0, length = list.length; i < length; i++) {
        elem = list[i];

        if (sourceElement === elem || elem.contains(sourceElement)) {
            currentIndex = i;
            break;
        }
    }

    if (currentIndex === -1) {
        return;
    }

    let newIndex = currentIndex + offset;
    newIndex = Math.max(0, newIndex);
    newIndex = Math.min(newIndex, list.length - 1);

    const newElem = list[newIndex];
    if (newElem) {
        focus(newElem);
    }
}

export default {
    autoFocus: autoFocus,
    focus: focus,
    focusableParent: focusableParent,
    getFocusableElements: getFocusableElements,
    moveLeft: function (sourceElement, options) {
        const container = options ? options.container : null;
        const focusableElements = options ? options.focusableElements : null;
        return nav(sourceElement, 0, container, focusableElements);
    },
    moveRight: function (sourceElement, options) {
        const container = options ? options.container : null;
        const focusableElements = options ? options.focusableElements : null;
        return nav(sourceElement, 1, container, focusableElements);
    },
    moveUp: function (sourceElement, options) {
        const container = options ? options.container : null;
        const focusableElements = options ? options.focusableElements : null;
        return nav(sourceElement, 2, container, focusableElements);
    },
    moveDown: function (sourceElement, options) {
        const container = options ? options.container : null;
        const focusableElements = options ? options.focusableElements : null;
        return nav(sourceElement, 3, container, focusableElements);
    },
    sendText: sendText,
    isCurrentlyFocusable: isCurrentlyFocusable,
    pushScope: pushScope,
    popScope: popScope,
    focusFirst: focusFirst,
    focusLast: focusLast,
    moveFocus: moveFocus
};
