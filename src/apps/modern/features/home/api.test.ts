import { Api } from '@jellyfin/sdk/lib/api';
import type { LibraryApiGetItemsRequest } from '@jellyfin/sdk/lib/generated-client/api/library-api';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { InfiniteQueryObserver, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useApi } from 'hooks/useApi';

import {
    getCinemaCollectionsQuery,
    getCinemaContinueQuery,
    getCinemaGenresQuery,
    getCinemaHeroQuery,
    getCinemaItemsQuery,
    useCinemaCollectionMutations
} from './api';

const requests = vi.hoisted(() => ({
    getItems: vi.fn(),
    getResumeItems: vi.fn(),
    getNextUp: vi.fn(),
    getGenres: vi.fn(),
    createCollection: vi.fn(),
    addToCollection: vi.fn(),
    removeFromCollection: vi.fn()
}));

vi.mock('@jellyfin/sdk/lib/utils/api/library-api', () => ({
    getLibraryApi: () => ({ getItems: requests.getItems, getResumeItems: requests.getResumeItems })
}));
vi.mock('@jellyfin/sdk/lib/utils/api/show-api', () => ({
    getShowApi: () => ({ getNextUp: requests.getNextUp })
}));
vi.mock('@jellyfin/sdk/lib/utils/api/genre-api', () => ({
    getGenreApi: () => ({ getGenres: requests.getGenres })
}));
vi.mock('@jellyfin/sdk/lib/utils/api/collection-api', () => ({
    getCollectionApi: () => ({
        createCollection: requests.createCollection,
        addToCollection: requests.addToCollection,
        removeFromCollection: requests.removeFromCollection
    })
}));
vi.mock('hooks/useApi', () => ({ useApi: vi.fn() }));

const api = new Api('https://cinema.example', { name: 'test', version: '1' }, { name: 'test', id: 'test' });
const policy = { AuthenticationProviderId: '', PasswordResetProviderId: '' };
const movies = { media: 'movies', libraryId: 'movies-library' } as const;
const series = { media: 'series', libraryId: 'series-library' } as const;
let client: QueryClient;
let root: Root | undefined;

beforeEach(() => {
    Object.values(requests).forEach(mock => {
        mock.mockReset();
    });
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    vi.mocked(useApi).mockReturnValue({
        api,
        user: { Id: 'user', Policy: { ...policy, EnableCollectionManagement: true } }
    });
});

afterEach(() => {
    if (root) act(() => root?.unmount());
    root = undefined;
    client.clear();
});

