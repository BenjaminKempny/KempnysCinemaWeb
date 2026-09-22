import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import { useQuery } from '@tanstack/react-query';

import { getUserViewsQuery } from 'hooks/api/useUserViews';
import { useApi } from 'hooks/useApi';

import type { CinemaMedia } from './navigation';

export const cinemaLibrarySettingKey = (serverId: string, media: CinemaMedia) => `cinemaLibrary:${serverId}:${media}`;

export function getCinemaLibraries(items: BaseItemDto[], media: CinemaMedia) {
    return items.filter(item => item.Id && (
        item.CollectionType === (media === 'movies' ? CollectionType.Movies : CollectionType.Tvshows)
        || item.CollectionType === CollectionType.Unknown
        || !item.CollectionType
    ));
}

export function getCinemaLibraryId(libraries: BaseItemDto[], savedId: string | null) {
    const savedLibrary = savedId ? libraries.find(item => item.Id === savedId) : undefined;
    return savedLibrary?.Id || (!savedId && libraries.length === 1 ? libraries[0].Id : '') || '';
}

export function useCinemaLibraries() {
    const { api, user } = useApi();
    return useQuery({
        ...getUserViewsQuery(api, { userId: user?.Id }),
        queryKey: ['CinemaHome', api?.basePath, user?.Id, 'Libraries'],
        enabled: !!api && !!user?.Id
    });
}
