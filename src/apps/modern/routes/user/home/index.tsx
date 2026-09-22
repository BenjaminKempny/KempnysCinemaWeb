import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMutation } from '@tanstack/react-query';
import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';

import {
    cinemaLibrarySettingKey,
    getCinemaLibraries,
    getCinemaLibraryId,
    useCinemaLibraries
} from 'apps/modern/features/home/librarySource';
import type { CinemaMedia } from 'apps/modern/features/home/navigation';
import Loading from 'components/loading/LoadingComponent';
import Page from 'components/Page';
import { useApi } from 'hooks/useApi';
import globalize from 'lib/globalize';
import * as userSettings from 'scripts/settings/userSettings';

function LibrarySource({ media, serverId, libraries }: Readonly<{
    media: CinemaMedia;
    serverId: string;
    libraries: BaseItemDto[];
}>) {
    const key = cinemaLibrarySettingKey(serverId, media);
    const [ savedId, setSavedId ] = useState<string | null>(() => userSettings.get(key, false));
    const libraryId = getCinemaLibraryId(libraries, savedId);
    const { mutate, isPending, isError, isSuccess } = useMutation({
        mutationFn: async (id: string) => {
            if (!libraries.some(library => library.Id === id)) throw new Error('Invalid cinema library');
            userSettings.set(key, id, false);
        },
        onSuccess: (_data, id) => setSavedId(id)
    });
    const changeSource = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        mutate(event.target.value);
    }, [mutate]);

    return (
        <Stack spacing={1}>
            <TextField select fullWidth label={globalize.translate(media === 'movies' ? 'Movies' : 'Shows')}
                name={media} slotProps={{ select: { native: true } }}
                value={libraryId} disabled={isPending || !libraries.length} onChange={changeSource}
                helperText={globalize.translate(libraries.length ? 'CinemaLibraryHelp' : 'CinemaNoLibraryHelp')}>
                <option value='' disabled>{globalize.translate('CinemaChooseLibrary')}</option>
                {libraries.map(library => <option key={library.Id} value={library.Id}>{library.Name}</option>)}
            </TextField>
            {isError && <Alert severity='error'>{globalize.translate('CinemaSourceSaveError')}</Alert>}
            {isSuccess && <Typography role='status' variant='body2'>{globalize.translate('SettingsSaved')}</Typography>}
        </Stack>
    );
}

export default function HomePreferences() {
    const { api, user, __legacyApiClient__: client } = useApi();
    const views = useCinemaLibraries();
    const retry = useCallback(() => {
        void views.refetch();
    }, [views]);
    const serverId = client?.serverId();
    const items = views.data?.Items || [];

    return (
        <Page id='cinemaHomePreferencesPage' className='mainAnimatedPage libraryPage userPreferencesPage noSecondaryNavPage'
            title={globalize.translate('Home')}>
            <div className='settingsContainer padded-left padded-right padded-bottom-page padded-top'>
                <Stack spacing={3} sx={{ maxWidth: '54em', margin: 'auto', padding: { xs: 2, md: 3 } }}>
                    <Typography variant='h1'>{globalize.translate('CinemaMainLibraries')}</Typography>
                    <Typography>{globalize.translate('CinemaLibraryPreferencesHelp')}</Typography>
                    {(views.isPending || !api || !user?.Id || !serverId) && <Loading />}
                    {views.isError && <Alert severity='error' action={<Button onClick={retry}>{globalize.translate('Retry')}</Button>}>
                        {globalize.translate('CinemaLoadError')}
                    </Alert>}
                    {views.isSuccess && serverId && user?.Id && (['movies', 'series'] as const).map(media => (
                        <LibrarySource key={`${serverId}:${user.Id}:${media}`} media={media} serverId={serverId}
                            libraries={getCinemaLibraries(items, media)} />
                    ))}
                    <Button component={Link} to='/home'>{globalize.translate('Home')}</Button>
                </Stack>
            </div>
        </Page>
    );
}
