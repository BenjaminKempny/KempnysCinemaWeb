import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadProfileImage } from './api';

const upload = vi.fn();

beforeEach(() => {
    upload.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(window, 'ApiClient', {
        configurable: true,
        value: { uploadUserImage: upload }
    });
});

describe('uploadProfileImage', () => {
    it('passes the resolved user id and original file to the base64 upload client', async () => {
        const file = new File(['image'], 'avatar.png', { type: 'image/png' });
        await uploadProfileImage('current-user', file);
        expect(upload).toHaveBeenCalledWith('current-user', 'Primary', file);
    });

    it.each([
        new File(['text'], 'avatar.txt', { type: 'text/plain' }),
        new File([], 'empty.png', { type: 'image/png' })
    ])('rejects invalid or empty files before contacting the server', async file => {
        await expect(uploadProfileImage('current-user', file)).rejects.toThrow('CinemaProfileInvalidImage');
        expect(upload).not.toHaveBeenCalled();
    });

    it('rejects a missing user id', async () => {
        await expect(uploadProfileImage('', new File(['image'], 'avatar.png', { type: 'image/png' }))).rejects.toThrow();
        expect(upload).not.toHaveBeenCalled();
    });

    it('propagates failed requests for visible feedback', async () => {
        upload.mockRejectedValue(new Error('Forbidden'));
        await expect(uploadProfileImage('current-user', new File(['image'], 'avatar.png', { type: 'image/png' }))).rejects.toThrow('Forbidden');
    });
});
