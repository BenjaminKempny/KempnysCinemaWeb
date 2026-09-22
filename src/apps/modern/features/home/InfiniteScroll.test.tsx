import React, { act, createRef, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import InfiniteScroll from './InfiniteScroll';

const observers: TestObserver[] = [];

class TestObserver implements IntersectionObserver {
    readonly root;
    readonly rootMargin;
    readonly thresholds = [0];
    readonly observe = vi.fn<(target: Element) => void>();
    readonly unobserve = vi.fn();
    readonly disconnect = vi.fn();
    readonly takeRecords = () => [];

    constructor(private readonly callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.root = options?.root ?? null;
        this.rootMargin = options?.rootMargin ?? '';
        observers.push(this);
    }

    intersect(isIntersecting: boolean) {
        const target = this.observe.mock.calls[0][0];
        const rect = target.getBoundingClientRect();
        act(() => this.callback([{
            target,
            isIntersecting,
            intersectionRatio: isIntersecting ? 1 : 0,
            boundingClientRect: rect,
            intersectionRect: rect,
            rootBounds: null,
            time: 0
        }], this));
    }
}

let container: HTMLDivElement;
let root: Root;
let query: React.ComponentProps<typeof InfiniteScroll>['query'];

function render(queryKey = 'movies') {
    act(() => root.render(
        <StrictMode>
            <InfiniteScroll query={query} queryKey={queryKey} />
        </StrictMode>
    ));
}

function latestObserver() {
    return observers[observers.length - 1];
}

function renderCards(count = 6) {
    const itemsRef = createRef<HTMLDivElement>();
    act(() => root.render(
        <StrictMode>
            <div ref={itemsRef}>
                {Array.from({ length: count }, (_, index) => <article key={index}><button>Movie {index}</button></article>)}
            </div>
            <InfiniteScroll query={query} queryKey='movies' itemsRef={itemsRef} />
        </StrictMode>
    ));
    return itemsRef.current?.lastElementChild;
}

beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', TestObserver);
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
    observers.length = 0;
    query = {
        data: { pages: [{ Items: [] }] },
        hasNextPage: true,
        isFetching: false,
        isError: false,
        fetchNextPage: vi.fn().mockResolvedValue({})
    };
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('cinema infinite scroll', () => {
    it('loads from the last visible card when nearest-focus scrolling leaves the sentinel clipped', () => {
        const lastCard = renderCards();
        const sentinelObserver = [...observers].reverse().find(observer => observer.observe.mock.calls[0]?.[0].getAttribute('aria-hidden') === 'true');
        const cardObserver = [...observers].reverse().find(observer => observer.observe.mock.calls[0]?.[0] === lastCard);
        expect(cardObserver).toBeDefined();
        sentinelObserver?.intersect(false);
        expect(query.fetchNextPage).not.toHaveBeenCalled();
        cardObserver?.intersect(true);
        expect(query.fetchNextPage).toHaveBeenCalledOnce();
        sentinelObserver?.intersect(true);
        cardObserver?.intersect(true);
        expect(query.fetchNextPage).toHaveBeenCalledOnce();
    });

    it('observes the new last card after appending a page without losing the current focus', () => {
        const lastCard = renderCards();
        const firstObserver = latestObserver();
        const focused = lastCard?.querySelector('button');
        act(() => focused?.focus());
        firstObserver.intersect(true);
        expect(query.fetchNextPage).toHaveBeenCalledOnce();
        query = { ...query, data: { pages: [{}, {}] } };
        const nextLastCard = renderCards(12);
        expect(firstObserver.disconnect).toHaveBeenCalled();
        expect(latestObserver().observe).toHaveBeenCalledWith(nextLastCard);
        expect(document.activeElement).toBe(focused);
        latestObserver().intersect(false);
        expect(query.fetchNextPage).toHaveBeenCalledOnce();
        latestObserver().intersect(true);
        expect(query.fetchNextPage).toHaveBeenCalledTimes(2);
    });

    it('observes the last section for paginated genre rows without a separate items container', () => {
        act(() => root.render(<>
            <section><button>Last genre</button></section>
            <InfiniteScroll query={query} queryKey='genres' />
        </>));
        expect(latestObserver().observe).toHaveBeenCalledWith(container.querySelector('section'));
        latestObserver().intersect(true);
        expect(query.fetchNextPage).toHaveBeenCalledOnce();
    });

    it('observes the last item rather than the sentinel inside a nested picker grid', () => {
        const itemsRef = createRef<HTMLDivElement>();
        act(() => root.render(
            <div ref={itemsRef}>
                <label><input type='checkbox' />Movie</label>
                <InfiniteScroll query={query} queryKey='picker' itemsRef={itemsRef} />
            </div>
        ));
        const cardObserver = latestObserver();
        expect(cardObserver.root).toBeNull();
        expect(cardObserver.observe).toHaveBeenCalledWith(container.querySelector('label'));
        cardObserver.intersect(false);
        expect(query.fetchNextPage).not.toHaveBeenCalled();
        cardObserver.intersect(true);
        expect(query.fetchNextPage).toHaveBeenCalledOnce();
        act(() => root.render(null));
        expect(cardObserver.disconnect).toHaveBeenCalled();
    });

    it('does not fetch hidden last items or retry errors when the last item is visible', () => {
        renderCards();
        latestObserver().intersect(false);
        expect(query.fetchNextPage).not.toHaveBeenCalled();
        query = { ...query, isError: true };
        renderCards();
        latestObserver().intersect(true);
        expect(query.fetchNextPage).not.toHaveBeenCalled();
    });

    it('waits until near the viewport, respecting nested clipping with the viewport root', () => {
        render();
        expect(latestObserver().root).toBeNull();
        expect(latestObserver().rootMargin).toBe('200px');
        latestObserver().intersect(false);
        expect(query.fetchNextPage).not.toHaveBeenCalled();
        latestObserver().intersect(true);
        expect(query.fetchNextPage).toHaveBeenCalledOnce();
    });

    it('guards duplicate intersections and rerenders before fetching state updates', () => {
        query.fetchNextPage = vi.fn(() => new Promise(() => undefined));
        render();
        latestObserver().intersect(true);
        latestObserver().intersect(false);
        latestObserver().intersect(true);
        render();
        expect(query.fetchNextPage).toHaveBeenCalledOnce();
    });

    it('waits for an existing fetch to finish', () => {
        query.isFetching = true;
        render();
        latestObserver().intersect(true);
        expect(query.fetchNextPage).not.toHaveBeenCalled();
        query = { ...query, isFetching: false };
        render();
        expect(query.fetchNextPage).toHaveBeenCalledOnce();
    });

    it('does not automatically retry errors', async () => {
        query.fetchNextPage = vi.fn().mockRejectedValue(new Error('Unavailable'));
        render();
        latestObserver().intersect(true);
        await act(async () => undefined);
        query = { ...query, isError: true };
        render();
        latestObserver().intersect(false);
        latestObserver().intersect(true);
        expect(query.fetchNextPage).toHaveBeenCalledOnce();
    });

    it('blocks a visible sentinel on an existing query error until explicit retry succeeds', () => {
        query.isError = true;
        render();
        latestObserver().intersect(true);
        expect(query.fetchNextPage).not.toHaveBeenCalled();
        query = { ...query, isError: false, data: { pages: [{}, {}] } };
        render();
        latestObserver().intersect(true);
        expect(query.fetchNextPage).toHaveBeenCalledOnce();
    });

    it('continues through empty filtered pages while visible but rechecks each new page', () => {
        render();
        for (let count = 1; count <= 3; count++) {
            const previousObserver = latestObserver();
            previousObserver.intersect(true);
            expect(query.fetchNextPage).toHaveBeenCalledTimes(count);
            query = { ...query, data: { pages: Array.from({ length: count + 1 }, () => ({ Items: [] })) } };
            render();
            expect(previousObserver.disconnect).toHaveBeenCalled();
            expect(query.fetchNextPage).toHaveBeenCalledTimes(count);
        }
        latestObserver().intersect(false);
        expect(query.fetchNextPage).toHaveBeenCalledTimes(3);
    });

    it('stops when appended content fills the viewport, and resumes after scrolling', () => {
        render();
        latestObserver().intersect(true);
        query = { ...query, data: { pages: [{}, {}] } };
        render();
        latestObserver().intersect(false);
        expect(query.fetchNextPage).toHaveBeenCalledOnce();
        latestObserver().intersect(true);
        expect(query.fetchNextPage).toHaveBeenCalledTimes(2);
    });

    it('disconnects and removes the sentinel at the end of pagination', () => {
        render();
        const observer = latestObserver();
        query = { ...query, hasNextPage: false };
        render();
        expect(container.childElementCount).toBe(0);
        expect(observer.disconnect).toHaveBeenCalled();
        expect(query.fetchNextPage).not.toHaveBeenCalled();
    });

    it('cleans up on query changes and waits for a fresh intersection', () => {
        render();
        const previousObserver = latestObserver();
        previousObserver.intersect(true);
        const fetchNextPage = vi.fn().mockResolvedValue({});
        query = { ...query, fetchNextPage };
        render('series');
        expect(previousObserver.disconnect).toHaveBeenCalled();
        expect(fetchNextPage).not.toHaveBeenCalled();
        latestObserver().intersect(true);
        expect(fetchNextPage).toHaveBeenCalledOnce();
    });

    it('disconnects on unmount and does not continue when an outstanding fetch settles', async () => {
        let finish: (() => void) | undefined;
        query.fetchNextPage = vi.fn(() => new Promise<void>(resolve => {
            finish = resolve;
        }));
        render();
        const observer = latestObserver();
        observer.intersect(true);
        act(() => root.render(null));
        expect(observer.disconnect).toHaveBeenCalled();
        await act(async () => finish?.());
        expect(query.fetchNextPage).toHaveBeenCalledOnce();
    });
});
