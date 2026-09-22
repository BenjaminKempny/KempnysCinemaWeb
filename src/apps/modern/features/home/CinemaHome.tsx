import MovieOutlined from '@mui/icons-material/MovieOutlined';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import Page from 'components/Page';
import { clearBackdrop } from 'components/backdrop/backdrop';
import focusManager from 'components/focusManager';
import { playbackManager } from 'components/playback/playbackmanager';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import * as userSettings from 'scripts/settings/userSettings';
import Events from 'utils/events';

import CollectionManager, { type CollectionEditorOptions } from './CollectionManager';
import { Catalog, CollectionContents, Collections, ContinueWatching, Genres, Spotlight } from './HomeViews';
import { RequestState } from './MediaCard';
import { cinemaUrl, readCinemaLocation, type CinemaView } from './navigation';
import { cinemaLibrarySettingKey, getCinemaLibraries, getCinemaLibraryId, useCinemaLibraries } from './librarySource';
import CinemaSidebar from './CinemaSidebar';
import NavPill, { useNavPill } from './NavPill';
import { useCinemaAppearance, useCollectionOperationsDisabled } from './settings';
import useCinemaFocus from './useCinemaFocus';

import './cinema.scss';

const TABS: { view: CinemaView; label: string }[] = [
    { view: 'all', label: 'All' },
    { view: 'collections', label: 'Collections' },
    { view: 'genres', label: 'Genres' }
];

