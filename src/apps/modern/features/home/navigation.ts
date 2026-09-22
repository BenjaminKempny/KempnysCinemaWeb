export type CinemaMedia = 'movies' | 'series';
export type CinemaView = 'all' | 'collections' | 'genres';

export function readCinemaLocation(params: URLSearchParams) {
    const media: CinemaMedia = params.get('media') === 'series' ? 'series' : 'movies';
    const requestedView = params.get('view');
    const view: CinemaView = requestedView === 'collections' || requestedView === 'genres' ? requestedView : 'all';
    return {
        media,
        view,
        collectionId: view === 'collections' ? params.get('collection') : null,
        genreId: view === 'genres' ? params.get('genre') : null,
        title: params.get('title') || ''
    };
}

export function cinemaUrl(media: CinemaMedia, view: CinemaView, detail?: { collection?: string; genre?: string; title?: string }) {
    const params = new URLSearchParams({ media, view });
    if (detail?.collection && view === 'collections') params.set('collection', detail.collection);
    if (detail?.genre && view === 'genres') params.set('genre', detail.genre);
    if (detail?.title) params.set('title', detail.title);
    return `/home?${params.toString()}`;
}

/** Routes that render the cinema UI and therefore hide the legacy app bar. */
const CINEMA_PATHS = [
    '/home',
    '/details',
    '/search',
    '/userprofile',
    '/mypreferencesmenu',
    '/mypreferencesdisplay',
    '/mypreferenceshome'
];

export function isCinemaPath(pathname: string) {
    return CINEMA_PATHS.includes(pathname);
}
