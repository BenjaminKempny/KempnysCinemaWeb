import React, { useLayoutEffect, useRef } from 'react';
import ResizeObserver from 'resize-observer-polyfill';

interface PillGeometry {
    left: number;
    top: number;
    width: number;
    height: number;
}

/**
 * Last known geometry per navigation. The sidebar is rebuilt whenever the router
 * swaps pages, so without this the pill would pop into place instead of sliding.
 */
const lastGeometry = new Map<string, PillGeometry>();

function isSameSpot(a: PillGeometry | undefined, b: PillGeometry) {
    return !!a && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
}

/**
 * Keeps a sliding "pill" aligned with the `aria-current="page"` item of a navigation
 * container so switching sections animates the highlight instead of redrawing it.
 *
 * @param id identifies the navigation across page changes so the pill can resume from
 * its previous position; omit it for navigations that never outlive their page.
 */
export function useNavPill<T extends HTMLElement>(activeKey: string | undefined, id?: string) {
    const containerRef = useRef<T>(null);
    const pillRef = useRef<HTMLSpanElement>(null);
    const hasPosition = useRef(false);

    useLayoutEffect(() => {
        const container = containerRef.current;
        const pill = pillRef.current;
        if (!container || !pill) return;

        const active = container.querySelector<HTMLElement>('[aria-current="page"]');
        if (!active) {
            hasPosition.current = false;
            pill.style.opacity = '0';
            if (id) lastGeometry.delete(id);
            return;
        }

        const place = ({ left, top, width, height }: PillGeometry) => {
            pill.style.width = `${width}px`;
            pill.style.height = `${height}px`;
            pill.style.transform = `translate(${left}px, ${top}px)`;
            pill.style.opacity = '1';
        };

        const update = () => {
            // `offsetLeft/Top` include the container border, while the pill is placed
            // against its padding box — subtract the border so both agree.
            const parent = active.offsetParent as HTMLElement | null;
            const target = {
                left: active.offsetLeft - (parent?.clientLeft ?? 0),
                top: active.offsetTop - (parent?.clientTop ?? 0),
                width: active.offsetWidth,
                height: active.offsetHeight
            };

            if (hasPosition.current) {
                place(target);
            } else {
                // Resume from the previous page's pill so the move stays animated,
                // but never slide in from the container origin on a cold start.
                const previous = id ? lastGeometry.get(id) : undefined;
                pill.style.transition = 'none';
                place(previous && !isSameSpot(previous, target) ? previous : target);
                // Force a reflow so the restored transition animates towards the target.
                pill.getBoundingClientRect();
                pill.style.transition = '';
                place(target);
                hasPosition.current = true;
            }

            if (id) lastGeometry.set(id, target);
        };

        update();

        const observer = new ResizeObserver(update);
        observer.observe(container);
        observer.observe(active);
        return () => observer.disconnect();
    }, [activeKey, id]);

    return { containerRef, pillRef };
}

export default function NavPill({ pillRef }: Readonly<{ pillRef: React.RefObject<HTMLSpanElement> }>) {
    return <span ref={pillRef} className='cinemaNavPill' aria-hidden='true' />;
}