describe('cinema query scope and pagination', () => {
    it('disables every feed without a library, server or user', () => {
        for (const [currentApi, userId, scope] of [
            [api, 'user', { ...movies, libraryId: '' }],
            [undefined, 'user', movies],
            [api, undefined, movies]
        ] as const) {
            expect(getCinemaItemsQuery(currentApi, userId, scope).enabled).toBe(false);
            expect(getCinemaHeroQuery(currentApi, userId, scope).enabled).toBe(false);
            expect(getCinemaContinueQuery(currentApi, userId, scope).enabled).toBe(false);
            expect(getCinemaGenresQuery(currentApi, userId, scope).enabled).toBe(false);
            expect(getCinemaCollectionsQuery(client, currentApi, userId, scope).enabled).toBe(false);
        }
        expect(getCinemaItemsQuery(api, 'user', movies, {}, false).enabled).toBe(false);
    });

    it('keys every feed by server and user, with media, library and request parameters', () => {
        const queries = [
            getCinemaItemsQuery(api, 'user', movies),
            getCinemaHeroQuery(api, 'user', movies),
            getCinemaContinueQuery(api, 'user', movies),
            getCinemaGenresQuery(api, 'user', movies),
            getCinemaCollectionsQuery(client, api, 'user', movies)
        ];
        queries.forEach(query => {
            expect(query.queryKey.slice(0, 3)).toEqual(['CinemaHome', api.basePath, 'user']);
            expect(query.queryKey).toContainEqual(movies);
        });
        const defaultKey = getCinemaItemsQuery(api, 'user', movies).queryKey;
        expect(getCinemaItemsQuery(api, 'other', movies).queryKey).not.toEqual(defaultKey);
        expect(getCinemaItemsQuery(api, 'user', series).queryKey).not.toEqual(defaultKey);
        expect(getCinemaItemsQuery(api, 'user', movies, { searchTerm: 'new' }).queryKey).not.toEqual(defaultKey);
    });

    it('uses the requested item page size and forwards cancellation signals', async () => {
        requests.getItems
            .mockResolvedValueOnce({ data: { Items: [{ Id: 'one' }, { Id: 'two' }] } })
            .mockResolvedValueOnce({ data: { Items: [{ Id: 'three' }] } });
        const observer = new InfiniteQueryObserver(client, getCinemaItemsQuery(api, 'user', movies, { limit: 2 }));
        await observer.fetchNextPage();
        await observer.fetchNextPage();
        expect(requests.getItems).toHaveBeenNthCalledWith(2,
            expect.objectContaining({ limit: 2, startIndex: 2 }),
            { signal: expect.any(AbortSignal) }
        );
        expect(observer.getCurrentResult().hasNextPage).toBe(false);
        expect(observer.getCurrentResult().data?.pages[1].Items).toEqual([{ Id: 'three' }]);
    });

    it('paginates all root collections without membership filtering, including empty ones', async () => {
        requests.getItems.mockResolvedValueOnce({ data: { Items: [{ Id: 'empty' }, { Id: 'mixed' }] } })
            .mockResolvedValueOnce({ data: { Items: [{ Id: 'last' }] } });
        const observer = new InfiniteQueryObserver(client, getCinemaItemsQuery(api, 'user', movies, {
            includeItemTypes: [BaseItemKind.BoxSet],
            parentId: undefined,
            limit: 2
        }));
        await observer.fetchNextPage();
        await observer.fetchNextPage();
        expect(requests.getItems).toHaveBeenLastCalledWith(expect.objectContaining({
            parentId: undefined,
            includeItemTypes: [BaseItemKind.BoxSet],
            startIndex: 2
        }), { signal: expect.any(AbortSignal) });
        expect(observer.getCurrentResult().data?.pages[0].Items).toEqual([{ Id: 'empty' }, { Id: 'mixed' }]);
        expect(requests.getItems).toHaveBeenCalledTimes(2);
    });

    it('requests eight alphabetical, media-scoped genres at each offset', async () => {
        requests.getGenres.mockResolvedValue({ data: { Items: Array.from({ length: 8 }, (_, index) => ({ Id: String(index) })) } });
        const observer = new InfiniteQueryObserver(client, getCinemaGenresQuery(api, 'user', series));
        await observer.fetchNextPage();
        await observer.fetchNextPage();
        expect(requests.getGenres).toHaveBeenLastCalledWith(expect.objectContaining({
            limit: 8,
            startIndex: 8,
            parentId: series.libraryId,
            userId: 'user',
            includeItemTypes: [BaseItemKind.Series],
            sortBy: ['SortName'],
            sortOrder: ['Ascending']
        }), { signal: expect.any(AbortSignal) });
    });

    it('aborts an in-flight item request when cancelled', async () => {
        requests.getItems.mockImplementation(() => new Promise(() => { /* Pending until cancelled. */ }));
        const options = getCinemaItemsQuery(api, 'user', movies);
        const pending = client.fetchInfiniteQuery(options);
        const rejected = expect(pending).rejects.toThrow();
        const signal: AbortSignal = requests.getItems.mock.calls[0][1].signal;
        await client.cancelQueries({ queryKey: options.queryKey });
        await rejected;
        expect(signal.aborted).toBe(true);
    });
});

