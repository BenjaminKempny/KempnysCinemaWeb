import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ImageType } from '@jellyfin/sdk/lib/generated-client/models/image-type';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import { getGenreApi } from '@jellyfin/sdk/lib/utils/api/genre-api';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import escapeHtml from 'escape-html';
import type { ApiClient } from 'jellyfin-apiclient';

import cardBuilder from 'components/cardbuilder/cardBuilder';
import { getPortraitShape } from 'components/cardbuilder/utils/shape';
import layoutManager from 'components/layoutManager';
import { appRouter } from 'components/router/appRouter';
import globalize from 'lib/globalize';
import ServerConnections from 'lib/jellyfin-apiclient/ServerConnections';
import { queryClient } from 'utils/query/queryClient';

import type { SectionContainerElement, SectionOptions } from './section';

/** Maximum number of genre rows rendered below a primary section. */
const MAX_GENRE_ROWS = 12;
/** Maximum number of items loaded per genre row. */
const ITEMS_PER_GENRE_ROW = 20;

export interface GenreSectionConfig {
    /** The item type rendered in the rows (Movie or Series). */
    itemType: BaseItemKind;
    /** Translation key for the primary section heading ("My Movies"/"My Series"). */
    titleKey: string;
    /** Collection type of the libraries that should be linked from the heading. */
    collectionType: string;
    /** Whether the primary heading is rendered. Disabled when the section owns a tab. */
    showHeading?: boolean;
}

export const MOVIE_GENRE_SECTION: GenreSectionConfig = {
    itemType: BaseItemKind.Movie,
    titleKey: 'HeaderMyMovies',
    collectionType: 'movies'
};

export const SERIES_GENRE_SECTION: GenreSectionConfig = {
    itemType: BaseItemKind.Series,
    titleKey: 'HeaderMySeries',
    collectionType: 'tvshows'
};

function getGenresQuery(apiClient: ApiClient, userId: string, itemType: BaseItemKind) {
    const params = {
        userId,
        includeItemTypes: [ itemType ],
        sortBy: [ ItemSortBy.SortName ],
        sortOrder: [ SortOrder.Ascending ],
        limit: MAX_GENRE_ROWS,
        enableTotalRecordCount: false,
        enableImages: false
    };

    return {
        queryKey: [ 'User', userId, 'Genres', itemType, MAX_GENRE_ROWS ],
        queryFn: async ({ signal }: { signal: AbortSignal }) => {
            const api = ServerConnections.getApi(apiClient.serverId());
            if (!api) throw new Error('No api instance');
            const response = await getGenreApi(api).getGenres(params, { signal });
            return response.data;
        }
    };
}

function getFetchGenreItemsFn(
    apiClient: ApiClient,
    userId: string,
    itemType: BaseItemKind,
    genreId: string
) {
    return function () {
        const params = {
            userId,
            genreIds: [ genreId ],
            includeItemTypes: [ itemType ],
            recursive: true,
            limit: ITEMS_PER_GENRE_ROW,
            sortBy: [ ItemSortBy.PremiereDate, ItemSortBy.SortName ],
            sortOrder: [ SortOrder.Descending ],
            fields: [ ItemFields.PrimaryImageAspectRatio ],
            imageTypeLimit: 1,
            enableImageTypes: [
                ImageType.Primary,
                ImageType.Backdrop,
                ImageType.Thumb
            ],
            enableTotalRecordCount: false
        };

        return queryClient.fetchQuery({
            queryKey: [ 'User', userId, 'GenreItems', itemType, genreId, ITEMS_PER_GENRE_ROW ],
            queryFn: async ({ signal }: { signal: AbortSignal }) => {
                const api = ServerConnections.getApi(apiClient.serverId());
                if (!api) throw new Error('No api instance');
                const response = await getLibraryApi(api).getItems(params, { signal });
                return response.data;
            }
        });
    };
}

function getGenreItemsHtmlFn(itemType: BaseItemKind, { enableOverflow }: SectionOptions) {
    return function (items: BaseItemDto[]) {
        return cardBuilder.getCardsHtml({
            items,
            shape: getPortraitShape(enableOverflow),
            preferThumb: false,
            showUnplayedIndicator: false,
            showChildCountIndicator: true,
            context: 'home',
            overlayText: false,
            centerText: true,
            overlayPlayButton: true,
            allowBottomPadding: !enableOverflow,
            cardLayout: false,
            showTitle: true,
            showYear: itemType === BaseItemKind.Movie,
            lines: 2
        });
    };
}

