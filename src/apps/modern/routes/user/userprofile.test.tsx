import type { UserDto } from '@jellyfin/sdk/lib/generated-client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { act, type PropsWithChildren } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import UserProfile from './userprofile';

const state = vi.hoisted(() => ({
    user: {} as UserDto,
    currentUser: {} as UserDto,
    error: false,
    pending: false,
    retry: vi.fn(),
    upload: vi.fn(),
    remove: vi.fn(),
    password: vi.fn(),
    resetPassword: vi.fn()
}));
vi.mock('lib/globalize', () => ({ default: { translate: (key: string) => key } }));
vi.mock('components/apphost', () => ({ appHost: { supports: () => true } }));
vi.mock('hooks/useApi', () => ({ useApi: () => ({ user: state.currentUser }) }));
vi.mock('hooks/api/useUser', () => ({
    useUser: () => ({ data: state.user, isError: state.error, isPending: state.pending, refetch: state.retry })
}));
vi.mock('components/UserAvatar', () => ({
    default: ({ user }: { readonly user: UserDto }) => <img alt={user.Name || ''} src={user.PrimaryImageTag || 'default-avatar'} />
}));
vi.mock('../../features/home/CinemaPage', () => ({
    default: ({ children }: PropsWithChildren) => <main>{children}</main>
}));

let container: HTMLDivElement;
let root: Root;
let queryClient: QueryClient;

const element = <T extends Element>(selector: string) => {
    const found = container.querySelector<T>(selector);
    if (!found) throw new Error(`Missing ${selector}`);
    return found;
};

const flush = () => new Promise(resolve => setTimeout(resolve, 10));

async function render(path = '/userprofile') {
    await act(async () => {
        root.render(
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={[path]}>
                    <UserProfile />
                </MemoryRouter>
            </QueryClientProvider>
        );
        await flush();
    });
}

async function choose(file: File) {
    await act(async () => {
        const input = element<HTMLInputElement>('input[type=file]');
        Object.defineProperty(input, 'files', { configurable: true, value: [file] });
        input.dispatchEvent(new Event('change', { bubbles: true }));
        await flush();
    });
}

async function click(text: string, within: Element = container) {
    const button = Array.from(within.querySelectorAll('button')).find(item => item.textContent === text);
    if (!button) throw new Error(`Missing button ${text}`);
    await act(async () => {
        button.click();
        await flush();
    });
}

beforeEach(() => {
    const providerId = 'default';
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.user = {
        Id: 'signed-in-user',
        Name: 'Kempny',
        HasConfiguredPassword: true,
        Policy: {
            AuthenticationProviderId: providerId,
            PasswordResetProviderId: providerId,
            EnableUserPreferenceAccess: true
        }
    };
    state.currentUser = state.user;
    state.error = false;
    state.pending = false;
    state.upload.mockReset().mockResolvedValue(undefined);
    state.remove.mockReset().mockResolvedValue(undefined);
    state.password.mockReset().mockResolvedValue(undefined);
    state.resetPassword.mockReset().mockResolvedValue(undefined);
    state.retry.mockReset();
    Object.defineProperty(window, 'ApiClient', {
        configurable: true,
        value: {
            uploadUserImage: state.upload,
            deleteUserImage: state.remove,
            updateUserPassword: state.password,
            resetUserPassword: state.resetPassword
        }
    });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    queryClient.clear();
    vi.unstubAllGlobals();
});

