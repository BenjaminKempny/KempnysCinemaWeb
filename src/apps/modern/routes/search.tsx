import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import CloseRounded from '@mui/icons-material/CloseRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import React, { type ChangeEvent, type FormEvent, type RefObject, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDebounceValue } from 'usehooks-ts';

import { appRouter } from 'components/router/appRouter';
import { useApi } from 'hooks/useApi';
import useSearchParam from 'hooks/useSearchParam';
import globalize from 'lib/globalize';

import CinemaPage from '../features/home/CinemaPage';
import InfiniteScroll from '../features/home/InfiniteScroll';
import MediaCard, { RequestState } from '../features/home/MediaCard';
import { getCinemaSearchQuery, getCinemaSuggestionsQuery, readSearchScope, SEARCH_FILTERS, searchHintToItem } from '../features/search/api';

import '../features/search/search.scss';

function SearchCards({ items, itemsRef }: Readonly<{ items: BaseItemDto[]; itemsRef?: RefObject<HTMLDivElement> }>) {
    const { __legacyApiClient__: client } = useApi();
    return <div ref={itemsRef} className='cinemaGrid'>
        {items.map(item => <MediaCard key={item.Id} item={item}
            to={appRouter.getRouteUrl(item, { serverId: client?.serverId() }).replace(/^#/, '')} />)}
    </div>;
}

function Suggestions() {
    const { api, user } = useApi();
    const [params] = useSearchParams();
    const query = useQuery(getCinemaSuggestionsQuery(api, user?.Id, readSearchScope(params)));
    const retry = useCallback(() => {
        void query.refetch();
    }, [query]);

    return <section className='cinemaSection'>
        <header className='cinemaSectionHeader'><h2>{globalize.translate('Suggestions')}</h2></header>
        <RequestState pending={query.isPending} error={query.isError} retry={retry} empty={query.isSuccess && !query.data.length} />
        {query.data && <SearchCards items={query.data} />}
    </section>;
}

function Results({ term }: Readonly<{ term: string }>) {
    const itemsRef = useRef<HTMLDivElement>(null);
    const { api, user } = useApi();
    const [params] = useSearchParams();
    const scope = readSearchScope(params);
    const query = useInfiniteQuery(getCinemaSearchQuery(api, user?.Id, term, scope));
    const retry = useCallback(() => {
        if (query.isFetchNextPageError) void query.fetchNextPage();
        else void query.refetch();
    }, [query]);
    const items = query.data?.pages.flatMap(page => page.SearchHints ?? []).map(searchHintToItem) ?? [];
    const seen = new Set<string>();
    const unique = items.filter(item => {
        if (!item.Id || seen.has(item.Id)) return false;
        seen.add(item.Id);
        return true;
    });

    return <section className='cinemaSearchResults' aria-label={globalize.translate('Search')} aria-busy={query.isFetching}>
        <RequestState pending={query.isPending} error={query.isError && !items.length} retry={retry} />
        {query.isSuccess && !items.length && <div className='cinemaEmpty' role='status'>
            <SearchRounded aria-hidden='true' />
            <h2>{globalize.translate('SearchResultsEmpty', term)}</h2>
        </div>}
        <SearchCards items={unique} itemsRef={itemsRef} />
        {items.length > 0 && <RequestState pending={query.isFetchingNextPage} error={query.isError} retry={retry} />}
        <InfiniteScroll query={query} queryKey={JSON.stringify([api?.basePath, user?.Id, term, scope])} itemsRef={itemsRef} />
    </section>;
}

export default function Search() {
    const [params] = useSearchParams();
    const [query, setQuery] = useSearchParam('query');
    const [term] = useDebounceValue(query.trim(), 350);
    const scope = readSearchScope(params);
    const input = useRef<HTMLInputElement>(null);
    const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => setQuery(event.currentTarget.value), [setQuery]);
    const onSubmit = useCallback((event: FormEvent) => event.preventDefault(), []);
    const clear = useCallback(() => {
        setQuery('');
        input.current?.focus();
    }, [setQuery]);
    const globalParams = new URLSearchParams(params);
    globalParams.delete('parentId');
    globalParams.delete('collectionType');
    const waiting = query.trim() !== term;

    return <CinemaPage title={globalize.translate('Search')} active='search'>
        <div className='cinemaSearch'>
            <section className='cinemaSearchIntro'>
                <p className='cinemaEyebrow'>Kempny&apos;s Cinema</p>
                <h2>{globalize.translate('CinemaSearchTitle')}</h2>
                <p>{globalize.translate('CinemaSearchHelp')}</p>
                <form className='cinemaSearchForm' role='search' onSubmit={onSubmit}>
                    <SearchRounded aria-hidden='true' />
                    <input ref={input} type='search' value={query} onChange={onChange}
                        aria-label={globalize.translate('Search')} placeholder={globalize.translate('CinemaSearchPlaceholder')}
                        autoComplete='off' />
                    {query && <button type='button' className='cinemaIconButton' onClick={clear}
                        aria-label={globalize.translate('CinemaClearSearch')} title={globalize.translate('CinemaClearSearch')}>
                        <CloseRounded />
                    </button>}
                </form>
                {(scope.parentId || scope.collectionType) && <Link className='cinemaButton' to={`/search?${globalParams}`}>
                    {globalize.translate('RetryWithGlobalSearch')}
                </Link>}
            </section>
            {!!query.trim() && <nav className='cinemaSearchFilters' aria-label={globalize.translate('CinemaBrowse')}>
                {SEARCH_FILTERS.map(filter => {
                    const next = new URLSearchParams(params);
                    if (filter.type) next.set('type', filter.type);
                    else next.delete('type');
                    return <Link key={filter.label} to={`/search?${next}`} replace className='cinemaButton'
                        aria-current={scope.type === filter.type ? 'page' : undefined}>{globalize.translate(filter.label)}</Link>;
                })}
            </nav>}
            {!query.trim() && <Suggestions />}
            {!!query.trim() && waiting && <RequestState pending />}
            {!!query.trim() && !waiting && <Results term={term} />}
        </div>
    </CinemaPage>;
}