describe('cinema hero', () => {
    it('caches a six-item random backdrop batch across consumers', async () => {
        requests.getItems.mockResolvedValue({ data: { Items: [{ Id: 'hero' }] } });
        const options = getCinemaHeroQuery(api, 'user', movies);
        expect(await client.fetchQuery(options)).toEqual([{ Id: 'hero' }]);
        await client.fetchQuery(getCinemaHeroQuery(api, 'user', movies));
        expect(requests.getItems).toHaveBeenCalledTimes(1);
        expect(requests.getItems).toHaveBeenCalledWith(expect.objectContaining({
            limit: 6, imageTypes: [ImageType.Backdrop], sortBy: ['Random']
        }), { signal: expect.any(AbortSignal) });
        expect(options.staleTime).toBe(600000);
        expect(options.refetchOnWindowFocus).toBe(false);
    });

    it('falls back to generic candidates only when the backdrop batch is empty', async () => {
        requests.getItems
            .mockResolvedValueOnce({ data: { Items: [] } })
            .mockResolvedValueOnce({ data: { Items: [{ Id: 'fallback' }] } });
        expect(await client.fetchQuery(getCinemaHeroQuery(api, 'user', series))).toEqual([{ Id: 'fallback' }]);
        expect(requests.getItems).toHaveBeenLastCalledWith(expect.objectContaining({
            imageTypes: undefined, includeItemTypes: [BaseItemKind.Series]
        }), { signal: expect.any(AbortSignal) });
    });

    it('propagates failures rather than treating errors as empty backdrops', async () => {
        requests.getItems.mockRejectedValue(new Error('offline'));
        await expect(client.fetchQuery(getCinemaHeroQuery(api, 'user', movies))).rejects.toThrow('offline');
        expect(requests.getItems).toHaveBeenCalledTimes(1);
    });
});

describe('cinema continue watching', () => {
    it('uses resume movies without next-up and refreshes immediately', async () => {
        requests.getResumeItems.mockResolvedValue({ data: { Items: [{ Id: 'movie' }] } });
        const options = getCinemaContinueQuery(api, 'user', movies);
        expect(await client.fetchQuery(options)).toEqual([{ Id: 'movie' }]);
        expect(requests.getResumeItems).toHaveBeenCalledWith(expect.objectContaining({
            includeItemTypes: [BaseItemKind.Movie], parentId: movies.libraryId, limit: 24
        }), { signal: expect.any(AbortSignal) });
        expect(requests.getNextUp).not.toHaveBeenCalled();
        expect(options.staleTime).toBe(0);
    });

    it('merges episode resume before next-up, scoped to the series library', async () => {
        requests.getResumeItems.mockResolvedValue({ data: { Items: [{ Id: 'resume', SeriesId: 'one' }] } });
        requests.getNextUp.mockResolvedValue({ data: { Items: [
            { Id: 'suppressed', SeriesId: 'one' },
            { Id: 'next', SeriesId: 'two' }
        ] } });
        expect(await client.fetchQuery(getCinemaContinueQuery(api, 'user', series))).toEqual([
            { Id: 'resume', SeriesId: 'one' }, { Id: 'next', SeriesId: 'two' }
        ]);
        expect(requests.getResumeItems).toHaveBeenCalledWith(expect.objectContaining({
            includeItemTypes: [BaseItemKind.Episode], parentId: series.libraryId
        }), { signal: expect.any(AbortSignal) });
        expect(requests.getNextUp).toHaveBeenCalledWith(expect.objectContaining({
            parentId: series.libraryId, enableRewatching: false, enableResumable: false
        }), { signal: expect.any(AbortSignal) });
    });

    it.each(['getResumeItems', 'getNextUp'] as const)('propagates %s failures', async method => {
        requests.getResumeItems.mockResolvedValue({ data: { Items: [] } });
        requests.getNextUp.mockResolvedValue({ data: { Items: [] } });
        requests[method].mockRejectedValue(new Error('failed'));
        await expect(client.fetchQuery(getCinemaContinueQuery(api, 'user', series))).rejects.toThrow('failed');
    });
});

