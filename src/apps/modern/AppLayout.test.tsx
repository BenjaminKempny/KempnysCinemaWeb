import React, { act, type PropsWithChildren } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Component } from './AppLayout';

vi.mock('@mui/material/useMediaQuery', () => ({ default: () => false }));
vi.mock('hooks/useApi', () => ({ useApi: () => ({ user: { Id: 'user' } }) }));
vi.mock('components/AppBody', () => ({
    default: ({ children }: PropsWithChildren) => <div>{children}</div>
}));
vi.mock('components/CustomCss', () => ({ default: () => null }));
vi.mock('components/ThemeCss', () => ({ default: () => null }));
vi.mock('components/OffsetAppBar', () => ({
    default: ({ children }: PropsWithChildren) => <header>{children}</header>
}));
vi.mock('./components/AppToolbar', () => ({ default: () => <div data-testid='toolbar' /> }));
vi.mock('./components/drawers/AppDrawer', () => ({
    default: () => <div data-testid='drawer' />,
    isDrawerPath: () => true
}));
vi.mock('./features/libraries/components/LibraryToolbar', () => ({ default: () => null }));
vi.mock('./features/libraries/hooks/useLibrary', () => ({
    LibraryProvider: ({ children }: PropsWithChildren) => <div>{children}</div>
}));
vi.mock('./features/libraries/utils/path', () => ({ isLibraryPath: () => false }));

// eslint-disable-next-line @typescript-eslint/naming-convention
const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };

describe('cinema application chrome', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });

    function render(path: string) {
        act(() => {
            root.render(<MemoryRouter initialEntries={[path]} future={routerFuture}><Component /></MemoryRouter>);
        });
    }

    it.each(['/home', '/details?id=movie&serverId=server', '/details?id=episode', '/search', '/userprofile'])(
        'removes the legacy toolbar, its offset, and the drawer on %s',
        path => {
            render(path);
            expect(container.querySelector('header')).toBeNull();
            expect(container.querySelector('[data-testid="toolbar"]')).toBeNull();
            expect(container.querySelector('[data-testid="drawer"]')).toBeNull();
            expect(container.querySelector('main')).not.toBeNull();
        }
    );

    it.each(['/mypreferenceshome', '/mypreferencesmenu'])('retains navigation on %s', path => {
        render(path);
        expect(container.querySelector('header')).not.toBeNull();
        expect(container.querySelector('[data-testid="toolbar"]')).not.toBeNull();
        expect(container.querySelector('[data-testid="drawer"]')).not.toBeNull();
    });
});
