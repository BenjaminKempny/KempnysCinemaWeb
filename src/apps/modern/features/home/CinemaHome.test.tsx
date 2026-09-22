import { Api } from '@jellyfin/sdk/lib/api';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import type { UserPolicy } from '@jellyfin/sdk/lib/generated-client/models/user-policy';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act, type PropsWithChildren } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CinemaScope } from './api';
import CinemaHome from './CinemaHome';
import type { CollectionEditorOptions } from './CollectionManager';
import HomePreferences from '../../routes/user/home';

const mocks = vi.hoisted(() => ({
    context: vi.fn(),
    views: vi.fn(),
    settings: new Map<string, string>(),
    getSetting: vi.fn(),
    setSetting: vi.fn()
}));

vi.mock('hooks/useApi', () => ({ useApi: mocks.context }));
vi.mock('hooks/api/useUserViews', () => ({
    getUserViewsQuery: () => ({ queryKey: ['Views'], queryFn: mocks.views })
}));
vi.mock('scripts/settings/userSettings', () => ({
    get: mocks.getSetting,
    set: mocks.setSetting
}));
vi.mock('lib/globalize', () => ({ default: { translate: (key: string) => key } }));
vi.mock('components/Page', () => ({
    default: ({ children, id, className }: PropsWithChildren<{ id?: string; className?: string }>) =>
        <main id={id} className={className}>{children}</main>
}));
vi.mock('components/backdrop/backdrop', () => ({ clearBackdrop: vi.fn() }));
vi.mock('components/loading/LoadingComponent', () => ({ default: () => <div>Loading</div> }));
vi.mock('components/playback/playbackmanager', () => ({ playbackManager: {} }));
vi.mock('utils/events', () => ({ default: { on: vi.fn(), off: vi.fn() } }));
vi.mock('./MediaCard', () => ({
    RequestState: ({ pending, error }: { pending?: boolean; error?: boolean }) =>
        <div data-testid='request-state' data-pending={!!pending} data-error={!!error} />
}));
vi.mock('./CollectionManager', () => ({
    default: () => <div data-testid='collection-manager' />
}));
vi.mock('./HomeViews', () => ({
    Spotlight: (props: ViewProps) => <View name='hero' {...props} />,
    ContinueWatching: (props: ViewProps) => <View name='continue' {...props} />,
    Catalog: (props: ViewProps) => <View name='catalog' {...props} />,
    Collections: (props: ViewProps) => <View name='collections' {...props} />,
    CollectionContents: (props: ViewProps) => <View name='collection-content' {...props} />,
    Genres: (props: ViewProps) => <View name='genres' {...props} />
}));

interface ViewProps {
    scope: CinemaScope;
    genreId?: string;
    id?: string;
    onManage?: (options: CollectionEditorOptions) => void;
}

function View({ name, scope, genreId, id, onManage }: ViewProps & { name: string }) {
    return <section data-testid={name} data-media={scope.media} data-library={scope.libraryId}
        data-genre={genreId} data-collection={id} data-can-manage={!!onManage} />;
}

function LocationProbe() {
    const location = useLocation();
    return <output data-testid='location'>{location.pathname}{location.search}</output>;
}

const libraries: BaseItemDto[] = [
    { Id: 'movies-one', Name: 'First movies', CollectionType: CollectionType.Movies },
    { Id: 'movies-two', Name: 'Second movies', CollectionType: CollectionType.Movies },
    { Id: 'series-one', Name: 'First shows', CollectionType: CollectionType.Tvshows },
    { Id: 'series-two', Name: 'Second shows', CollectionType: CollectionType.Tvshows }
];
const policy: UserPolicy = { AuthenticationProviderId: '', PasswordResetProviderId: '' };
// eslint-disable-next-line @typescript-eslint/naming-convention
const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };
let root: Root;
let container: HTMLDivElement;
let queryClient: QueryClient;

function context(serverId = 'server-one', permissions: Partial<UserPolicy> = {}) {
    return {
        api: new Api(`https://${serverId}.example`, { name: 'test', version: '1' }, { name: 'test', id: 'test' }),
        user: { Id: 'user', Policy: { ...policy, ...permissions } },
        __legacyApiClient__: { serverId: () => serverId }
    };
}

beforeEach(() => {
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true });
    mocks.settings.clear();
    mocks.context.mockReset().mockReturnValue(context());
    mocks.views.mockReset().mockResolvedValue({ Items: libraries });
    mocks.getSetting.mockReset().mockImplementation((key: string) => mocks.settings.get(key) ?? null);
    mocks.setSetting.mockReset().mockImplementation((key: string, value: string) => {
        mocks.settings.set(key, value);
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
});

async function settle() {
    await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
    });
}

