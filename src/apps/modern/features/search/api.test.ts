import { Api } from '@jellyfin/sdk/lib/api';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getCinemaSearchQuery, getCinemaSuggestionsQuery, readSearchScope, searchHintToItem } from './api';

const requests = vi.hoisted(() => ({ search: vi.fn(), items: vi.fn() }));
vi.mock('@jellyfin/sdk/lib/utils/api/search-api', () => ({
    getSearchApi: () => ({ getSearchHints: requests.search })
}));
vi.mock('@jellyfin/sdk/lib/utils/api/library-api', () => ({
    getLibraryApi: () => ({ getItems: requests.items })
}));

const api = new Api('https://cinema.example', { name: 'test', version: '1' }, { name: 'test', id: 'test' });
const scope = readSearchScope(new URLSearchParams());
let client: QueryClient;

beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => client.clear());

describe('cinema search requests', () => {
    it('disables searches without a server, user or nonblank term', () => {
        expect(getCinemaSearchQuery(undefined, 'user', 'movie', scope).enabled).toBe(false);
        expect(getCinemaSearchQuery(api, undefined, 'movie', scope).enabled).toBe(false);
        expect(getCinemaSearchQuery(api, 'user', '  ', scope).enabled).toBe(false);
    });

    it('scopes cache entries to server, user, query and filter', () => {
        const first = getCinemaSearchQuery(api, 'first', 'film', scope);
        const second = getCinemaSearchQuery(api, 'second', 'film', scope);
        expect(first.queryKey).toContain(api.basePath);
        expect(first.queryKey).not.toEqual(second.queryKey);
        expect(first.queryKey).not.toEqual(getCinemaSearchQuery(api, 'first', 'film',
            readSearchScope(new URLSearchParams('type=Series'))).queryKey);
    });

    it('keeps global search broad while applying explicit media and library filters', async () => {
        requests.search.mockResolvedValue({ data: { SearchHints: [], TotalRecordCount: 0 } });
        await client.fetchInfiniteQuery(getCinemaSearchQuery(api, 'user', '  Matrix  ', scope));
        expect(requests.search).toHaveBeenLastCalledWith(expect.objectContaining({
            userId: 'user', searchTerm: 'Matrix', includeItemTypes: undefined, includePeople: true, startIndex: 0, limit: 40
        }), { signal: expect.any(AbortSignal) });
        const filtered = readSearchScope(new URLSearchParams('parentId=library&type=Movie'));
        await client.fetchInfiniteQuery(getCinemaSearchQuery(api, 'user', 'Matrix', filtered));
        expect(requests.search).toHaveBeenLastCalledWith(expect.objectContaining({
            parentId: 'library', includeItemTypes: [BaseItemKind.Movie], includePeople: false
        }), expect.anything());
    });

    it('loads subsequent result pages and stops at the server total', async () => {
        requests.search.mockResolvedValueOnce({
            data: { SearchHints: Array.from({ length: 40 }, (_, i) => ({ Id: `${i}` })), TotalRecordCount: 41 }
        }).mockResolvedValueOnce({
            data: { SearchHints: [{ Id: 'last' }], TotalRecordCount: 41 }
        });
        const observer = new InfiniteQueryObserver(client, getCinemaSearchQuery(api, 'user', 'film', scope));
        await observer.refetch();
        expect(observer.getCurrentResult().hasNextPage).toBe(true);
        await observer.fetchNextPage();
        expect(requests.search).toHaveBeenLastCalledWith(expect.objectContaining({ startIndex: 40 }), expect.anything());
        expect(observer.getCurrentResult().hasNextPage).toBe(false);
        expect(observer.getCurrentResult().data?.pages).toHaveLength(2);
        observer.destroy();
    });

    it('propagates failures instead of returning empty results', async () => {
        requests.search.mockRejectedValueOnce(new Error('Search unavailable'));
        await expect(client.fetchInfiniteQuery(getCinemaSearchQuery(api, 'user', 'film', scope)))
            .rejects.toThrow('Search unavailable');
    });

    it('requests real suggestion artwork from the selected library', async () => {
        requests.items.mockResolvedValue({ data: { Items: [] } });
        await client.fetchQuery(getCinemaSuggestionsQuery(api, 'user', readSearchScope(new URLSearchParams('parentId=movies'))));
        expect(requests.items).toHaveBeenCalledWith(expect.objectContaining({
            userId: 'user', parentId: 'movies', enableImages: true, imageTypeLimit: 1
        }), { signal: expect.any(AbortSignal) });
    });

    it('ignores unknown URL filter values', () => {
        expect(readSearchScope(new URLSearchParams('type=garbage&collectionType=garbage'))).toEqual(scope);
    });

    it('preserves episode identity, artwork and series information for cinema cards', () => {
        expect(searchHintToItem({
            Id: 'episode', Name: 'Pilot', Type: BaseItemKind.Episode, Series: 'A series',
            IndexNumber: 1, ParentIndexNumber: 2, PrimaryImageTag: 'image'
        })).toMatchObject({
            Id: 'episode', Type: BaseItemKind.Episode, Name: 'Pilot', SeriesName: 'A series',
            IndexNumber: 1, ParentIndexNumber: 2, ImageTags: { Primary: 'image' }
        });
    });
});
