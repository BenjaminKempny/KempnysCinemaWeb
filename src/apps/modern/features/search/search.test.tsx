import { Api } from '@jellyfin/sdk/lib/api';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act, type PropsWithChildren } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { appRouter } from 'components/router/appRouter';

import Search from '../../routes/search';

const requests = vi.hoisted(() => ({ search: vi.fn(), items: vi.fn() }));
vi.mock('@jellyfin/sdk/lib/utils/api/search-api', () => ({
    getSearchApi: () => ({ getSearchHints: requests.search })
}));
vi.mock('@jellyfin/sdk/lib/utils/api/library-api', () => ({
    getLibraryApi: () => ({ getItems: requests.items })
}));
vi.mock('hooks/useApi', () => ({
    useApi: () => ({ api, user: { Id: 'user' }, __legacyApiClient__: { serverId: () => 'current-server' } })
}));
vi.mock('components/router/appRouter', () => ({
    appRouter: {
        getRouteUrl: vi.fn((item: { Id: string; ServerId?: string }, options?: { serverId?: string }) =>
            `#/details?id=${item.Id}&serverId=${item.ServerId || options?.serverId}`)
    }
}));
vi.mock('components/Page', () => ({
    default: ({ children, className }: PropsWithChildren<{ className: string }>) => <main className={className}>{children}</main>
}));
vi.mock('components/backdrop/backdrop', () => ({ clearBackdrop: vi.fn() }));
vi.mock('components/layoutManager', () => ({ default: { tv: false } }));
vi.mock('components/playback/playbackmanager', () => ({ playbackManager: {} }));
vi.mock('lib/globalize', () => ({
    default: { translate: (key: string, value?: string) => [key, value].filter(Boolean).join(': ') }
}));

const api = new Api('https://cinema.example', { name: 'test', version: '1' }, { name: 'test', id: 'test' });
// eslint-disable-next-line @typescript-eslint/naming-convention
const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };
let client: QueryClient;
let container: HTMLDivElement;
let root: Root;

function LocationProbe() {
    const location = useLocation();
    return <output data-testid='location'>{location.pathname}{location.search}</output>;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    requests.search.mockReset().mockResolvedValue({
        data: { SearchHints: [{ Id: 'movie', Name: 'Matrix', Type: BaseItemKind.Movie }], TotalRecordCount: 1 }
    });
    requests.items.mockReset().mockResolvedValue({ data: { Items: [{ Id: 'suggested', Name: 'Suggested movie' }] } });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    client.clear();
    container.remove();
    vi.unstubAllGlobals();
});

async function settle(delay = 0) {
    await act(async () => {
        await new Promise(resolve => setTimeout(resolve, delay));
    });
}

async function render(url = '/search') {
    await act(async () => {
        root.render(<QueryClientProvider client={client}>
            <MemoryRouter initialEntries={[url]} future={routerFuture}><Search /><LocationProbe /></MemoryRouter>
        </QueryClientProvider>);
    });
    await settle();
}

async function click(selector: string) {
    const element = container.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    await act(async () => element.click());
    await settle();
}

describe('cinema search page', () => {
    it('uses the shared cinema shell, selected sidebar destination and poster suggestions', async () => {
        await render();
        expect(container.querySelector('.cinemaHome > .cinemaSidebar')).not.toBeNull();
        expect(container.querySelector('.cinemaSidebar [aria-current="page"]')?.getAttribute('href')).toBe('/search');
        expect(container.querySelector('.cinemaBrand img')?.getAttribute('src')).toBe('assets/img/appIcon.png');
        expect(container.querySelector('.cinemaGrid')?.textContent).toContain('Suggested movie');
        expect(requests.search).not.toHaveBeenCalled();
    });

    it('renders URL searches and preserves the term when filtering', async () => {
        await render('/search?query=Matrix');
        expect(container.querySelector('.cinemaSearchResults')?.textContent).toContain('Matrix');
        await click('.cinemaSearchFilters a[href*="type=Series"]');
        expect(requests.search).toHaveBeenLastCalledWith(expect.objectContaining({
            searchTerm: 'Matrix', includeItemTypes: [BaseItemKind.Series]
        }), expect.anything());
        expect(container.querySelector('[data-testid="location"]')?.textContent).toContain('type=Series');
    });

    it.each([BaseItemKind.Movie, BaseItemKind.BoxSet])('opens %s search results with the active server', async type => {
        requests.search.mockResolvedValue({
            data: { SearchHints: [{ Id: 'result', Name: 'Matrix', Type: type }], TotalRecordCount: 1 }
        });
        await render('/search?query=Matrix');

        expect(appRouter.getRouteUrl).toHaveBeenCalledWith(
            expect.objectContaining({ Id: 'result', Type: type }),
            { serverId: 'current-server' }
        );
        await click('.cinemaCardLink');
        expect(container.querySelector('[data-testid="location"]')?.textContent)
            .toBe('/details?id=result&serverId=current-server');
    });

    it('preserves the server supplied by a suggestion', async () => {
        requests.items.mockResolvedValue({
            data: { Items: [{ Id: 'suggested', Name: 'Suggested movie', ServerId: 'item-server' }] }
        });
        await render();
        await click('.cinemaCardLink');
        expect(container.querySelector('[data-testid="location"]')?.textContent)
            .toBe('/details?id=suggested&serverId=item-server');
    });

    it('clears the query, returns to suggestions and restores input focus', async () => {
        await render('/search?query=Matrix');
        await click('button[aria-label="CinemaClearSearch"]');
        expect(container.querySelector('input')?.value).toBe('');
        expect(container.querySelector('.cinemaSearchResults')).toBeNull();
        expect(document.activeElement).toBe(container.querySelector('input'));
        expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/search');
    });

    it('keeps errors distinct from empty results and allows retrying', async () => {
        requests.search.mockRejectedValueOnce(new Error('offline'));
        await render('/search?query=Matrix');
        await settle();
        expect(container.querySelector('[role="alert"]')?.textContent).toContain('CinemaLoadError');
        expect(container.textContent).not.toContain('SearchResultsEmpty');
        await click('[role="alert"] button');
        expect(container.querySelector('.cinemaSearchResults')?.textContent).toContain('Matrix');
    });

    it('offers a global search without losing the query or media filter', async () => {
        await render('/search?query=Matrix&parentId=library&collectionType=movies&type=Movie');
        await click('.cinemaSearchIntro > a');
        expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/search?query=Matrix&type=Movie');
        expect(requests.search).toHaveBeenLastCalledWith(expect.objectContaining({
            searchTerm: 'Matrix', parentId: undefined, includeItemTypes: [BaseItemKind.Movie]
        }), expect.anything());
    });

    it('debounces typing instead of requesting every keystroke', async () => {
        await render();
        const input = container.querySelector('input');
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (!input || !setter) throw new Error('Missing search input');
        act(() => {
            setter.call(input, 'Matrix');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        expect(requests.search).not.toHaveBeenCalled();
        await settle(400);
        await settle();
        expect(requests.search).toHaveBeenCalledOnce();
        expect(requests.search).toHaveBeenCalledWith(expect.objectContaining({ searchTerm: 'Matrix' }), expect.anything());
    });
});
