import type { LibraryApiGetItemsRequest } from '@jellyfin/sdk/lib/generated-client/api/library-api';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CinemaScope, CreateCinemaCollection, UpdateCinemaCollection } from './api';
import CollectionManager, { type CollectionEditorOptions } from './CollectionManager';

const requests = vi.hoisted(() => ({
    create: vi.fn<(params: CreateCinemaCollection) => Promise<unknown>>(),
    add: vi.fn<(params: UpdateCinemaCollection) => Promise<unknown>>(),
    close: vi.fn(),
    retryItems: vi.fn(),
    retryCollections: vi.fn(),
    nextItems: vi.fn(),
    nextCollections: vi.fn(),
    hasMore: false,
    collectionPages: [] as BaseItemDto[][],
    errors: { items: false, collections: false }
}));

vi.mock('lib/globalize', () => ({
    default: { translate: (key: string) => key }
}));

vi.mock('components/playback/playbackmanager', () => ({
    playbackManager: { play: vi.fn() }
}));
vi.mock('hooks/useApi', () => ({ useApi: () => ({}) }));
vi.mock('components/layoutManager', () => ({ default: { tv: false } }));
vi.mock('scripts/browser', () => ({ default: { tv: false } }));
vi.mock('scripts/settings/userSettings', () => ({
    currentSettings: { cinemaAppearance: () => 'dark', disableCollectionOperations: () => false },
    disableCollectionOperations: () => false,
    cinemaAppearance: () => 'dark'
}));

vi.mock('./MediaCard', async importOriginal => {
    const actual = await importOriginal<typeof import('./MediaCard')>();
    return { ...actual, Artwork: () => null };
});

vi.mock('./api', async () => {
    const { useMutation } = await import('@tanstack/react-query');
    return {
        useCinemaCollectionMutations: () => ({
            create: useMutation({ mutationFn: requests.create }),
            add: useMutation({ mutationFn: requests.add })
        }),
        useCinemaItems: (_scope: CinemaScope, options: LibraryApiGetItemsRequest) => ({
            data: {
                pages: options.includeItemTypes?.includes(BaseItemKind.BoxSet) ?
                    requests.collectionPages.map(Items => ({ Items })) :
                    [{ Items: [{ Id: 'first', Name: 'First movie' }, { Id: 'second', Name: 'Second movie' }] }]
            },
            isPending: false,
            isFetching: false,
            isError: options.includeItemTypes?.includes(BaseItemKind.BoxSet) ? requests.errors.collections : requests.errors.items,
            hasNextPage: requests.hasMore,
            refetch: options.includeItemTypes?.includes(BaseItemKind.BoxSet) ? requests.retryCollections : requests.retryItems,
            fetchNextPage: options.includeItemTypes?.includes(BaseItemKind.BoxSet) ? requests.nextCollections : requests.nextItems
        })
    };
});

const scope: CinemaScope = { media: 'movies', libraryId: 'movies-library' };
const first: BaseItemDto = { Id: 'first', Name: 'First movie' };
let client: QueryClient;
let container: HTMLDivElement;
let root: Root;
const observedTargets: Element[] = [];

function getElement<T extends Element>(selector: string): T {
    const element = document.querySelector<T>(selector);
    if (!element) {
        throw new Error(`Missing element: ${selector}`);
    }
    return element;
}

function renderManager(options: CollectionEditorOptions = {}) {
    act(() => {
        root.render(
            <QueryClientProvider client={client}>
                <CollectionManager scope={scope} options={options} onClose={requests.close} />
            </QueryClientProvider>
        );
    });
}