async function renderHome(url = '/home?media=movies&view=all') {
    await act(async () => {
        root.render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={[url]} future={routerFuture}>
                    <Routes>
                        <Route path='/home' element={<CinemaHome />} />
                        <Route path='/mypreferenceshome' element={<HomePreferences />} />
                    </Routes>
                    <LocationProbe />
                </MemoryRouter>
            </QueryClientProvider>
        );
    });
    await settle();
}

function findView(name: string) {
    return container.querySelector<HTMLElement>(`[data-testid="${name}"]`);
}

function sourceSelect(media = 'movies') {
    const select = container.querySelector<HTMLSelectElement>(`select[name="${media}"]`);
    if (!select) throw new Error('Library source selector is missing.');
    return select;
}

async function chooseSource(id: string, media = 'movies') {
    const select = sourceSelect(media);
    await act(async () => {
        select.value = id;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await settle();
}

async function clickLink(selector: string) {
    const link = container.querySelector<HTMLAnchorElement>(selector);
    if (!link) throw new Error(`Missing navigation link: ${selector}`);
    await act(async () => {
        link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    });
    await settle();
}

describe('cinema library selection', () => {
    it('requires an explicit source when multiple libraries match instead of merging them', async () => {
        await renderHome();
        expect(container.querySelector('select')).toBeNull();
        expect(container.querySelector('.cinemaEmpty')?.textContent).toContain('CinemaChooseLibrary');
        expect(findView('catalog')).toBeNull();
        expect(findView('hero')).toBeNull();
        expect(findView('continue')).toBeNull();

        await clickLink('a[href="/mypreferenceshome"]');
        expect(sourceSelect().value).toBe('');
        expect(Array.from(sourceSelect().options).map(option => option.value)).toEqual(['', 'movies-one', 'movies-two']);
        await chooseSource('movies-two');
        await clickLink('a[href="/home"]');
        expect(findView('catalog')?.dataset.library).toBe('movies-two');
        expect(findView('hero')?.dataset.library).toBe('movies-two');
        expect(findView('continue')?.dataset.library).toBe('movies-two');
    });

    it('can use the sole matching library without merging other media libraries', async () => {
        mocks.views.mockResolvedValue({ Items: [libraries[0], libraries[2]] });
        await renderHome();
        expect(container.querySelector('select')).toBeNull();
        expect(findView('catalog')?.dataset.library).toBe('movies-one');
        expect(mocks.setSetting).not.toHaveBeenCalled();
    });

    it('requires a new choice for a stale saved library even when only one remains', async () => {
        mocks.settings.set('cinemaLibrary:server-one:movies', 'deleted-library');
        mocks.views.mockResolvedValue({ Items: [libraries[0]] });
        await renderHome();
        expect(container.querySelector('select')).toBeNull();
        expect(container.querySelector('.cinemaEmpty')?.textContent).toContain('CinemaChooseLibrary');
        expect(findView('catalog')).toBeNull();

        await clickLink('a[href="/mypreferenceshome"]');
        expect(sourceSelect().value).toBe('');
        await chooseSource('movies-one');
        await clickLink('a[href="/home"]');
        expect(findView('catalog')?.dataset.library).toBe('movies-one');
        expect(mocks.settings.get('cinemaLibrary:server-one:movies')).toBe('movies-one');
    });

    it('persists and restores separate library choices for movies and series', async () => {
        await renderHome('/mypreferenceshome');
        await chooseSource('movies-two');
        await chooseSource('series-two', 'series');
        await clickLink('a[href="/home"]');
        await clickLink('a[aria-label="Shows"]');
        expect(findView('catalog')?.dataset).toMatchObject({ media: 'series', library: 'series-two' });

        await clickLink('a[aria-label="Movies"]');
        expect(findView('catalog')?.dataset.library).toBe('movies-two');
        await clickLink('a[aria-label="Shows"]');
        expect(findView('catalog')?.dataset.library).toBe('series-two');
        expect(mocks.setSetting).toHaveBeenCalledWith('cinemaLibrary:server-one:movies', 'movies-two', false);
        expect(mocks.setSetting).toHaveBeenCalledWith('cinemaLibrary:server-one:series', 'series-two', false);
    });

    it('isolates persisted sources by server and restores the previous server selection', async () => {
        mocks.settings.set('cinemaLibrary:server-one:movies', 'movies-two');
        await renderHome();
        mocks.context.mockReturnValue(context('server-two'));
        await renderHome();
        expect(findView('catalog')).toBeNull();
        await clickLink('a[href="/mypreferenceshome"]');
        await chooseSource('movies-one');
        expect(mocks.settings.get('cinemaLibrary:server-two:movies')).toBe('movies-one');
        await clickLink('a[href="/home"]');

        mocks.context.mockReturnValue(context('server-one'));
        await renderHome();
        expect(findView('catalog')?.dataset.library).toBe('movies-two');
    });

    it('keeps the saved source when browser storage fails and displays the error', async () => {
        mocks.settings.set('cinemaLibrary:server-one:movies', 'movies-one');
        mocks.setSetting.mockImplementation(() => {
            throw new DOMException('Storage blocked');
        });
        await renderHome('/mypreferenceshome');
        await chooseSource('movies-two');
        expect(sourceSelect().value).toBe('movies-one');
        expect(container.textContent).toContain('CinemaSourceSaveError');
    });
});

describe('cinema navigation and views', () => {
    it.each(['all', 'collections', 'genres'])('keeps the %s view beside the sidebar inside a full-page frame', async view => {
        await renderHome(`/home?media=movies&view=${view}`);
        const frame = container.querySelector('#cinemaHomePage.cinemaPage > .cinemaHome');
        expect(frame).not.toBeNull();
        expect(frame?.children[0].classList.contains('cinemaSidebar')).toBe(true);
        expect(frame?.children[1].classList.contains('cinemaShell')).toBe(true);
        expect(frame?.querySelector('.cinemaShell .cinemaSidebar')).toBeNull();
    });

    beforeEach(() => {
        mocks.settings.set('cinemaLibrary:server-one:movies', 'movies-one');
        mocks.settings.set('cinemaLibrary:server-one:series', 'series-one');
    });

    it.each([
        { view: 'collections', filter: 'collection=movie-box', child: 'collection-content', nextChild: 'collections' },
        { view: 'genres', filter: 'genre=comedy', child: 'catalog', nextChild: 'genres' }
    ])('keeps the $view tab while clearing detail filters on sidebar media changes', async ({ view, filter, child, nextChild }) => {
        await renderHome(`/home?media=movies&view=${view}&${filter}&title=Old%20title`);
        expect(findView(child)).not.toBeNull();
        await clickLink('a[aria-label="Shows"]');
        expect(findView('location')?.textContent).toBe(`/home?media=series&view=${view}`);
        expect(findView(nextChild)?.dataset).toMatchObject({ media: 'series', library: 'series-one' });
        expect(container.querySelector('a[aria-label="Shows"]')?.getAttribute('aria-current')).toBe('page');
        expect(container.querySelector('.cinemaTabs a[aria-current="page"]')?.textContent)
            .toBe(view === 'genres' ? 'Genres' : 'Collections');
    });

    it('renders hero and continue watching only in All, never collection or genre tabs', async () => {
        await renderHome();
        expect(findView('hero')).not.toBeNull();
        expect(findView('continue')).not.toBeNull();
        expect(findView('catalog')).not.toBeNull();

        await clickLink('.cinemaTabs a[href*="view=collections"]');
        expect(findView('collections')).not.toBeNull();
        expect(findView('hero')).toBeNull();
        expect(findView('continue')).toBeNull();

        await clickLink('.cinemaTabs a[href*="view=genres"]');
        expect(findView('genres')).not.toBeNull();
        expect(findView('hero')).toBeNull();
        expect(findView('continue')).toBeNull();

        await clickLink('.cinemaTabs a[href*="view=all"]');
        expect(findView('hero')).not.toBeNull();
        expect(findView('continue')).not.toBeNull();
    });

    it.each([
        { view: 'collections', detail: 'collection=box', child: 'collection-content', attribute: 'collection', id: 'box' },
        { view: 'genres', detail: 'genre=comedy', child: 'catalog', attribute: 'genre', id: 'comedy' }
    ])('does not render All-only sections in $view detail routes', async ({ view, detail, child, attribute, id }) => {
        await renderHome(`/home?media=movies&view=${view}&${detail}`);
        expect(findView(child)?.dataset[attribute]).toBe(id);
        expect(findView('hero')).toBeNull();
        expect(findView('continue')).toBeNull();
    });
});

describe('cinema collection management permissions', () => {
    it.each([
        { permissions: {}, allowed: 'false' },
        { permissions: { IsAdministrator: true }, allowed: 'true' },
        { permissions: { EnableCollectionManagement: true }, allowed: 'true' }
    ])('passes onManage only for authorized users: $permissions', async ({ permissions, allowed }) => {
        mocks.context.mockReturnValue(context('server-one', permissions));
        mocks.settings.set('cinemaLibrary:server-one:movies', 'movies-one');
        await renderHome();
        expect(findView('catalog')?.dataset.canManage).toBe(allowed);
        await clickLink('.cinemaTabs a[href*="view=collections"]');
        expect(findView('collections')?.dataset.canManage).toBe(allowed);
        await clickLink('.cinemaTabs a[href*="view=genres"]');
        expect(findView('genres')?.dataset.canManage).toBe(allowed);
    });
});