describe('media-specific collections', () => {
    it('includes mixed collections in both modes and does not lose pure series collections', async () => {
        requests.getItems.mockImplementation(async (params: LibraryApiGetItemsRequest) => {
            if (params.includeItemTypes?.[0] === BaseItemKind.BoxSet) {
                return { data: { Items: [{ Id: 'mixed' }, { Id: 'serial' }, { Id: 'movie' }, { Id: 'empty' }] } };
            }
            const matches = params.parentId === 'mixed'
                || (params.parentId === 'serial' && params.includeItemTypes?.[0] === BaseItemKind.Series)
                || (params.parentId === 'movie' && params.includeItemTypes?.[0] === BaseItemKind.Movie);
            return { data: { Items: matches ? [{ Id: 'member' }] : [] } };
        });
        const movieResult = await client.fetchInfiniteQuery(getCinemaCollectionsQuery(client, api, 'user', movies));
        const seriesResult = await client.fetchInfiniteQuery(getCinemaCollectionsQuery(client, api, 'user', series));
        expect(movieResult.pages[0].Items?.map(item => item.Id)).toEqual(['mixed', 'movie']);
        expect(seriesResult.pages[0].Items?.map(item => item.Id)).toEqual(['mixed', 'serial']);
        expect(requests.getItems).toHaveBeenCalledWith(expect.objectContaining({
            parentId: series.libraryId, includeItemTypes: [BaseItemKind.BoxSet]
        }), { signal: expect.any(AbortSignal) });
        expect(requests.getItems).toHaveBeenCalledWith(expect.objectContaining({
            parentId: 'serial', includeItemTypes: [BaseItemKind.Series], recursive: true, limit: 1
        }), { signal: expect.any(AbortSignal) });
    });

    it('continues past fully filtered raw pages and bounds probes to four in flight', async () => {
        let active = 0;
        let peak = 0;
        requests.getItems.mockImplementation(async (params: LibraryApiGetItemsRequest) => {
            if (params.includeItemTypes?.[0] === BaseItemKind.BoxSet) {
                return { data: { Items: params.startIndex === 0 ?
                    Array.from({ length: params.limit ?? 0 }, (_, index) => ({ Id: `empty-${index}` })) :
                    [{ Id: 'matching' }] } };
            }
            active++;
            peak = Math.max(peak, active);
            await Promise.resolve();
            active--;
            return { data: { Items: params.parentId === 'matching' ? [{ Id: 'member' }] : [] } };
        });
        const observer = new InfiniteQueryObserver(client, getCinemaCollectionsQuery(client, api, 'user', series));
        await observer.fetchNextPage();
        expect(observer.getCurrentResult().data?.pages[0].Items).toEqual([]);
        expect(observer.getCurrentResult().hasNextPage).toBe(true);
        await observer.fetchNextPage();
        expect(observer.getCurrentResult().data?.pages[1].Items).toEqual([{ Id: 'matching' }]);
        expect(observer.getCurrentResult().hasNextPage).toBe(false);
        expect(peak).toBe(4);
        expect(requests.getItems).toHaveBeenCalledWith(expect.objectContaining({
            includeItemTypes: [BaseItemKind.BoxSet], startIndex: 12
        }), { signal: expect.any(AbortSignal) });
    });

    it('caches membership probes within their media, server and user namespace', async () => {
        requests.getItems.mockResolvedValue({ data: { Items: [{ Id: 'collection' }] } });
        const options = getCinemaCollectionsQuery(client, api, 'user', movies);
        await client.fetchInfiniteQuery(options);
        await client.fetchInfiniteQuery(options);
        expect(requests.getItems).toHaveBeenCalledTimes(3);
        await client.fetchInfiniteQuery(getCinemaCollectionsQuery(client, api, 'another-user', movies));
        expect(requests.getItems).toHaveBeenCalledTimes(5);
    });

    it('does not hide probe failures as an empty public list', async () => {
        requests.getItems.mockResolvedValueOnce({ data: { Items: [{ Id: 'collection' }] } })
            .mockRejectedValueOnce(new Error('membership failed'));
        await expect(client.fetchInfiniteQuery(getCinemaCollectionsQuery(client, api, 'user', series)))
            .rejects.toThrow('membership failed');
    });
});