/** Renders the large heading that introduces a primary section. */
function renderPrimaryHeading(
    elem: HTMLElement,
    config: GenreSectionConfig,
    userViews: BaseItemDto[]
) {
    const frag = document.createElement('div');
    frag.classList.add('verticalSection', 'verticalSection-extrabottompadding', 'homeGenreHeading');
    elem.appendChild(frag);

    const matchingViews = userViews.filter(view => view.CollectionType === config.collectionType);
    const title = escapeHtml(globalize.translate(config.titleKey));

    let html = '<div class="sectionTitleContainer sectionTitleContainer-cards padded-left">';

    if (!layoutManager.tv && matchingViews.length === 1) {
        html += '<a is="emby-linkbutton" href="' + appRouter.getRouteUrl(matchingViews[0], {}) + '" class="more button-flat button-flat-mini sectionTitleTextButton">';
        html += '<h2 class="sectionTitle sectionTitle-cards homeGenreHeadingText">' + title + '</h2>';
        html += '<span class="material-icons chevron_right" aria-hidden="true"></span>';
        html += '</a>';
    } else {
        html += '<h2 class="sectionTitle sectionTitle-cards homeGenreHeadingText">' + title + '</h2>';
    }

    html += '</div>';

    frag.innerHTML = html;
}

function renderGenreRow(
    elem: HTMLElement,
    apiClient: ApiClient,
    userId: string,
    genre: BaseItemDto,
    config: GenreSectionConfig,
    options: SectionOptions
) {
    if (!genre.Id) return;

    const frag = document.createElement('div');
    frag.classList.add('verticalSection', 'homeGenreRow', 'hide');
    elem.appendChild(frag);

    const genreName = escapeHtml(genre.Name || '');

    let html = '<div class="sectionTitleContainer sectionTitleContainer-cards padded-left">';

    if (!layoutManager.tv) {
        html += '<a is="emby-linkbutton" href="' + appRouter.getRouteUrl(genre, {}) + '" class="more button-flat button-flat-mini sectionTitleTextButton">';
        html += '<h3 class="sectionTitle sectionTitle-cards homeGenreRowTitle">' + genreName + '</h3>';
        html += '<span class="material-icons chevron_right" aria-hidden="true"></span>';
        html += '</a>';
    } else {
        html += '<h3 class="sectionTitle sectionTitle-cards homeGenreRowTitle">' + genreName + '</h3>';
    }

    html += '</div>';

    if (options.enableOverflow) {
        html += '<div is="emby-scroller" class="padded-top-focusscale padded-bottom-focusscale" data-centerfocus="true">';
        html += '<div is="emby-itemscontainer" class="itemsContainer scrollSlider focuscontainer-x">';
        html += '</div>';
        html += '</div>';
    } else {
        html += '<div is="emby-itemscontainer" class="itemsContainer focuscontainer-x padded-left padded-right vertical-wrap">';
        html += '</div>';
    }

    frag.innerHTML = html;

    const itemsContainer: SectionContainerElement | null = frag.querySelector('.itemsContainer');
    if (!itemsContainer) return;

    itemsContainer.fetchData = getFetchGenreItemsFn(apiClient, userId, config.itemType, genre.Id);
    itemsContainer.getItemsHtml = getGenreItemsHtmlFn(config.itemType, options);
    itemsContainer.parentContainer = frag;
}

/**
 * Renders a primary home section ("My Movies"/"My Series") followed by one
 * horizontally scrollable row per genre.
 */
export function loadGenreRows(
    elem: HTMLElement,
    apiClient: ApiClient,
    user: UserDto,
    userViews: BaseItemDto[],
    options: SectionOptions,
    config: GenreSectionConfig
) {
    elem.classList.remove('verticalSection');
    elem.classList.add('homeGenreSection');
    elem.innerHTML = '';

    const userId = user.Id || apiClient.getCurrentUserId();

    return queryClient
        .fetchQuery(getGenresQuery(apiClient, userId, config.itemType))
        .then(result => result.Items || [])
        .then(genres => {
            if (!genres.length) {
                elem.innerHTML = '';
                return;
            }

            if (config.showHeading !== false) {
                renderPrimaryHeading(elem, config, userViews);
            }

            genres.forEach(genre => {
                renderGenreRow(elem, apiClient, userId, genre, config, options);
            });
        })
        .catch(err => {
            console.error('[genreRows] failed to load genres', err);
            elem.innerHTML = '';
        });
}
