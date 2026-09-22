import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

import focusManager from 'components/focusManager';

interface FocusPosition {
    key: string | null;
    index: number;
}

const positions = new Map<string, FocusPosition>();

function focusKey(element: Element) {
    const key = element.getAttribute('data-focus-key') || element.getAttribute('href') || element.id;
    const region = element.closest('[data-focus-region]')?.getAttribute('data-focus-region') || '';
    return key ? `${region}:${key}` : null;
}

export default function useCinemaFocus() {
    const container = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const navigationType = useNavigationType();

    useEffect(() => {
        const root = container.current;
        if (!root) return;

        let saved = navigationType === 'POP' ? positions.get(location.key) : undefined;

        const remember = (event: FocusEvent) => {
            if (!(event.target instanceof HTMLElement)) return;
            const key = focusKey(event.target);
            positions.delete(location.key);
            saved = {
                key,
                index: key ? -1 : focusManager.getFocusableElements(root).indexOf(event.target)
            };
            positions.set(location.key, saved);
            if (positions.size > 30) {
                const oldest = positions.keys().next().value;
                if (oldest !== undefined) positions.delete(oldest);
            }
        };

        const restore = () => {
            if (!document.documentElement.contains(root)) return;
            const active = document.activeElement;
            // Do not take focus from a dialog, player, or the user's current selection.
            if (active instanceof HTMLElement && active !== document.body
                && focusManager.isCurrentlyFocusable(active)) return;

            const elements: HTMLElement[] = focusManager.getFocusableElements(root);
            const savedKey = saved?.key;
            const previous = savedKey ? elements.find(element => focusKey(element) === savedKey) : undefined;
            if (saved && !previous && root.querySelector('[role="status"]')) return;

            const preferred = root.querySelector('.cinemaTabs [aria-current="page"], .cinemaContent input, .cinemaContent .cinemaButton');
            const target = previous || (saved && elements[saved.index])
                || elements.find(element => element === preferred) || elements[0];
            if (target) focusManager.focus(target);
        };

        root.addEventListener('focusin', remember);
        const observer = new MutationObserver(restore);
        observer.observe(root, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['disabled', 'hidden', 'inert', 'aria-hidden', 'aria-disabled', 'tabindex', 'class', 'style']
        });
        restore();
        return () => {
            observer.disconnect();
            root.removeEventListener('focusin', remember);
        };
    }, [location.key, location.pathname, location.search, navigationType]);

    return container;
}