function mountMutations() {
    let result: ReturnType<typeof useCinemaCollectionMutations> | undefined;
    function Harness() {
        result = useCinemaCollectionMutations();
        return null;
    }
    root = createRoot(document.createElement('div'));
    act(() => root?.render(createElement(QueryClientProvider, { client }, createElement(Harness))));
    if (!result) throw new Error('The mutation harness did not render.');
    return result;
}

describe('collection mutations', () => {
    it('creates an optional empty collection, maps metadata locking and invalidates both namespaces', async () => {
        requests.createCollection.mockResolvedValue({ data: { Id: 'created' } });
        const invalidate = vi.spyOn(client, 'invalidateQueries');
        const { create } = mountMutations();
        await act(async () => {
            expect(await create.mutateAsync({ name: ' New collection ', enableMetadata: false })).toEqual({ Id: 'created' });
        });
        expect(requests.createCollection).toHaveBeenCalledWith({
            name: 'New collection', ids: undefined, isLocked: true
        });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['CinemaHome'] });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['User', 'user', 'Views'] });
    });

    it('adds and removes membership without deleting media', async () => {
        requests.addToCollection.mockResolvedValue({ data: undefined });
        requests.removeFromCollection.mockResolvedValue({ data: undefined });
        const { add, remove } = mountMutations();
        await act(async () => {
            await add.mutateAsync({ collectionId: ' collection ', ids: ['item', 'item'] });
            await remove.mutateAsync({ collectionId: 'collection', ids: ['item'] });
        });
        expect(requests.addToCollection).toHaveBeenCalledWith({ collectionId: 'collection', ids: ['item'] });
        expect(requests.removeFromCollection).toHaveBeenCalledWith({ collectionId: 'collection', ids: ['item'] });
    });

    it('validates names, item IDs and collection IDs before making requests', async () => {
        const { create, add, remove } = mountMutations();
        await act(async () => {
            await expect(create.mutateAsync({ name: ' ', enableMetadata: true })).rejects.toThrow('name');
            await expect(create.mutateAsync({ name: 'Valid', ids: [' '], enableMetadata: true })).rejects.toThrow('ID');
            await expect(add.mutateAsync({ collectionId: 'collection', ids: [] })).rejects.toThrow('ID');
            await expect(remove.mutateAsync({ collectionId: '', ids: ['item'] })).rejects.toThrow('collection ID');
        });
        expect(requests.createCollection).not.toHaveBeenCalled();
        expect(requests.addToCollection).not.toHaveBeenCalled();
        expect(requests.removeFromCollection).not.toHaveBeenCalled();
    });

    it('checks management permission on every mutation', async () => {
        vi.mocked(useApi).mockReturnValue({ api, user: { Id: 'user', Policy: policy } });
        const { create, add, remove } = mountMutations();
        await act(async () => {
            await expect(create.mutateAsync({ name: 'Name', enableMetadata: true })).rejects.toThrow('permission');
            await expect(add.mutateAsync({ collectionId: 'collection', ids: ['item'] })).rejects.toThrow('permission');
            await expect(remove.mutateAsync({ collectionId: 'collection', ids: ['item'] })).rejects.toThrow('permission');
        });
        expect(requests.createCollection).not.toHaveBeenCalled();
        expect(requests.addToCollection).not.toHaveBeenCalled();
        expect(requests.removeFromCollection).not.toHaveBeenCalled();
    });

    it('propagates mutation errors without invalidating successful cached data', async () => {
        requests.createCollection.mockRejectedValue(new Error('server rejected'));
        const invalidate = vi.spyOn(client, 'invalidateQueries');
        const { create } = mountMutations();
        await act(async () => {
            await expect(create.mutateAsync({ name: 'Name', enableMetadata: true })).rejects.toThrow('server rejected');
        });
        expect(invalidate).not.toHaveBeenCalled();
    });
});
