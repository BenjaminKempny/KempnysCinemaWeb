import React, { useEffect, useRef } from 'react';
import { useIntersectionObserver } from 'usehooks-ts';

interface InfiniteScrollQuery {
    data?: { pages: unknown[] };
    hasNextPage?: boolean;
    isFetching: boolean;
    isError: boolean;
    fetchNextPage: () => Promise<unknown>;
}

function PageSentinel({ query }: Readonly<{ query: InfiniteScrollQuery }>) {
    const requested = useRef(false);
    const { ref, isIntersecting } = useIntersectionObserver({ rootMargin: '200px' });
    const { hasNextPage, isFetching, isError, fetchNextPage } = query;

    useEffect(() => {
        if (!isIntersecting || !hasNextPage || isFetching || isError || requested.current) return;
        requested.current = true;
        void fetchNextPage().catch(error => {
            console.error('[CinemaInfiniteScroll] Failed to load the next page', error);
        });
    }, [isIntersecting, hasNextPage, isFetching, isError, fetchNextPage]);

    return <div ref={ref} aria-hidden='true' style={{ height: 1, gridColumn: '1 / -1' }} />;
}

export default function InfiniteScroll({ query, queryKey }: Readonly<{
    query: InfiniteScrollQuery;
    queryKey: string;
}>) {
    // Re-observe after every page, even an empty filtered page. The old intersection
    // can be stale after new content pushes the sentinel outside a scroll container.
    return query.hasNextPage ? <PageSentinel key={JSON.stringify([queryKey, query.data?.pages.length])} query={query} /> : null;
}
