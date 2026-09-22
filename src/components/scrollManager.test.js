import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import layoutManager from './layoutManager';
import { scrollToElement } from './scrollManager';

vi.mock('./layoutManager', () => ({ default: { tv: false } }));
vi.mock('scripts/settings/appSettings', () => ({ default: { enableSmoothScroll: () => false } }));

function createScroller() {
    const scroller = document.createElement('div');
    scroller.style.overflowY = 'auto';
    scroller.style.overflowX = 'auto';
    Object.defineProperties(scroller, {
        scrollHeight: { value: 2000 },
        scrollWidth: { value: 1000 },
        clientHeight: { value: 500 },
        clientWidth: { value: 500 }
    });
    scroller.getBoundingClientRect = () => ({ left: 0, top: 0, width: 500, height: 500 });
    document.body.appendChild(scroller);
    return scroller;
}

function addButton(scroller, top) {
    const button = document.createElement('button');
    button.getBoundingClientRect = () => ({ left: 100, top, width: 100, height: 100 });
    scroller.appendChild(button);
    return button;
}

beforeEach(() => {
    vi.useFakeTimers();
    layoutManager.tv = false;
});

afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    document.body.innerHTML = '';
});

describe('focus-driven scrolling', () => {
    it('does not recenter an already visible control in nearest mode', () => {
        const scroller = createScroller();
        scroller.setAttribute('data-scroll-mode-x', 'nearest');
        scroller.setAttribute('data-scroll-mode-y', 'nearest');
        scrollToElement(addButton(scroller, 200));
        expect(scroller.scrollTop).toBe(0);
        expect(scroller.scrollLeft).toBe(0);
    });

    it('scrolls only far enough to reveal a control below the viewport', () => {
        const scroller = createScroller();
        scroller.setAttribute('data-scroll-mode-y', 'nearest');
        scrollToElement(addButton(scroller, 550));
        expect(scroller.scrollTop).toBe(150);
    });

    it('preserves centered scrolling without the nearest opt-in', () => {
        const scroller = createScroller();
        scrollToElement(addButton(scroller, 550));
        expect(scroller.scrollTop).toBe(350);
    });

    it('only scrolls to the latest focus and supports enabling TV mode after import', () => {
        const scroller = createScroller();
        const first = addButton(scroller, 550);
        const latest = addButton(scroller, 800);
        const firstRect = vi.spyOn(first, 'getBoundingClientRect');
        layoutManager.tv = true;
        first.focus();
        latest.focus();
        vi.runOnlyPendingTimers();
        expect(firstRect).not.toHaveBeenCalled();
        expect(scroller.scrollTop).toBe(600);
    });

    it('does not scroll toward a control removed before the deferred scroll', () => {
        const scroller = createScroller();
        const button = addButton(scroller, 800);
        layoutManager.tv = true;
        button.focus();
        button.remove();
        vi.runOnlyPendingTimers();
        expect(scroller.scrollTop).toBe(0);
    });

    it('leaves desktop focus scrolling to the browser', () => {
        const scroller = createScroller();
        addButton(scroller, 800).focus();
        vi.runOnlyPendingTimers();
        expect(scroller.scrollTop).toBe(0);
    });
});
