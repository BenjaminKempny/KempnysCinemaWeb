import type { Api } from '@jellyfin/sdk/lib/api';
import type { GenreApiGetGenresRequest } from '@jellyfin/sdk/lib/generated-client/api/genre-api';
import type { LibraryApiGetItemsRequest, LibraryApiGetResumeItemsRequest } from '@jellyfin/sdk/lib/generated-client/api/library-api';
import type { ShowApiGetNextUpRequest } from '@jellyfin/sdk/lib/generated-client/api/show-api';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { BaseItemDtoQueryResult } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto-query-result';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import type { CollectionCreationResult } from '@jellyfin/sdk/lib/generated-client/models/collection-creation-result';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import { getCollectionApi } from '@jellyfin/sdk/lib/utils/api/collection-api';
import { getGenreApi } from '@jellyfin/sdk/lib/utils/api/genre-api';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { getShowApi } from '@jellyfin/sdk/lib/utils/api/show-api';
import {
    infiniteQueryOptions,
    queryOptions,
    type QueryClient,
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient
} from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';
import { currentSettings } from 'scripts/settings/userSettings';

import {
    CINEMA_FIELDS,
    CINEMA_IMAGES,
    type CinemaScope,
    cinemaItemParams,
    cinemaItemType,
    cinemaNextOffset,
    collectionIds,
    mergeCinemaContinue,
    requireCinemaApi,
    requireCollectionManager
} from './utils';

export type { CinemaScope } from './utils';

const TEN_MINUTES = 10 * 60 * 1000;
const COLLECTION_PAGE_SIZE = 12;
const cinemaKey = (api?: Api, userId?: string) => ['CinemaHome', api?.basePath, userId] as const;
const canFetch = (api: Api | undefined, userId: string | undefined, scope: CinemaScope) =>
    !!api && !!userId && !!scope.libraryId;

export function getCinemaItemsQuery(
    api: Api | undefined,
    userId: string | undefined,
    scope: CinemaScope,
    options?: LibraryApiGetItemsRequest,
    enabled = true
) {
    const params = cinemaItemParams(scope, userId, options);
    return infiniteQueryOptions({
        queryKey: [...cinemaKey(api, userId), 'Items', scope, params],
        queryFn: async ({ pageParam, signal }): Promise<BaseItemDtoQueryResult> => {
            const response = await getLibraryApi(requireCinemaApi(api, userId, scope))
                .getItems({ ...params, startIndex: pageParam }, { signal });
            return response.data;
        },
        initialPageParam: options?.startIndex ?? 0,
        getNextPageParam: (page, _pages, offset) => cinemaNextOffset(page, offset, params.limit!),
        enabled: enabled && canFetch(api, userId, scope)
    });
}

export function useCinemaItems(scope: CinemaScope, options?: LibraryApiGetItemsRequest, enabled = true) {
    const { api, user } = useApi();
    return useInfiniteQuery(getCinemaItemsQuery(api, user?.Id, scope, options, enabled));
}

export function getCinemaHeroQuery(api: Api | undefined, userId: string | undefined, scope: CinemaScope) {
    const params = cinemaItemParams(scope, userId, {
        limit: 6,
        sortBy: [ItemSortBy.Random],
        imageTypes: [ImageType.Backdrop]
    });
    return queryOptions({
        queryKey: [...cinemaKey(api, userId), 'Hero', scope, params],
        queryFn: async ({ signal }): Promise<BaseItemDto[]> => {
            const libraryApi = getLibraryApi(requireCinemaApi(api, userId, scope));
            const response = await libraryApi.getItems(params, { signal });
            if (response.data.Items?.length) return response.data.Items;
            const fallback = await libraryApi.getItems({ ...params, imageTypes: undefined }, { signal });
            return fallback.data.Items ?? [];
        },
        enabled: canFetch(api, userId, scope),
        staleTime: TEN_MINUTES,
        gcTime: TEN_MINUTES,
        refetchOnWindowFocus: false
    });
}