describe('cinema profile', () => {
    it('uploads without a userId query parameter and invalidates avatar queries', async () => {
        const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
        await render();
        const file = new File(['image'], 'avatar.png', { type: 'image/png' });
        await choose(file);
        expect(state.upload).toHaveBeenCalledWith('signed-in-user', 'Primary', file);
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ['User', 'signed-in-user'] });
        expect(container.textContent).toContain('CinemaProfileImageSaved');
        expect(element<HTMLInputElement>('input[type=file]').value).toBe('');
    });

    it('allows replacing an existing image and confirms deletion', async () => {
        state.user.PrimaryImageTag = 'old';
        await render();
        expect(container.textContent).toContain('CinemaProfileReplaceImage');
        await click('DeleteImage');
        expect(state.remove).not.toHaveBeenCalled();
        await click('DeleteImage', element('.cinemaProfileConfirmation'));
        expect(state.remove).toHaveBeenCalledWith('signed-in-user', 'Primary');
        expect(container.textContent).toContain('CinemaProfileImageDeleted');
    });

    it('cancels deletion and reports a failed deletion without losing the saved image', async () => {
        state.user.PrimaryImageTag = 'old';
        state.remove.mockRejectedValueOnce(new Error('network'));
        await render();
        await click('DeleteImage');
        await click('ButtonCancel');
        expect(state.remove).not.toHaveBeenCalled();
        await click('DeleteImage');
        await click('DeleteImage', element('.cinemaProfileConfirmation'));
        expect(element('[role=alert]').textContent).toBe('ErrorDefault');
        expect(element('img').getAttribute('src')).toBe('old');
    });

    it('reports upload failures without changing the saved avatar and permits retry', async () => {
        state.user.PrimaryImageTag = 'old';
        state.upload.mockRejectedValueOnce(new Error('network'));
        await render();
        const file = new File(['image'], 'avatar.png', { type: 'image/png' });
        await choose(file);
        expect(element('[role=alert]').textContent).toBe('ErrorDefault');
        expect(element('img').getAttribute('src')).toBe('old');
        await choose(file);
        expect(state.upload).toHaveBeenCalledTimes(2);
        expect(container.textContent).toContain('CinemaProfileImageSaved');
    });

    it('shows pending state and disables duplicate actions', async () => {
        let resolveUpload: (() => void) | undefined;
        state.upload.mockReturnValue(new Promise<void>(resolve => {
            resolveUpload = resolve;
        }));
        await render();
        await choose(new File(['image'], 'avatar.png', { type: 'image/png' }));
        expect(container.textContent).toContain('CinemaProfileSaving');
        expect(element<HTMLInputElement>('input[type=file]').disabled).toBe(true);
        await act(async () => {
            resolveUpload?.();
            await flush();
        });
        expect(container.textContent).toContain('CinemaProfileImageSaved');
    });

    it('rejects unsupported files', async () => {
        await render();
        await choose(new File(['text'], 'file.txt', { type: 'text/plain' }));
        expect(state.upload).not.toHaveBeenCalled();
        expect(element('[role=alert]').textContent).toBe('CinemaProfileInvalidImage');
    });

    it('honors preference permissions', async () => {
        state.user.Policy = { ...state.user.Policy!, EnableUserPreferenceAccess: false };
        await render();
        expect(container.textContent).toContain('CinemaProfileReadOnly');
        expect(container.querySelector('form')).toBeNull();
        expect(element<HTMLInputElement>('input[type=file]').disabled).toBe(true);
    });

    it('allows administrators to manage another user', async () => {
        state.currentUser = { Id: 'admin', Policy: { ...state.user.Policy!, IsAdministrator: true } };
        state.user.Policy = { ...state.user.Policy!, EnableUserPreferenceAccess: false };
        await render('/userprofile?userId=signed-in-user');
        await choose(new File(['image'], 'avatar.png', { type: 'image/png' }));
        expect(state.upload).toHaveBeenCalledWith('signed-in-user', 'Primary', expect.any(File));
    });

    it('does not let a non-administrator edit another user', async () => {
        state.currentUser = { ...state.user, Id: 'other-user' };
        await render('/userprofile?userId=signed-in-user');
        expect(container.textContent).toContain('CinemaProfileReadOnly');
        expect(container.querySelector('form')).toBeNull();
    });

    it('shows loading and recoverable loading errors', async () => {
        state.pending = true;
        await render();
        expect(container.textContent).toContain('MessagePleaseWait');
        state.pending = false;
        state.error = true;
        await render();
        expect(element('[role=alert]').textContent).toBe('ErrorDefault');
        await click('Retry');
        expect(state.retry).toHaveBeenCalled();
    });

    it('validates and saves the password with explicit feedback', async () => {
        const oldValue = 'test-old';
        const newValue = 'test-new';
        const otherValue = 'test-other';
        await render();
        element<HTMLInputElement>('[name=currentPassword]').value = oldValue;
        element<HTMLInputElement>('[name=newPassword]').value = newValue;
        element<HTMLInputElement>('[name=confirmPassword]').value = otherValue;
        await click('SavePassword');
        expect(state.password).not.toHaveBeenCalled();
        expect(element('[role=alert]').textContent).toBe('PasswordMatchError');
        element<HTMLInputElement>('[name=confirmPassword]').value = newValue;
        await click('SavePassword');
        expect(state.password).toHaveBeenCalledWith('signed-in-user', oldValue, newValue);
        expect(container.textContent).toContain('PasswordSaved');
        expect(element<HTMLInputElement>('[name=newPassword]').value).toBe('');
    });

    it('never offers password reset or blank passwords for administrators', async () => {
        state.user.Policy = { ...state.user.Policy!, IsAdministrator: true };
        await render();
        expect(container.textContent).not.toContain('ResetPassword');
        await click('SavePassword');
        expect(state.password).not.toHaveBeenCalled();
        expect(element('[role=alert]').textContent).toBe('PasswordMissingSaveError');
    });

    it('confirms password reset and exposes request failures', async () => {
        state.resetPassword.mockRejectedValueOnce(new Error('network'));
        await render();
        await click('ResetPassword');
        expect(state.resetPassword).not.toHaveBeenCalled();
        await click('ResetPassword', element('.cinemaProfileConfirmation'));
        expect(element('[role=alert]').textContent).toBe('MessageInvalidUser');
        await click('ResetPassword', element('.cinemaProfileConfirmation'));
        expect(state.resetPassword).toHaveBeenCalledWith('signed-in-user');
        expect(container.textContent).toContain('PasswordResetComplete');
    });
});
