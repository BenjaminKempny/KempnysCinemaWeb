import React, { type ChangeEvent, useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { appHost } from 'components/apphost';
import UserAvatar from 'components/UserAvatar';
import { useUser } from 'hooks/api/useUser';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import CinemaPage from '../../features/home/CinemaPage';
import { useProfileImageMutations } from './profile/api';
import ProfilePassword from './profile/ProfilePassword';

import './profile/profile.scss';

const ProfileContent = () => {
    const [searchParams] = useSearchParams();
    const { user: currentUser } = useApi();
    const { data: user, isPending, isError, refetch } = useUser({
        userId: searchParams.get('userId') || undefined
    });
    const inputRef = useRef<HTMLInputElement>(null);
    const [invalidImage, setInvalidImage] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const { upload, remove } = useProfileImageMutations(user?.Id || '');
    const busy = upload.isPending || remove.isPending;
    const canEdit = !!user?.Id && !!(currentUser?.Policy?.IsAdministrator
        || (currentUser?.Id === user.Id && user.Policy?.EnableUserPreferenceAccess));
    const canUpload = canEdit && appHost.supports('fileinput');

    const onChoose = useCallback(() => inputRef.current?.click(), []);
    const onFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (!file || !canUpload || busy) return;
        upload.reset();
        remove.reset();
        setConfirmDelete(false);
        const invalid = !file.type.startsWith('image/') || !file.size;
        setInvalidImage(invalid);
        if (!invalid) upload.mutate(file);
    }, [upload, remove, canUpload, busy]);
    const onRequestDelete = useCallback(() => setConfirmDelete(true), []);
    const onCancelDelete = useCallback(() => setConfirmDelete(false), []);
    const onDelete = useCallback(() => {
        if (!canEdit || busy) return;
        upload.reset();
        setInvalidImage(false);
        remove.mutate(undefined, { onSuccess: () => setConfirmDelete(false) });
    }, [upload, remove, canEdit, busy]);
    const onRetry = useCallback(() => {
        void refetch();
    }, [refetch]);

    if (isError) {
        return (
            <section className='cinemaProfilePanel'>
                <p role='alert'>{globalize.translate('ErrorDefault')}</p>
                <button className='cinemaProfileButton' type='button' onClick={onRetry}>
                    {globalize.translate('Retry')}
                </button>
            </section>
        );
    }

    if (isPending || !user) {
        return <p role='status'>{globalize.translate('MessagePleaseWait')}</p>;
    }

    return (
        <>
            <p className='cinemaProfileIntro'>{globalize.translate('CinemaProfileDescription')}</p>
            <div className='cinemaProfileGrid'>
                <section className='cinemaProfilePanel' aria-labelledby='profile-name'>
                    <div className='cinemaProfileIdentity'>
                        <div className='cinemaProfileAvatar'>
                            <UserAvatar user={user} size={112} />
                        </div>
                        <div>
                            <span className='cinemaProfileEyebrow'>{globalize.translate('Profile')}</span>
                            <h2 id='profile-name'>{user.Name}</h2>
                        </div>
                    </div>
                    {canUpload && (
                        <p className='cinemaProfileHint'>{globalize.translate('CinemaProfileImageHint')}</p>
                    )}
                    {!canEdit && <p>{globalize.translate('CinemaProfileReadOnly')}</p>}
                    <input
                        ref={inputRef}
                        type='file'
                        accept='image/*'
                        hidden
                        disabled={!canUpload || busy}
                        onChange={onFileChange}
                        aria-label={globalize.translate('ButtonAddImage')}
                    />
                    <div className='cinemaProfileActions' aria-busy={busy}>
                        {canUpload && (
                            <button className='cinemaProfileButton cinemaProfileButtonPrimary' type='button' onClick={onChoose} disabled={busy}>
                                {globalize.translate(user.PrimaryImageTag ? 'CinemaProfileReplaceImage' : 'ButtonAddImage')}
                            </button>
                        )}
                        {canEdit && user.PrimaryImageTag && (
                            <button className='cinemaProfileButton' type='button' onClick={onRequestDelete} disabled={busy}>
                                {globalize.translate('DeleteImage')}
                            </button>
                        )}
                    </div>
                    {confirmDelete && (
                        <div className='cinemaProfileConfirmation'>
                            <p>{globalize.translate('DeleteImageConfirmation')}</p>
                            <div className='cinemaProfileActions'>
                                <button className='cinemaProfileButton' type='button' onClick={onDelete} disabled={busy}>
                                    {globalize.translate('DeleteImage')}
                                </button>
                                <button className='cinemaProfileButton' type='button' onClick={onCancelDelete} disabled={busy}>
                                    {globalize.translate('ButtonCancel')}
                                </button>
                            </div>
                        </div>
                    )}
                    {busy && <p role='status'>{globalize.translate('CinemaProfileSaving')}</p>}
                    {(invalidImage || upload.isError || remove.isError) && (
                        <p className='cinemaProfileError' role='alert'>
                            {globalize.translate(invalidImage ? 'CinemaProfileInvalidImage' : 'ErrorDefault')}
                        </p>
                    )}
                    {(upload.isSuccess || remove.isSuccess) && (
                        <p role='status'>
                            {globalize.translate(upload.isSuccess ? 'CinemaProfileImageSaved' : 'CinemaProfileImageDeleted')}
                        </p>
                    )}
                </section>
                {canEdit && <ProfilePassword key={user.Id} user={user} />}
            </div>
        </>
    );
};

const UserProfile = () => {
    const { api, user } = useApi();
    const [params] = useSearchParams();
    const userId = params.get('userId') || user?.Id;

    return <CinemaPage title={globalize.translate('Profile')} active='profile'>
        <div className='cinemaProfile'>
            <ProfileContent key={`${api?.basePath}:${userId}`} />
        </div>
    </CinemaPage>;
};

export default UserProfile;