function setName(value: string) {
    const input = getElement<HTMLInputElement>('input[maxlength="200"]');
    act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

function selectItem(index: number) {
    const inputs = document.querySelectorAll<HTMLInputElement>('.cinemaPickerResults input[type="checkbox"]');
    act(() => inputs[index].click());
}

function selectCollection() {
    act(() => getElement<HTMLInputElement>('input[type="radio"][value="collection"]').click());
}

async function save() {
    await act(async () => {
        getElement<HTMLButtonElement>('button[type="submit"]').click();
        await new Promise(resolve => setTimeout(resolve, 0));
    });
}

beforeEach(() => {
    requests.create.mockReset().mockResolvedValue({});
    requests.add.mockReset().mockResolvedValue({});
    requests.close.mockReset();
    requests.retryItems.mockReset();
    requests.retryCollections.mockReset();
    requests.nextItems.mockReset().mockResolvedValue({});
    requests.nextCollections.mockReset().mockResolvedValue({});
    requests.hasMore = false;
    requests.collectionPages = [[{ Id: 'collection', Name: 'Favorites' }]];
    observedTargets.length = 0;
    vi.stubGlobal('IntersectionObserver', class {
        readonly thresholds = [0];
        observe(target: Element) {
            observedTargets.push(target);
        }
        disconnect() {
            return undefined;
        }
    });
    requests.errors.items = false;
    requests.errors.collections = false;
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
    client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    client.clear();
    container.remove();
    vi.unstubAllGlobals();
});

describe('collection editor', () => {
    it('observes both sentinels and the last items inside their bounded scrolling pickers', () => {
        requests.hasMore = true;
        renderManager({ item: first });
        expect(observedTargets).toHaveLength(4);
        expect(observedTargets.filter(target => target.getAttribute('aria-hidden') === 'true')).toHaveLength(2);
        expect(observedTargets.filter(target => target.matches('label.cinemaPickerItem'))).toHaveLength(2);
        expect(observedTargets.every(target => target.parentElement?.classList.contains('cinemaPickerResults'))).toBe(true);
        expect(observedTargets[0].parentElement?.getAttribute('role')).toBe('radiogroup');
        expect(requests.nextItems).not.toHaveBeenCalled();
        expect(requests.nextCollections).not.toHaveBeenCalled();
        expect(document.body.textContent).not.toContain('ShowMore');
    });

    it('can select a collection loaded on a subsequent page', async () => {
        renderManager({ item: first });
        requests.collectionPages.push([{ Id: 'later', Name: 'Later collection' }]);
        renderManager({ item: first });
        act(() => getElement<HTMLInputElement>('input[type="radio"][value="later"]').click());
        await save();
        expect(requests.add).toHaveBeenCalledWith({ collectionId: 'later', ids: ['first'] }, expect.anything());
    });

    it.each([true, false])('creates with selected IDs and metadata=%s', async enableMetadata => {
        renderManager();
        expect(getElement<HTMLButtonElement>('button[type="submit"]').disabled).toBe(true);
        setName('  Weekend favorites  ');
        selectItem(0);
        selectItem(1);
        const metadata = getElement<HTMLInputElement>('.cinemaCheckbox input');
        expect(metadata.checked).toBe(true);
        if (!enableMetadata) {
            act(() => metadata.click());
        }

        await save();

        expect(requests.create).toHaveBeenCalledOnce();
        expect(requests.create.mock.calls[0][0]).toEqual({
            name: 'Weekend favorites',
            ids: ['first', 'second'],
            enableMetadata
        });
        expect(requests.add).not.toHaveBeenCalled();
        expect(requests.close).toHaveBeenCalledOnce();
    });

    it('adds the preselected item and picker selections to an existing collection', async () => {
        renderManager({ item: first });
        expect(getElement<HTMLInputElement>('.cinemaPickerResults input[type="checkbox"]').checked).toBe(true);
        selectCollection();
        selectItem(1);

        await save();

        expect(requests.add).toHaveBeenCalledOnce();
        expect(requests.add.mock.calls[0][0]).toEqual({ collectionId: 'collection', ids: ['first', 'second'] });
        expect(requests.create).not.toHaveBeenCalled();
        expect(requests.close).toHaveBeenCalledOnce();
    });

    it('removes a preselected item using its accessible chip button', () => {
        renderManager({ item: first, collectionId: 'collection' });
        act(() => getElement<HTMLButtonElement>('button[aria-label="ButtonRemove: First movie"]').click());
        expect(getElement<HTMLInputElement>('.cinemaPickerResults input').checked).toBe(false);
        expect(getElement<HTMLButtonElement>('button[type="submit"]').disabled).toBe(true);
    });

    it.each([
        ['create', 'items'],
        ['add', 'items'],
        ['add', 'collections']
    ] as const)('retries %s-mode %s without submitting a valid collection form', async (operation, query) => {
        requests.errors[query] = true;
        renderManager(operation === 'create' ? {} : { item: first });
        if (operation === 'create') {
            setName('Favorites');
            selectItem(0);
        } else {
            selectCollection();
        }
        expect(getElement<HTMLButtonElement>('button[type="submit"]').disabled).toBe(false);

        await act(async () => {
            getElement<HTMLButtonElement>('[role="alert"] button').click();
            await new Promise(resolve => setTimeout(resolve, 0));
        });

        expect(query === 'items' ? requests.retryItems : requests.retryCollections).toHaveBeenCalledOnce();
        expect(requests.create).not.toHaveBeenCalled();
        expect(requests.add).not.toHaveBeenCalled();
        expect(requests.close).not.toHaveBeenCalled();
    });

    it.each(['create', 'add'] as const)('keeps the dialog and selection open after a %s failure', async operation => {
        requests[operation].mockRejectedValue(new Error('Server unavailable'));
        renderManager(operation === 'create' ? {} : { item: first, collectionId: 'collection' });
        if (operation === 'create') {
            setName('Favorites');
            selectItem(0);
        }

        await save();
        await vi.waitFor(async () => {
            await act(async () => {
                await new Promise(resolve => setTimeout(resolve, 0));
            });
            expect(document.querySelector('[role="alert"]')?.textContent).toBe('CinemaSaveError');
        });

        expect(document.querySelector('[role="dialog"]')).not.toBeNull();
        expect(requests.close).not.toHaveBeenCalled();
        expect(getElement<HTMLInputElement>('.cinemaPickerResults input').checked).toBe(true);
        expect(getElement<HTMLButtonElement>('button[type="submit"]').disabled).toBe(false);
    });
});