export function useCinemaHero(scope: CinemaScope) {
    const { api, user } = useApi();
    return useQuery(getCinemaHeroQuery(api, user?.Id, scope));
}

export function getCinemaContinueQuery(api: Api | undefined, userId: string | undefined, scope: CinemaScope) {
    const shared = {
        userId,
        parentId: scope.libraryId,
        limit: 24,
        fields: CINEMA_FIELDS,
        enableImages: true,
        enableImageTypes: CINEMA_IMAGES,
        imageTypeLimit: 1,
        enableUserData: true,
        enableTotalRecordCount: false
    };
    const resumeParams: LibraryApiGetResumeItemsRequest = {
        ...shared,
        includeItemTypes: [scope.media === 'movies' ? BaseItemKind.Movie : BaseItemKind.Episode]
    };
    const nextUpParams: ShowApiGetNextUpRequest = {
        ...shared,
        enableResumable: false,
        enableRewatching: false
    };
    return queryOptions({
        queryKey: [...cinemaKey(api, userId), 'Continue', scope, resumeParams, nextUpParams],
        queryFn: async ({ signal }): Promise<BaseItemDto[]> => {
            const currentApi = requireCinemaApi(api, userId, scope);
            const [resume, nextUp] = await Promise.all([
                getLibraryApi(currentApi).getResumeItems(resumeParams, { signal }),
                scope.media === 'series' ? getShowApi(currentApi).getNextUp(nextUpParams, { signal }) : undefined
            ]);
            return mergeCinemaContinue(resume.data.Items ?? [], nextUp?.data.Items ?? []);
        },
        enabled: canFetch(api, userId, scope),
        staleTime: 0
    });
}

export function useCinemaContinue(scope: CinemaScope) {
    const { api, user } = useApi();
    return useQuery(getCinemaContinueQuery(api, user?.Id, scope));
}

export function getCinemaGenresQuery(api: Api | undefined, userId: string | undefined, scope: CinemaScope) {
    const params: GenreApiGetGenresRequest = {
        userId,
        parentId: scope.libraryId,
        includeItemTypes: [cinemaItemType(scope)],
        sortBy: [ItemSortBy.SortName],
        sortOrder: [SortOrder.Ascending],
        enableTotalRecordCount: false,
        limit: 8
    };
    return infiniteQueryOptions({
        queryKey: [...cinemaKey(api, userId), 'Genres', scope, params],
        queryFn: async ({ pageParam, signal }): Promise<BaseItemDtoQueryResult> => {
            const response = await getGenreApi(requireCinemaApi(api, userId, scope))
                .getGenres({ ...params, startIndex: pageParam }, { signal });
            return response.data;
        },
        initialPageParam: 0,
        getNextPageParam: (page, _pages, offset) => cinemaNextOffset(page, offset, 8),
        enabled: canFetch(api, userId, scope)
    });
}

export function useCinemaGenres(scope: CinemaScope) {
    const { api, user } = useApi();
    return useInfiniteQuery(getCinemaGenresQuery(api, user?.Id, scope));
}

interface CinemaCollectionPage extends BaseItemDtoQueryResult {
    nextOffset?: number;
}