function CinemaContent() {
    const focusRoot = useCinemaFocus();
    const { user, __legacyApiClient__: client } = useApi();
    const [ params ] = useSearchParams();
    const { media, view, collectionId, genreId, title } = readCinemaLocation(params);
    const key = cinemaLibrarySettingKey(client?.serverId() || '', media);
    const [ savedId ] = useState<string | null>(() => userSettings.get(key, false));
    const [ editor, setEditor ] = useState<CollectionEditorOptions>();
    const appearance = useCinemaAppearance();
    const collectionsLocked = useCollectionOperationsDisabled();
    const views = useCinemaLibraries();
    const libraries = getCinemaLibraries(views.data?.Items || [], media);
    const libraryId = getCinemaLibraryId(libraries, savedId);
    const scope = { media, libraryId };
    const canManage = !collectionsLocked
        && !!(user?.Policy?.IsAdministrator || user?.Policy?.EnableCollectionManagement);
    const manage = canManage ? setEditor : undefined;
    const mediaTitle = globalize.translate(media === 'movies' ? 'Movies' : 'Shows');
    const isDetail = !!(collectionId || genreId);
    const contentKey = `${media}:${libraryId}:${view}:${collectionId || genreId || ''}`;
    const retryViews = useCallback(() => {
        void views.refetch();
    }, [views]);
    const closeEditor = useCallback(() => setEditor(undefined), []);
    const { containerRef: tabsRef, pillRef } = useNavPill<HTMLElement>(view);

    // Returning to the tab bar should reveal the top of the page instead of leaving
    // the previous section half visible right below it.
    const onHeaderFocus = useCallback(() => {
        focusRoot.current?.closest('.cinemaPage')?.scrollTo({ top: 0, behavior: 'smooth' });
    }, [focusRoot]);

    // Moving down from the tabs skips the randomised spotlight and lands on "Continue watching".
    const onTabsKeyDown = useCallback((event: React.KeyboardEvent) => {
        if (event.key !== 'ArrowDown' || event.defaultPrevented) return;
        const target = focusRoot.current?.querySelector<HTMLElement>('[data-focus-region="continue"] .cinemaCardLink');
        if (!target) return;
        event.preventDefault();
        focusManager.focus(target);
    }, [focusRoot]);

    return (
        <Page id='cinemaHomePage' className='cinemaPage focuscontainer' title={mediaTitle} isBackButtonEnabled={false}>
            <div ref={focusRoot} className='cinemaHome' data-directional-navigation data-appearance={appearance}
                data-theme={appearance === 'light' ? 'light' : undefined}
                data-scroll-mode-x='nearest' data-scroll-mode-y='nearest'>
                <CinemaSidebar media={media} view={view} />
                <div className='cinemaShell'>
                    <header className='cinemaHeader'>
                        <Link className='cinemaBrand' to={cinemaUrl(media, 'all')} onFocus={onHeaderFocus}
                            aria-label={globalize.translate('Home')}>
                            <img src='assets/img/appIcon.png' alt="Kempny's Cinema" />
                        </Link>
                        <nav ref={tabsRef} className='cinemaTabs focuscontainer-x' data-focus-region='tabs'
                            aria-label={globalize.translate('CinemaBrowse')}>
                            <NavPill pillRef={pillRef} />
                            {TABS.map(tab => <Link key={tab.view} to={cinemaUrl(media, tab.view)} onFocus={onHeaderFocus}
                                onKeyDown={onTabsKeyDown}
                                aria-current={view === tab.view ? 'page' : undefined}>{globalize.translate(tab.label)}</Link>)}
                        </nav>
                    </header>
                    <div className='cinemaContent'>
                        <div className='cinemaToolbar'>
                            {isDetail ? (
                                <Link className='cinemaButton' to={cinemaUrl(media, view)}><ArrowBackRounded />{globalize.translate('ButtonBack')}</Link>
                            ) : (
                                <h1 className='cinemaHeading'>{mediaTitle}</h1>
                            )}
                        </div>
                        <RequestState pending={views.isPending} error={views.isError} retry={retryViews} />
                        {!views.isPending && !views.isError && !libraryId && <div className='cinemaEmpty'>
                            <MovieOutlined aria-hidden='true' />
                            <h2>{globalize.translate(libraries.length ? 'CinemaChooseLibrary' : 'CinemaNoLibrary')}</h2>
                            <p>{globalize.translate(libraries.length ? 'CinemaConfigureLibraries' : 'CinemaNoLibraryHelp')}</p>
                            {libraries.length > 0 && <Link to='/mypreferenceshome' className='cinemaButton cinemaButton-primary'>
                                {globalize.translate('Settings')}
                            </Link>}
                        </div>}
                        {libraryId && <div key={contentKey} className='cinemaView'>
                            {view === 'all' && <>
                                <Spotlight scope={scope} />
                                <ContinueWatching scope={scope} />
                                <Catalog scope={scope} title={globalize.translate(media === 'movies' ? 'CinemaAllMovies' : 'CinemaAllSeries')} onManage={manage} />
                            </>}
                            {view === 'collections' && (collectionId ?
                                <CollectionContents scope={scope} id={collectionId} onManage={manage} /> :
                                <Collections scope={scope} onManage={manage} />
                            )}
                            {view === 'genres' && (genreId ?
                                <Catalog scope={scope} title={title || globalize.translate('Genres')} genreId={genreId} onManage={manage} /> :
                                <Genres scope={scope} onManage={manage} />
                            )}
                            {editor && <CollectionManager scope={scope} options={editor} onClose={closeEditor} />}
                        </div>}
                    </div>
                </div>
            </div>
        </Page>
    );
}

export default function CinemaHome() {
    const { api, user } = useApi();
    const [ params ] = useSearchParams();
    const { media } = readCinemaLocation(params);
    const queryClient = useQueryClient();

    useEffect(() => {
        clearBackdrop(true);
        const refresh = () => {
            void queryClient.invalidateQueries({ queryKey: ['CinemaHome', api?.basePath, user?.Id] });
        };
        Events.on(playbackManager, 'playbackstop', refresh);
        return () => Events.off(playbackManager, 'playbackstop', refresh);
    }, [api?.basePath, user?.Id, queryClient]);

    if (!api || !user?.Id) return <RequestState pending />;
    return <CinemaContent key={`${api.basePath}:${user.Id}:${media}`} />;
}
