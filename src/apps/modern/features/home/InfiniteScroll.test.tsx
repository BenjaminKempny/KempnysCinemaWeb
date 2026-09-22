import React, { act, StrictMode } from 'react';
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
