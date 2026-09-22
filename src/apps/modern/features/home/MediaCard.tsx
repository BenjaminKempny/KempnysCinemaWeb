import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import Add from '@mui/icons-material/Add';
import MovieOutlined from '@mui/icons-material/MovieOutlined';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import Remove from '@mui/icons-material/Remove';
import { useMutation } from '@tanstack/react-query';
import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';

import { playbackManager } from 'components/playback/playbackmanager';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';

export function useArtwork(item: BaseItemDto, wide = false, width = 500) {
    const { __legacyApiClient__: client } = useApi();
    let id = item.Id;
    let type = 'Primary';
    let tag = item.ImageTags?.Primary;
    if (wide && item.BackdropImageTags?.[0]) {
        type = 'Backdrop';
        tag = item.BackdropImageTags[0];
    } else if (wide && item.ImageTags?.Thumb) {
        type = 'Thumb';
        tag = item.ImageTags.Thumb;
    } else if (wide && item.ParentBackdropItemId && item.ParentBackdropImageTags?.[0]) {
        id = item.ParentBackdropItemId;
        type = 'Backdrop';
        tag = item.ParentBackdropImageTags[0];
    } else if (!tag && item.SeriesId && item.SeriesPrimaryImageTag) {
        id = item.SeriesId;
        tag = item.SeriesPrimaryImageTag;
    }
    return id && tag ? client?.getImageUrl(id, { type, tag, maxWidth: width, quality: 90 }) : undefined;
}

export function Artwork({ item, wide, className, eager = false }: Readonly<{
    item: BaseItemDto;
    wide?: boolean;
    className?: string;
    eager?: boolean;
}>) {
    const source = useArtwork(item, wide, eager ? 1600 : 500);
    const [ failedSource, setFailedSource ] = useState<string>();
    const onImageError = useCallback(() => setFailedSource(source), [source]);
    if (!source || failedSource === source) {
        return <span className={`${className || ''} cinemaCard-placeholder`}><MovieOutlined aria-hidden='true' /></span>;
    }
    return <img className={className} src={source} alt='' loading={eager ? 'eager' : 'lazy'} onError={onImageError} />;
}

export function useCinemaPlayback(item: BaseItemDto) {
    const { __legacyApiClient__: client } = useApi();
    return useMutation({
        mutationFn: async () => {
            const serverId = item.ServerId || client?.serverId();
            if (!item.Id || !serverId) {
                throw new Error('Missing media or server identifier');
            }
            await playbackManager.play({
                items: [{ ...item, ServerId: serverId }],
                startPositionTicks: item.UserData?.PlaybackPositionTicks || 0
            });
        }
    });
}

export function useDetailsUrl(item: BaseItemDto) {
    const { __legacyApiClient__: client } = useApi();
    return `/details?${new URLSearchParams({
        id: item.Id || '',
        serverId: item.ServerId || client?.serverId() || ''
    }).toString()}`;
}

export function RequestState({ pending, error, retry, empty }: Readonly<{
    pending?: boolean;
    error?: boolean;
    retry?: () => void;
    empty?: boolean;
}>) {
    if (error) {
        return (
            <div className='cinemaStatus' role='alert'>
                <p>{globalize.translate('CinemaLoadError')}</p>
                {retry && <button type='button' className='cinemaButton' onClick={retry}>{globalize.translate('Retry')}</button>}
            </div>
        );
    }
    if (pending) {
        return <div className='cinemaStatus cinemaSkeleton' role='status' aria-label={globalize.translate('CinemaLoading')} />;
    }
    if (empty) {
        return <div className='cinemaStatus'><p>{globalize.translate('MessageNothingHere')}</p></div>;
    }
    return null;
}

export default function MediaCard({ item, wide = false, onAdd, onRemove, to }: Readonly<{
    item: BaseItemDto;
    wide?: boolean;
    onAdd?: (item: BaseItemDto) => void;
    onRemove?: (item: BaseItemDto) => void;
    to?: string;
}>) {
    const detailsUrl = useDetailsUrl(item);
    const playback = useCinemaPlayback(item);
    const { mutate } = playback;
    const onPlay = useCallback(() => mutate(), [mutate]);
    const onMenu = useCallback(() => (onRemove || onAdd)?.(item), [item, onAdd, onRemove]);
    const title = item.Type === BaseItemKind.Episode ? item.SeriesName || item.Name : item.Name;
    const progress = Math.min(100, Math.max(0, item.UserData?.PlayedPercentage || 0));
    const isEpisode = item.Type === BaseItemKind.Episode;
    const subtitle = isEpisode ?
        `S${item.ParentIndexNumber ?? '?'} E${item.IndexNumber ?? '?'} / ${item.Name || ''}` :
        item.ProductionYear?.toString();

    return (
        <article className={`cinemaCard${wide ? ' cinemaCard-wide' : ''}`}>
            <Link to={to || detailsUrl} className='cinemaCardLink'>
                <Artwork item={item} wide={wide} className='cinemaCardImage' />
                <div className='cinemaCardBody'>
                    <h3>{title}</h3>
                    {subtitle && <p>{subtitle}</p>}
                    {wide && isEpisode && !item.UserData?.PlaybackPositionTicks && <span className='cinemaEyebrow'>{globalize.translate('NextUp')}</span>}
                </div>
            </Link>
            {wide && item.Type !== BaseItemKind.BoxSet && (
                <button className='cinemaIconButton cinemaCardPlay' disabled={playback.isPending || !item.Id} onClick={onPlay}
                    data-focus-key={`play:${item.Id}`}
                    aria-label={globalize.translate(item.UserData?.PlaybackPositionTicks ? 'ButtonResume' : 'Play') + ': ' + title}>
                    <PlayArrowRounded />
                </button>
            )}
            {(onAdd || onRemove) && (
                <button className='cinemaIconButton cinemaCardMenu' onClick={onMenu}
                    data-focus-key={`collection:${item.Id}`}
                    aria-label={globalize.translate(onRemove ? 'CinemaRemoveFromCollection' : 'AddToCollection') + ': ' + title}>
                    {onRemove ? <Remove /> : <Add />}
                </button>
            )}
            {wide && progress > 0 && <progress className='cinemaProgress' value={progress} max={100} aria-label={globalize.translate('HeaderContinueWatching')} />}
            {playback.isError && <p role='alert' className='cinemaStatus'>{globalize.translate('CinemaPlaybackError')}</p>}
        </article>
    );
}
