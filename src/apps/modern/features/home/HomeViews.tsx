import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import globalize from 'lib/globalize';

import {
    type CinemaScope,
    useCinemaCollectionMutations,
    useCinemaCollections,
    useCinemaContinue,
    useCinemaGenres,
    useCinemaHero,
    useCinemaItems
} from './api';
import type { CollectionEditorOptions } from './CollectionManager';
import Dialog from './CinemaDialog';
import InfiniteScroll from './InfiniteScroll';
import MediaCard, { Artwork, RequestState, useArtwork, useCinemaPlayback, useDetailsUrl } from './MediaCard';
import { cinemaUrl } from './navigation';
import { useCollectionOperationsDisabled } from './settings';

type ManageCollection = (options: CollectionEditorOptions) => void;

function HeroContent({ item, previous, next }: Readonly<{ item: BaseItemDto; previous?: () => void; next?: () => void }>) {
    const play = useCinemaPlayback(item);
    const { mutate } = play;
    const onPlay = useCallback(() => mutate(), [mutate]);
    const to = useDetailsUrl(item);
    const artwork = useArtwork(item, true, 1600);
    return (
        <>
            {artwork && <img className='cinemaAmbient' src={artwork} alt='' />}
            <section className='cinemaHero' data-focus-region='spotlight' aria-label={globalize.translate('CinemaSpotlight')}>
                <Artwork item={item} wide eager className='cinemaHeroImage' />
                <div className='cinemaHeroContent'>
                    <p className='cinemaEyebrow'>{globalize.translate('CinemaSpotlight')}</p>
                    <div className='cinemaHeroMeta'>
                        {item.Genres?.slice(0, 3).map(genre => <span key={genre} className='cinemaTag'>{genre}</span>)}
                        {item.ProductionYear && <span>{item.ProductionYear}</span>}
                        {item.OfficialRating && <span>{item.OfficialRating}</span>}
                    </div>
                    <h2>{item.Name}</h2>
                    <p className='cinemaHeroOverview'>{item.Overview}</p>
                    <div className='cinemaHeroActions'>
                        <button className='cinemaButton cinemaButton-primary' disabled={play.isPending || !item.Id} onClick={onPlay}>
                            <PlayArrowRounded />{globalize.translate(item.UserData?.PlaybackPositionTicks ? 'ButtonResume' : 'Play')}
                        </button>
                        <Link to={to} className='cinemaButton'><InfoOutlined />{globalize.translate('CinemaDetails')}</Link>
                    </div>
                    {play.isError && <p role='alert'>{globalize.translate('CinemaPlaybackError')}</p>}
                </div>
                {next && <div className='cinemaHeroArrows'>
                    <button className='cinemaIconButton' onClick={previous} aria-label={globalize.translate('CinemaPreviousTitle')}><ArrowBackRounded /></button>
                    <button className='cinemaIconButton' onClick={next} aria-label={globalize.translate('CinemaNextTitle')}><ArrowForwardRounded /></button>
                </div>}
            </section>
        </>
    );
}

export function Spotlight({ scope }: Readonly<{ scope: CinemaScope }>) {
    const query = useCinemaHero(scope);
    const { refetch } = query;
    const retry = useCallback(() => {
        void refetch();
    }, [refetch]);
    const [ index, setIndex ] = useState(0);
    const items = query.data || [];
    const item = items[index % items.length];
    const count = items.length;
    const previous = useCallback(() => setIndex(value => (value + count - 1) % count), [count]);
    const next = useCallback(() => setIndex(value => (value + 1) % count), [count]);
    if (!item) {
        return <RequestState pending={query.isLoading} error={query.isError} retry={retry} />;
    }
    return <HeroContent item={item}
        previous={count > 1 ? previous : undefined}
        next={count > 1 ? next : undefined} />;
}

export function ContinueWatching({ scope }: Readonly<{ scope: CinemaScope }>) {
    const query = useCinemaContinue(scope);
    const { refetch } = query;
    const retry = useCallback(() => {
        void refetch();
    }, [refetch]);
    if (!query.isLoading && !query.isError && !query.data?.length) {
        return null;
    }
    return (
        <section className='cinemaSection' data-focus-region='continue' aria-labelledby='cinemaContinueTitle'>
            <div className='cinemaSectionHeader'><h2 id='cinemaContinueTitle'>{globalize.translate('HeaderContinueWatching')}</h2></div>
            <RequestState pending={query.isLoading} error={query.isError} retry={retry} />
            <div className='cinemaRow focuscontainer-right'>
                {query.data?.map(item => <MediaCard key={item.Id} item={item} wide playOnSelect />)}
            </div>
        </section>
    );
}

