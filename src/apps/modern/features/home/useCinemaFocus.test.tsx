import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Link, MemoryRouter, Route, Routes, useNavigate, type NavigateFunction } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import layoutManager from 'components/layoutManager';
import useCinemaFocus from './useCinemaFocus';

vi.mock('components/layoutManager', () => ({ default: { tv: true } }));
vi.mock('components/focusManager', () => ({
    default: {
        focus: (element: HTMLElement) => element.focus(),
        isCurrentlyFocusable: (element: HTMLElement) => element.isConnected && !element.hidden,
        getFocusableElements: (element: HTMLElement) => Array.from(element.querySelectorAll('a, button:not(:disabled), input'))
            .filter(candidate => !candidate.hasAttribute('hidden'))
    }
}));

let navigate: NavigateFunction;
function TestPage({ loading = false, reversed = false }: Readonly<{ loading?: boolean; reversed?: boolean }>) {
    const ref = useCinemaFocus();
    navigate = useNavigate();
    const ids = reversed ? ['second', 'first'] : ['first', 'second'];
    return <div ref={ref}>
        <nav className='cinemaTabs'><Link to='/home' aria-current='page'>All</Link></nav>
        {loading ? <div role='status'>Loading</div> : <div className='cinemaContent'>
            {ids.map(id => <Link key={id} id={id} to={`/details?id=${id}`}>{id}</Link>)}
            <section data-focus-region='continue'>
                <Link id='duplicate' to='/details?id=second'>second</Link>
            </section>
        </div>}
    </div>;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
const future = { v7_startTransition: true, v7_relativeSplatPath: true };

describe('Cinema TV focus', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        layoutManager.tv = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });

    async function render(loading = false, reversed = false) {
        await act(async () => {
            root.render(<MemoryRouter initialEntries={[{ pathname: '/home', key: expect.getState().currentTestName }]} future={future}>
                <Routes>
                    <Route path='/home' element={<TestPage loading={loading} reversed={reversed} />} />
                    <Route path='/details' element={<div>Details</div>} />
                </Routes>
            </MemoryRouter>);
        });
    }

    it('focuses the current tab when entering the page', async () => {
        await render();
        expect(document.activeElement?.textContent).toBe('All');
    });

    it('keeps navigation usable while initial content is loading', async () => {
        await render(true);
        expect(document.activeElement?.textContent).toBe('All');
        await render();
        expect(document.activeElement?.textContent).toBe('All');
    });

    it('waits for the remembered card when returning to asynchronously loaded content', async () => {
        await render();
        document.getElementById('second')?.focus();
        act(() => navigate('/details?id=second'));
        await render(true);
        await act(async () => navigate(-1));
        expect(document.activeElement).toBe(document.body);
        await render();
        expect(document.activeElement?.id).toBe('second');
    });

    it('restores the same card after going back even if its position changes', async () => {
        await render();
        document.getElementById('second')?.focus();
        act(() => navigate('/details?id=second'));
        await render(false, true);
        await act(async () => navigate(-1));
        expect(document.activeElement?.id).toBe('second');
    });

    it('restores the correct region when the same movie appears more than once', async () => {
        await render();
        document.getElementById('duplicate')?.focus();
        act(() => navigate('/details?id=second'));
        await act(async () => navigate(-1));
        expect(document.activeElement?.id).toBe('duplicate');
    });

    it('does not steal focus while loading more cards', async () => {
        await render();
        document.getElementById('second')?.focus();
        await render(false, true);
        expect(document.activeElement?.id).toBe('second');
    });

    it('leaves focus in an open dialog', async () => {
        const dialog = document.createElement('button');
        document.body.appendChild(dialog);
        dialog.focus();
        try {
            await render();
            expect(document.activeElement).toBe(dialog);
        } finally {
            dialog.remove();
        }
    });

    it('initializes focus in desktop mode as well', async () => {
        layoutManager.tv = false;
        await render();
        expect(document.activeElement?.textContent).toBe('All');
    });

    it('recovers focus if the currently selected card is hidden dynamically', async () => {
        await render();
        const selected = document.getElementById('second');
        selected?.focus();
        await act(async () => {
            if (selected) selected.hidden = true;
        });
        expect(document.activeElement?.textContent).toBe('All');
    });
});
