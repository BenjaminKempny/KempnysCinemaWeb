import React, { type RefObject, useCallback, useEffect, useRef } from 'react';
import { useIntersectionObserver } from 'usehooks-ts';

interface InfiniteScrollQuery {
    data?: { pages: unknown[] };
    hasNextPage?: boolean;
    isFetching: boolean;
    isError: boolean;
    fetchNextPage: () => Promise<unknown>;
}

function PageSentinel({ query, itemsRef }: Readonly<{ query: InfiniteScrollQuery; itemsRef?: RefObject<HTMLElement> }>) {
    const requested = useRef(false);
    const sentinel = useRef<HTMLDivElement | null>(null);
    const { ref, isIntersecting } = useIntersectionObserver({ rootMargin: '200px' });
    const { ref: observeLastItem, isIntersecting: isLastItemVisible } = useIntersectionObserver({ rootMargin: '200px' });
    const { hasNextPage, isFetching, isError, fetchNextPage } = query;
    const setSentinel = useCallback((element: HTMLDivElement | null) => {
        sentinel.current = element;
        ref(element);
    }, [ref]);

    useEffect(() => {
        // Focus scrolling stops at the last card, before the sentinel enters a clipped scroll area.
        const last = itemsRef ? itemsRef.current?.lastElementChild : sentinel.current?.previousElementSibling;
        observeLastItem(last === sentinel.current ? last?.previousElementSibling ?? null : last ?? null);
    }, [itemsRef, query.data, observeLastItem]);

    useEffect(() => {
        if ((!isIntersecting && !isLastItemVisible) || !hasNextPage || isFetching || isError || requested.current) return;
        requested.current = true;
        void fetchNextPage().catch(error => {
            console.error('[CinemaInfiniteScroll] Failed to load the next page', error);
        });
    }, [isIntersecting, isLastItemVisible, hasNextPage, isFetching, isError, fetchNextPage]);

    return <div ref={setSentinel} aria-hidden='true' style={{ height: 1, gridColumn: '1 / -1' }} />;
}

export default function InfiniteScroll({ query, queryKey, itemsRef }: Readonly<{
    query: InfiniteScrollQuery;
    queryKey: string;
    itemsRef?: RefObject<HTMLElement>;
}>) {
    // Re-observe after every page, even an empty filtered page. The old intersection
    // can be stale after new content pushes the sentinel outside a scroll container.
    return query.hasNextPage ? <PageSentinel key={JSON.stringify([queryKey, query.data?.pages.length])} query={query} itemsRef={itemsRef} /> : null;
}