export function Catalog({ scope, genreId, collectionId, title, onManage, onRemove }: Readonly<{
    scope: CinemaScope;
    genreId?: string;
    collectionId?: string;
    title: string;
    onManage?: ManageCollection;
    onRemove?: (item: BaseItemDto) => void;
}>) {
    const itemsRef = useRef<HTMLDivElement>(null);
    const [ sort, setSort ] = useState('name');
    const sortBy = { name: ItemSortBy.SortName, added: ItemSortBy.DateCreated, year: ItemSortBy.PremiereDate }[sort] || ItemSortBy.SortName;
    const query = useCinemaItems(scope, {
        parentId: collectionId || scope.libraryId,
        genreIds: genreId ? [genreId] : undefined,
        sortBy: sort === 'name' ? [ItemSortBy.SortName] : [sortBy, ItemSortBy.SortName],
        sortOrder: [sort === 'name' ? SortOrder.Ascending : SortOrder.Descending]
    });
    const items = query.data?.pages.flatMap(page => page.Items || []) || [];
    const { refetch, fetchNextPage, isFetchNextPageError } = query;
    const retry = useCallback(() => {
        void (isFetchNextPageError ? fetchNextPage() : refetch());
    }, [fetchNextPage, isFetchNextPageError, refetch]);
    const onSortChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => setSort(event.target.value), []);
    const onAdd = useCallback((item: BaseItemDto) => onManage?.({ item }), [onManage]);
    return (
        <section className='cinemaCatalog' data-focus-region='catalog'>
            <div className='cinemaToolbar'>
                <h2>{title}</h2>
                <label className='cinemaSort'>{globalize.translate('LabelSortBy')}
                    <select className='cinemaSelect' value={sort} onChange={onSortChange}>
                        <option value='name'>{globalize.translate('Name')}</option>
                        <option value='added'>{globalize.translate('OptionDateAdded')}</option>
                        <option value='year'>{globalize.translate('OptionReleaseDate')}</option>
                    </select>
                </label>
            </div>
            <RequestState pending={query.isLoading} error={query.isError} retry={retry}
                empty={query.isSuccess && !items.length && !query.hasNextPage} />
            <div ref={itemsRef} className='cinemaGrid'>
                {items.map(item => <MediaCard key={item.Id} item={item}
                    onAdd={onManage ? onAdd : undefined} onRemove={onRemove} />)}
            </div>
            <InfiniteScroll query={query} queryKey={JSON.stringify([scope, genreId, collectionId, sort])} itemsRef={itemsRef} />
        </section>
    );
}

function GenreRow({ scope, genre, onManage }: Readonly<{ scope: CinemaScope; genre: BaseItemDto; onManage?: ManageCollection }>) {
    const element = useRef<HTMLElement>(null);
    const [ visible, setVisible ] = useState(false);
    const query = useCinemaItems(scope, { genreIds: genre.Id ? [genre.Id] : undefined, limit: 16 }, visible && !!genre.Id);
    const { refetch } = query;
    const retry = useCallback(() => {
        void refetch();
    }, [refetch]);
    const onAdd = useCallback((item: BaseItemDto) => onManage?.({ item }), [onManage]);

    useEffect(() => {
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) {
                setVisible(true);
                observer.disconnect();
            }
        }, { rootMargin: '300px' });
        if (element.current) {
            observer.observe(element.current);
        }
        return () => observer.disconnect();
    }, []);

    return (
        <section ref={element} className='cinemaGenre' data-focus-region={`genre:${genre.Id}`}>
            <div className='cinemaSectionHeader'>
                <h2>{genre.Name}</h2>
                <Link className='cinemaButton' to={cinemaUrl(scope.media, 'genres', { genre: genre.Id, title: genre.Name || '' })}>
                    {globalize.translate('All')}<ArrowForwardRounded />
                </Link>
            </div>
            <RequestState pending={query.isLoading} error={query.isError} retry={retry} />
            <div className='cinemaRow focuscontainer-right'>
                {query.data?.pages[0]?.Items?.map(item => <MediaCard key={item.Id} item={item}
                    onAdd={onManage ? onAdd : undefined} />)}
            </div>
        </section>
    );
}

export function Genres({ scope, onManage }: Readonly<{ scope: CinemaScope; onManage?: ManageCollection }>) {
    const query = useCinemaGenres(scope);
    const genres = query.data?.pages.flatMap(page => page.Items || []) || [];
    const { refetch, fetchNextPage, isFetchNextPageError } = query;
    const retry = useCallback(() => {
        void (isFetchNextPageError ? fetchNextPage() : refetch());
    }, [fetchNextPage, isFetchNextPageError, refetch]);
    return (
        <>
            <RequestState pending={query.isLoading} error={query.isError} retry={retry}
                empty={query.isSuccess && !genres.length && !query.hasNextPage} />
            {genres.map(genre => <GenreRow key={genre.Id} scope={scope} genre={genre} onManage={onManage} />)}
            <InfiniteScroll query={query} queryKey={JSON.stringify(scope)} />
        </>
    );
}

