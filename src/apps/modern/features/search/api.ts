import type { Api } from '@jellyfin/sdk/lib/api';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import type { SearchHint } from '@jellyfin/sdk/lib/generated-client/models/search-hint';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { getSearchApi } from '@jellyfin/sdk/lib/utils/api/search-api';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';

import { getItemTypesFromCollectionType } from 'apps/legacy/features/search/utils/search';

import { CINEMA_FIELDS, CINEMA_IMAGES } from '../home/utils';

export const SEARCH_FILTERS = [
    { label: 'All', type: undefined },
    { label: 'Movies', type: BaseItemKind.Movie },
    { label: 'Shows', type: BaseItemKind.Series },
    { label: 'Episodes', type: BaseItemKind.Episode },
    { label: 'People', type: BaseItemKind.Person },
    { label: 'Collections', type: BaseItemKind.BoxSet }
];

export function readSearchScope(params: URLSearchParams) {
    const requestedType = params.get('type') || undefined;
    return {
        parentId: params.get('parentId') || undefined,
        collectionType: Object.values(CollectionType).find(type => type === params.get('collectionType')),
        type: SEARCH_FILTERS.find(filter => filter.type === requestedType)?.type
    };
}

type SearchScope = ReturnType<typeof readSearchScope>;
const PAGE_SIZE = 40;

function searchTypes(scope: SearchScope): BaseItemKind[] | undefined {
    if (scope.type) return [scope.type];
    if (!scope.collectionType) return undefined;
    if (scope.collectionType === CollectionType.Livetv) return [BaseItemKind.LiveTvProgram, BaseItemKind.TvChannel];
    const types = getItemTypesFromCollectionType(scope.collectionType);
    if (scope.collectionType === CollectionType.Movies || scope.collectionType === CollectionType.Tvshows) {
        return [...types, BaseItemKind.Person, BaseItemKind.Studio];
    }
    if (scope.collectionType === CollectionType.Music) return [...types, BaseItemKind.MusicArtist];
    return types;
}

export function getCinemaSearchQuery(api: Api | undefined, userId: string | undefined, query: string, scope: SearchScope) {
    const searchTerm = query.trim();
    const types = searchTypes(scope);
    return infiniteQueryOptions({
        queryKey: ['CinemaSearch', api?.basePath, userId, searchTerm, scope],
        queryFn: async ({ pageParam, signal }) => {
            if (!api || !userId || !searchTerm) throw new Error('A server, user and search term are required.');
            const response = await getSearchApi(api).getSearchHints({
                userId,
                searchTerm,
                parentId: scope.parentId,
                includeItemTypes: types,
                includePeople: !types || types.includes(BaseItemKind.Person),
                includeArtists: !types || types.includes(BaseItemKind.MusicArtist),
                includeStudios: !types || types.includes(BaseItemKind.Studio),
                includeGenres: !types || types.includes(BaseItemKind.Genre) || types.includes(BaseItemKind.MusicGenre),
                limit: PAGE_SIZE,
                startIndex: pageParam
            }, { signal });
            return response.data;
        },
        initialPageParam: 0,
        getNextPageParam: (page, _pages, offset) => {
            const count = page.SearchHints?.length ?? 0;
            const next = offset + count;
            return count < PAGE_SIZE || (page.TotalRecordCount != null && next >= page.TotalRecordCount) ?
                undefined : next;
        },
        enabled: !!api && !!userId && !!searchTerm
    });
}

export function getCinemaSuggestionsQuery(api: Api | undefined, userId: string | undefined, scope: SearchScope) {
    return queryOptions({
        queryKey: ['CinemaSearchSuggestions', api?.basePath, userId, scope.parentId, scope.collectionType],
        queryFn: async ({ signal }) => {
            if (!api || !userId) throw new Error('A server and user are required.');
            const response = await getLibraryApi(api).getItems({
                userId,
                parentId: scope.parentId,
                includeItemTypes: scope.collectionType ? getItemTypesFromCollectionType(scope.collectionType) :
                    [BaseItemKind.Movie, BaseItemKind.Series],
                recursive: true,
                collapseBoxSetItems: false,
                limit: 12,
                fields: CINEMA_FIELDS,
                enableImageTypes: CINEMA_IMAGES,
                enableImages: true,
                imageTypeLimit: 1,
                sortBy: [ItemSortBy.IsFavoriteOrLiked, ItemSortBy.Random],
                enableTotalRecordCount: false
            }, { signal });
            return response.data.Items ?? [];
        },
        enabled: !!api && !!userId,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false
    });
}

export function searchHintToItem(hint: SearchHint): BaseItemDto {
    return {
        Id: hint.Id,
        Name: hint.Name,
        Type: hint.Type,
        IsFolder: hint.IsFolder,
        MediaType: hint.MediaType,
        ProductionYear: hint.ProductionYear,
        IndexNumber: hint.IndexNumber,
        ParentIndexNumber: hint.ParentIndexNumber,
        SeriesName: hint.Series,
        Album: hint.Album,
        AlbumId: hint.AlbumId,
        Artists: hint.Artists,
        ChannelId: hint.ChannelId,
        ImageTags: hint.PrimaryImageTag ? { Primary: hint.PrimaryImageTag } : undefined
    };
}
