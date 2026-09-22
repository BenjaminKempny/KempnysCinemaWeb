import type { UserDto } from '@jellyfin/sdk/lib/generated-client';
import { Api } from '@jellyfin/sdk/lib/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';

import { ApiProvider, useApi } from './useApi';
import { getUserQuery } from './api/useUser';

const state = vi.hoisted(() => ({
    user: { Id: 'user', ServerId: 'server', Name: 'Kempny', PrimaryImageTag: 'original' } as UserDto,
    getUser: vi.fn()
}));
vi.mock('lib/jellyfin-apiclient', () => {
    const client = {
        getCurrentUser: async () => state.user,
        serverId: () => 'server'
    };
    return {
        ServerConnections: {
            currentApiClient: () => client,
            getApiClient: () => client,
            getApi: () => ({ basePath: 'http://localhost' })
        }
    };
});
vi.mock('@jellyfin/sdk/lib/utils/api/user-api', () => ({
    getUserApi: () => ({ getUserById: state.getUser })
}));
vi.mock('utils/events', () => ({ default: { on: vi.fn(), off: vi.fn() } }));

const Consumer = () => {
    const { user } = useApi();
    return <span>{user?.PrimaryImageTag || 'no-avatar'}</span>;
};

const flush = () => new Promise(resolve => setTimeout(resolve, 10));

it('does not reuse profile data between servers with the same user id', () => {
    const first = new Api('https://first.example', { name: 'test', version: '1' }, { name: 'test', id: 'test' });
    const second = new Api('https://second.example', { name: 'test', version: '1' }, { name: 'test', id: 'test' });
    expect(getUserQuery(first, { userId: 'user' }).queryKey).not.toEqual(getUserQuery(second, { userId: 'user' }).queryKey);
});

it('refreshes all context avatar consumers after an upload or deletion invalidates the user query', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.getUser.mockResolvedValue({ data: state.user });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
        await act(async () => {
            root.render(
                <QueryClientProvider client={client}>
                    <ApiProvider><Consumer /></ApiProvider>
                </QueryClientProvider>
            );
            await flush();
        });
        await act(flush);
        expect(container.textContent).toBe('original');

        state.getUser.mockResolvedValue({ data: { ...state.user, PrimaryImageTag: 'replacement' } });
        await act(async () => {
            await client.invalidateQueries({ queryKey: ['User', 'user'] });
            await flush();
        });
        expect(container.textContent).toBe('replacement');

        state.getUser.mockResolvedValue({ data: { ...state.user, PrimaryImageTag: undefined } });
        await act(async () => {
            await client.invalidateQueries({ queryKey: ['User', 'user'] });
            await flush();
        });
        expect(container.textContent).toBe('no-avatar');
    } finally {
        act(() => root.unmount());
        client.clear();
        vi.unstubAllGlobals();
    }
});
