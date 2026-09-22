import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import MediaCard from './MediaCard';

const playback = vi.hoisted(() => ({
    play: vi.fn<(options: { items: BaseItemDto[]; startPositionTicks: number }) => Promise<void>>()
}));

vi.mock('components/playback/playbackmanager', () => ({
    playbackManager: { play: playback.play }
}));
vi.mock('hooks/useApi', () => ({
    useApi: () => ({ __legacyApiClient__: { serverId: () => 'current-server' } })
}));
vi.mock('lib/globalize', () => ({
    default: { translate: (key: string) => key }
}));

const episode: BaseItemDto = {
    Id: 'episode',
    Name: 'Pilot',
    Type: BaseItemKind.Episode,
    SeriesName: 'Example series',
    ParentIndexNumber: 1,
    IndexNumber: 2,
    UserData: { Key: 'episode', PlaybackPositionTicks: 123456789, PlayedPercentage: 42 }
};

let client: QueryClient;
let container: HTMLDivElement;
let root: Root;

function renderCard(item: BaseItemDto = episode) {
    act(() => {
        root.render(
            <QueryClientProvider client={client}>
                <MemoryRouter>
                    <MediaCard item={item} wide />
                </MemoryRouter>
            </QueryClientProvider>
        );
    });
}

function getPlayButton() {
    const button = container.querySelector<HTMLButtonElement>('.cinemaCardPlay');
    if (!button) {
        throw new Error('Missing playback button');
    }
    return button;
}

async function play() {
    await act(async () => {
        getPlayButton().click();
        await new Promise(resolve => setTimeout(resolve, 0));
    });
}

beforeEach(() => {
    playback.play.mockReset().mockResolvedValue(undefined);
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
});

describe('media card', () => {
    it('resumes at the saved position using the current server fallback', async () => {
        renderCard();
        expect(getPlayButton().getAttribute('aria-label')).toBe('ButtonResume: Example series');

        await play();

        expect(playback.play).toHaveBeenCalledExactlyOnceWith({
            items: [{ ...episode, ServerId: 'current-server' }],
            startPositionTicks: 123456789
        });
        expect(episode.ServerId).toBeUndefined();
    });

    it('preserves an explicit item server and starts unwatched items at zero', async () => {
        const item = { ...episode, ServerId: 'item-server', UserData: { Key: 'episode' } };
        renderCard(item);
        expect(getPlayButton().getAttribute('aria-label')).toBe('Play: Example series');
        expect(container.textContent).toContain('NextUp');
        expect(container.querySelector('a')?.getAttribute('href')).toBe('/details?id=episode&serverId=item-server');

        await play();

        expect(playback.play).toHaveBeenCalledExactlyOnceWith({
            items: [item],
            startPositionTicks: 0
        });
    });

    it('shows a playback failure without removing the details link', async () => {
        playback.play.mockRejectedValue(new Error('Playback unavailable'));
        renderCard();

        await play();
        await vi.waitFor(async () => {
            await act(async () => {
                await new Promise(resolve => setTimeout(resolve, 0));
            });
            expect(container.querySelector('[role="alert"]')?.textContent).toBe('CinemaPlaybackError');
        });

        expect(getPlayButton().disabled).toBe(false);
        expect(container.querySelector('a')).not.toBeNull();
    });

    it('renders the details link, episode subtitle and accessible playback progress', () => {
        renderCard();

        expect(container.querySelector('a')?.getAttribute('href')).toBe('/details?id=episode&serverId=current-server');
        expect(container.querySelector('h3')?.textContent).toBe('Example series');
        expect(container.textContent).toContain('S1 E2 / Pilot');
        const progress = container.querySelector('progress');
        expect(progress?.value).toBe(42);
        expect(progress?.max).toBe(100);
        expect(progress?.getAttribute('aria-label')).toBe('HeaderContinueWatching');
    });

    it.each([-10, 150])('bounds progress percentage %s', percentage => {
        renderCard({ ...episode, UserData: { ...episode.UserData, Key: 'episode', PlayedPercentage: percentage } });
        const progress = container.querySelector('progress');
        if (percentage < 0) {
            expect(progress).toBeNull();
        } else {
            expect(progress?.value).toBe(100);
        }
    });

    it('disables playback when the media identifier is missing', async () => {
        renderCard({ ...episode, Id: undefined });
        expect(getPlayButton().disabled).toBe(true);
        await play();
        expect(playback.play).not.toHaveBeenCalled();
    });
});
