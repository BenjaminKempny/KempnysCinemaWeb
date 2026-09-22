import { describe, expect, it } from 'vitest';
import { cinemaUrl, readCinemaLocation } from './navigation';

describe('cinema navigation', () => {
    it('defaults unknown parameters to movies and all', () => {
        expect(readCinemaLocation(new URLSearchParams('media=bad&view=bad&collection=hidden'))).toEqual({
            media: 'movies', view: 'all', collectionId: null, genreId: null, title: ''
        });
    });

    it('keeps a collection and its encoded title in the selected media context', () => {
        const url = cinemaUrl('series', 'collections', { collection: '123', title: 'Sci-Fi & Fantasy' });
        expect(readCinemaLocation(new URLSearchParams(url.split('?')[1]))).toEqual({
            media: 'series', view: 'collections', collectionId: '123', genreId: null, title: 'Sci-Fi & Fantasy'
        });
    });

    it('does not carry detail filters into a different tab', () => {
        expect(cinemaUrl('movies', 'all', { genre: 'abc', collection: '123' })).toBe('/home?media=movies&view=all');
    });
});
