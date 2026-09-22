import type { Api } from '@jellyfin/sdk/lib/api';
import type { LibraryApiGetItemsRequest } from '@jellyfin/sdk/lib/generated-client/api/library-api';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { BaseItemDtoQueryResult } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto-query-result';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';

export interface CinemaScope {
    media: 'movies' | 'series';
    libraryId: string;
}

export const CINEMA_FIELDS = [ItemFields.Overview, ItemFields.Genres, ItemFields.PrimaryImageAspectRatio];
export const CINEMA_IMAGES = [ImageType.Primary, ImageType.Backdrop, ImageType.Thumb, ImageType.Logo];

export const cinemaItemType = (scope: CinemaScope) =>
    scope.media === 'movies' ? BaseItemKind.Movie : BaseItemKind.Series;

export function cinemaItemParams(
    scope: CinemaScope,
    userId?: string,
    options: LibraryApiGetItemsRequest = {}
): LibraryApiGetItemsRequest {
    const limit = options.limit ?? 40;
    if (!Number.isInteger(limit) || limit < 1) {
        throw new Error('The cinema page size must be a positive integer.');
    }
    return {
        parentId: scope.libraryId,
        fields: CINEMA_FIELDS,
        enableImages: true,
        enableImageTypes: CINEMA_IMAGES,
        imageTypeLimit: 1,
        sortBy: [ItemSortBy.SortName],
        sortOrder: [SortOrder.Ascending],
        enableTotalRecordCount: false,
        ...options,
        limit,
        userId,
        includeItemTypes: options.includeItemTypes?.length === 1 && options.includeItemTypes[0] === BaseItemKind.BoxSet ?
            [BaseItemKind.BoxSet] :
            [cinemaItemType(scope)],
        recursive: true,
        collapseBoxSetItems: false,
        enableUserData: true
    };
}

export function cinemaNextOffset(page: BaseItemDtoQueryResult, offset: number, limit: number) {
    const count = page.Items?.length ?? 0;
    return count < limit ? undefined : offset + count;
}

export function mergeCinemaContinue(resume: BaseItemDto[], nextUp: BaseItemDto[], limit = 24): BaseItemDto[] {
    const resumableSeries = new Set(resume.map(item => item.SeriesId).filter(Boolean));
    const seen = new Set<string>();
    return [
        ...resume,
        ...nextUp.filter(item => !item.SeriesId || !resumableSeries.has(item.SeriesId))
    ].filter(item => {
        if (!item.Id || seen.has(item.Id)) return false;
        seen.add(item.Id);
        return true;
    }).slice(0, limit);
}

export function requireCinemaApi(api: Api | undefined, userId: string | undefined, scope: CinemaScope): Api {
    if (!api || !userId || !scope.libraryId) {
        throw new Error('A server, user and library are required.');
    }
    return api;
}

export function requireCollectionManager(api?: Api, user?: UserDto): Api {
    if (!api || !user?.Id) throw new Error('A server and user are required.');
    if (!user.Policy?.IsAdministrator && !user.Policy?.EnableCollectionManagement) {
        throw new Error('Collection management permission is required.');
    }
    return api;
}

export function collectionIds(ids: string[]): string[] {
    if (!ids.length || ids.some(id => !id.trim())) {
        throw new Error('At least one nonempty item ID is required.');
    }
    return [...new Set(ids.map(id => id.trim()))];
}
