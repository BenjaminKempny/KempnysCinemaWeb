import { Api } from '@jellyfin/sdk/lib/api';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import { describe, expect, it } from 'vitest';

import {
    cinemaItemParams,
    cinemaNextOffset,
    collectionIds,
    mergeCinemaContinue,
    requireCinemaApi,
    requireCollectionManager
} from './utils';

const api = new Api('https://cinema.example', { name: 'test', version: '1' }, { name: 'test', id: 'test' });
const policy = { AuthenticationProviderId: '', PasswordResetProviderId: '' };
const scope = { media: 'movies', libraryId: 'movies-library' } as const;

describe('cinema item parameters', () => {
    it('uses scoped, alphabetical, uncollapsed movie pages', () => {
        expect(cinemaItemParams(scope, 'user')).toMatchObject({
            userId: 'user',
            parentId: 'movies-library',
            includeItemTypes: [BaseItemKind.Movie],
            limit: 40,
            recursive: true,
            collapseBoxSetItems: false,
            enableUserData: true,
            sortBy: [ItemSortBy.SortName],
            sortOrder: [SortOrder.Ascending],
            fields: ['Overview', 'Genres', 'PrimaryImageAspectRatio']
        });
    });

    it('supports collection, search, genre, sort and page-size overrides without changing user or media', () => {
        expect(cinemaItemParams({ ...scope, media: 'series' }, 'user', {
            parentId: 'mixed-collection',
            genreIds: ['comedy'],
            searchTerm: 'space',
            limit: 15,
            sortBy: [ItemSortBy.DateCreated],
            sortOrder: [SortOrder.Descending],
            userId: 'other-user',
            includeItemTypes: [BaseItemKind.Movie],
            collapseBoxSetItems: true
        })).toMatchObject({
            parentId: 'mixed-collection',
            genreIds: ['comedy'],
            searchTerm: 'space',
            limit: 15,
            sortBy: [ItemSortBy.DateCreated],
            sortOrder: [SortOrder.Descending],
            userId: 'user',
            includeItemTypes: [BaseItemKind.Series],
            collapseBoxSetItems: false
        });
    });

    it.each([0, -1, 1.5, Number.NaN])('rejects invalid page sizes: %s', limit => {
        expect(() => cinemaItemParams(scope, 'user', { limit })).toThrow('page size');
    });

    it('supports explicitly unscoped BoxSet pages for the all-collections picker', () => {
        expect(cinemaItemParams(scope, 'user', {
            includeItemTypes: [BaseItemKind.BoxSet],
            parentId: undefined
        })).toMatchObject({
            parentId: undefined,
            includeItemTypes: [BaseItemKind.BoxSet],
            limit: 40
        });
    });

    it('retains the library when parentId is omitted and selected media for collection contents', () => {
        expect(cinemaItemParams(scope, 'user').parentId).toBe(scope.libraryId);
        expect(cinemaItemParams({ ...scope, media: 'series' }, 'user', {
            parentId: 'mixed'
        })).toMatchObject({
            parentId: 'mixed',
            includeItemTypes: [BaseItemKind.Series]
        });
    });
});

describe('cinema continuation merging', () => {
    it('puts resume first, deduplicates IDs and suppresses next-up for resumable series', () => {
        expect(mergeCinemaContinue([
            { Id: 'resume', SeriesId: 'series-one' },
            { Id: 'duplicate' },
            { Id: 'duplicate' }
        ], [
            { Id: 'next-one', SeriesId: 'series-one' },
            { Id: 'next-two', SeriesId: 'series-two' },
            { Id: 'duplicate' },
            {}
        ]).map(item => item.Id)).toEqual(['resume', 'duplicate', 'next-two']);
    });

    it('caps results at 24', () => {
        const items = Array.from({ length: 40 }, (_, index) => ({ Id: String(index) }));
        expect(mergeCinemaContinue(items, [])).toEqual(items.slice(0, 24));
    });
});

describe('raw pagination', () => {
    it('advances full pages by their raw offset, ignoring disabled total counts', () => {
        expect(cinemaNextOffset({ Items: [{}, {}], TotalRecordCount: 0 }, 4, 2)).toBe(6);
    });

    it('stops on short or absent pages', () => {
        expect(cinemaNextOffset({ Items: [{}] }, 4, 2)).toBeUndefined();
        expect(cinemaNextOffset({}, 0, 2)).toBeUndefined();
    });
});

describe('collection validation', () => {
    it('requires a server, user and library for reads', () => {
        expect(() => requireCinemaApi(undefined, 'user', scope)).toThrow();
        expect(() => requireCinemaApi(api, undefined, scope)).toThrow();
        expect(() => requireCinemaApi(api, 'user', { ...scope, libraryId: '' })).toThrow();
        expect(requireCinemaApi(api, 'user', scope)).toBe(api);
    });

    it('allows administrators or collection managers, never anonymous users', () => {
        expect(requireCollectionManager(api, { Id: 'user', Policy: { ...policy, IsAdministrator: true } })).toBe(api);
        expect(requireCollectionManager(api, { Id: 'user', Policy: { ...policy, EnableCollectionManagement: true } })).toBe(api);
        expect(() => requireCollectionManager(api, { Id: 'user' })).toThrow('permission');
        expect(() => requireCollectionManager(api)).toThrow('user');
        expect(() => requireCollectionManager(undefined, { Id: 'user' })).toThrow('server');
    });

    it('rejects empty IDs and normalizes valid lists', () => {
        expect(() => collectionIds([])).toThrow();
        expect(() => collectionIds(['valid', ' '])).toThrow();
        expect(collectionIds([' item ', 'item', 'second'])).toEqual(['item', 'second']);
    });
});