export function getCinemaCollectionsQuery(
    queryClient: QueryClient,
    api: Api | undefined,
    userId: string | undefined,
    scope: CinemaScope
) {
    const params: LibraryApiGetItemsRequest = {
        ...cinemaItemParams(scope, userId, { limit: COLLECTION_PAGE_SIZE }),
        includeItemTypes: [BaseItemKind.BoxSet]
    };
    return infiniteQueryOptions({
        queryKey: [...cinemaKey(api, userId), 'Collections', scope, params],
        queryFn: async ({ pageParam, signal }): Promise<CinemaCollectionPage> => {
            const currentApi = requireCinemaApi(api, userId, scope);
            const response = await getLibraryApi(currentApi).getItems({ ...params, startIndex: pageParam }, { signal });
            const rawItems = response.data.Items ?? [];
            const items: BaseItemDto[] = [];
            // Probe only four collections at once; filtering must not change the raw paging offset.
            for (let index = 0; index < rawItems.length; index += 4) {
                const batch = await Promise.all(rawItems.slice(index, index + 4).map(async collection => {
                    if (!collection.Id) return undefined;
                    const membershipParams = cinemaItemParams(scope, userId, {
                        parentId: collection.Id,
                        limit: 1
                    });
                    const hasMembers = await queryClient.fetchQuery({
                        queryKey: [...cinemaKey(api, userId), 'CollectionMembership', scope, membershipParams],
                        queryFn: async () => {
                            const members = await getLibraryApi(currentApi).getItems(membershipParams, { signal });
                            return !!members.data.Items?.length;
                        },
                        staleTime: TEN_MINUTES
                    });
                    return hasMembers ? collection : undefined;
                }));
                items.push(...batch.filter((item): item is BaseItemDto => !!item));
            }
            return {
                Items: items,
                StartIndex: pageParam,
                nextOffset: cinemaNextOffset(response.data, pageParam, COLLECTION_PAGE_SIZE)
            };
        },
        initialPageParam: 0,
        getNextPageParam: page => page.nextOffset,
        enabled: canFetch(api, userId, scope)
    });
}

export function useCinemaCollections(scope: CinemaScope) {
    const { api, user } = useApi();
    const queryClient = useQueryClient();
    return useInfiniteQuery(getCinemaCollectionsQuery(queryClient, api, user?.Id, scope));
}

export interface CreateCinemaCollection {
    name: string;
    ids?: string[];
    enableMetadata: boolean;
}

export interface UpdateCinemaCollection {
    collectionId: string;
    ids: string[];
}

/** Collection editing is fully disabled while the user opted out of collection operations. */
function requireCollectionOperations(api: Api | undefined, user: UserDto | undefined) {
    if (currentSettings.disableCollectionOperations()) {
        throw new Error('Collection operations are disabled.');
    }
    return requireCollectionManager(api, user);
}

export function useCinemaCollectionMutations() {
    const { api, user } = useApi();
    const queryClient = useQueryClient();
    const onSuccess = () => Promise.all([
        queryClient.invalidateQueries({ queryKey: ['CinemaHome'] }),
        queryClient.invalidateQueries({ queryKey: ['User', user?.Id, 'Views'] })
    ]);
    const create = useMutation({
        mutationFn: async ({ name, ids, enableMetadata }: CreateCinemaCollection): Promise<CollectionCreationResult> => {
            const currentApi = requireCollectionOperations(api, user);
            if (!name.trim()) throw new Error('A collection name is required.');
            const response = await getCollectionApi(currentApi).createCollection({
                name: name.trim(),
                ids: ids?.length ? collectionIds(ids) : undefined,
                isLocked: !enableMetadata
            });
            return response.data;
        },
        onSuccess
    });
    const updateParams = ({ collectionId, ids }: UpdateCinemaCollection) => {
        if (!collectionId.trim()) throw new Error('A collection ID is required.');
        return { collectionId: collectionId.trim(), ids: collectionIds(ids) };
    };
    const add = useMutation({
        mutationFn: async (params: UpdateCinemaCollection) => {
            const currentApi = requireCollectionOperations(api, user);
            const response = await getCollectionApi(currentApi).addToCollection(updateParams(params));
            return response.data;
        },
        onSuccess
    });
    const remove = useMutation({
        mutationFn: async (params: UpdateCinemaCollection) => {
            const currentApi = requireCollectionOperations(api, user);
            const response = await getCollectionApi(currentApi).removeFromCollection(updateParams(params));
            return response.data;
        },
        onSuccess
    });
    return { create, add, remove };
}