export function Collections({ scope, onManage }: Readonly<{ scope: CinemaScope; onManage?: ManageCollection }>) {
    const itemsRef = useRef<HTMLDivElement>(null);
    const query = useCinemaCollections(scope);
    const items = query.data?.pages.flatMap(page => page.Items || []) || [];
    const { refetch, fetchNextPage, isFetchNextPageError } = query;
    const retry = useCallback(() => {
        void (isFetchNextPageError ? fetchNextPage() : refetch());
    }, [fetchNextPage, isFetchNextPageError, refetch]);
    const onCreate = useCallback(() => onManage?.({}), [onManage]);
    return (
        <>
            <div className='cinemaToolbar'>
                <p>{globalize.translate('CinemaCollectionsIntro')}</p>
                {onManage && <button className='cinemaButton' onClick={onCreate}>{globalize.translate('NewCollection')}</button>}
            </div>
            <RequestState pending={query.isLoading} error={query.isError} retry={retry}
                empty={query.isSuccess && !items.length && !query.hasNextPage} />
            <div ref={itemsRef} className='cinemaGrid'>
                {items.map(item => <MediaCard key={item.Id} item={item}
                    to={cinemaUrl(scope.media, 'collections', { collection: item.Id, title: item.Name || '' })} />)}
            </div>
            <InfiniteScroll query={query} queryKey={JSON.stringify(scope)} itemsRef={itemsRef} />
        </>
    );
}

function CollectionHeader({ item, onManage }: Readonly<{ item: BaseItemDto; onManage?: ManageCollection }>) {
    const to = useDetailsUrl(item);
    const collectionsLocked = useCollectionOperationsDisabled();
    const onAdd = useCallback(() => onManage?.({ collectionId: item.Id }), [item.Id, onManage]);
    return (
        <div className='cinemaCollectionHero'>
            <Artwork item={item} />
            <div>
                <h1>{item.Name}</h1>
                <p>{item.Overview}</p>
                <div className='cinemaHeroActions'>
                    {onManage && <button className='cinemaButton cinemaButton-primary' onClick={onAdd}>
                        {globalize.translate('HeaderAddToCollection')}
                    </button>}
                    {!collectionsLocked && <Link className='cinemaButton' to={to}>{globalize.translate('CinemaDetails')}</Link>}
                </div>
            </div>
        </div>
    );
}

export function CollectionContents({ scope, id, onManage }: Readonly<{ scope: CinemaScope; id: string; onManage?: ManageCollection }>) {
    const query = useCinemaItems(scope, { parentId: undefined, ids: [id], includeItemTypes: [BaseItemKind.BoxSet], limit: 1 });
    const collection = query.data?.pages[0]?.Items?.[0];
    const [ removing, setRemoving ] = useState<BaseItemDto>();
    const { remove } = useCinemaCollectionMutations();
    const { refetch } = query;
    const { reset, mutate } = remove;
    const retry = useCallback(() => {
        void refetch();
    }, [refetch]);
    const onRemove = useCallback((item: BaseItemDto) => {
        reset();
        setRemoving(item);
    }, [reset]);
    const onClose = useCallback(() => setRemoving(undefined), []);
    const onConfirm = useCallback(() => {
        if (removing?.Id) {
            mutate({ collectionId: id, ids: [removing.Id] }, { onSuccess: onClose });
        }
    }, [id, mutate, onClose, removing?.Id]);

    return (
        <>
            <RequestState pending={query.isLoading} error={query.isError} retry={retry} empty={query.isSuccess && !collection} />
            {collection && (
                <>
                    <CollectionHeader item={collection} onManage={onManage} />
                    <Catalog scope={scope} collectionId={id} title={globalize.translate(scope.media === 'movies' ? 'Movies' : 'Shows')}
                        onRemove={onManage ? onRemove : undefined} />
                </>
            )}
            <Dialog open={!!removing} onClose={remove.isPending ? undefined : onClose} className='cinemaDialog'
                aria-labelledby='cinemaRemoveTitle' aria-describedby='cinemaRemoveHelp'>
                <DialogTitle id='cinemaRemoveTitle'>{globalize.translate('CinemaRemoveFromCollection')}</DialogTitle>
                <DialogContent>
                    <p>{removing?.Name}</p>
                    <p id='cinemaRemoveHelp'>{globalize.translate('CinemaRemoveHelp')}</p>
                    {remove.isError && <p role='alert'>{globalize.translate('CinemaSaveError')}</p>}
                </DialogContent>
                <DialogActions>
                    <button className='cinemaButton' disabled={remove.isPending} onClick={onClose}>{globalize.translate('ButtonCancel')}</button>
                    <button className='cinemaButton cinemaButton-primary' disabled={remove.isPending || !removing?.Id}
                        onClick={onConfirm}>{globalize.translate('ButtonRemove')}</button>
                </DialogActions>
            </Dialog>
        </>
    );
}
