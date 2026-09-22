import type { UserDto } from '@jellyfin/sdk/lib/generated-client/models/user-dto';
import ClosedCaptionOutlined from '@mui/icons-material/ClosedCaptionOutlined';
import CollectionsBookmarkOutlined from '@mui/icons-material/CollectionsBookmarkOutlined';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import DevicesOtherOutlined from '@mui/icons-material/DevicesOtherOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import HomeOutlined from '@mui/icons-material/HomeOutlined';
import KeyboardOutlined from '@mui/icons-material/KeyboardOutlined';
import LogoutOutlined from '@mui/icons-material/LogoutOutlined';
import PersonOutlineRounded from '@mui/icons-material/PersonOutlineRounded';
import PhonelinkLockOutlined from '@mui/icons-material/PhonelinkLockOutlined';
import PlayCircleOutlined from '@mui/icons-material/PlayCircleOutlined';
import PowerSettingsNewOutlined from '@mui/icons-material/PowerSettingsNewOutlined';
import StorageOutlined from '@mui/icons-material/StorageOutlined';
import TvOutlined from '@mui/icons-material/TvOutlined';
import React, { type ReactNode, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import CinemaPage from 'apps/modern/features/home/CinemaPage';
import { RequestState } from 'apps/modern/features/home/MediaCard';
import { useCollectionOperationsDisabled } from 'apps/modern/features/home/settings';
import { appHost } from 'components/apphost';
import layoutManager from 'components/layoutManager';
import { AppFeature } from 'constants/appFeature';
import { useApi } from 'hooks/useApi';
import { useQuickConnectEnabled } from 'hooks/useQuickConnect';
import { useUsers } from 'hooks/useUsers';
import globalize from 'lib/globalize';
import browser from 'scripts/browser';
import keyboardNavigation from 'scripts/keyboardNavigation';
import { currentSettings } from 'scripts/settings/userSettings';
import shell from 'scripts/shell';
import Dashboard from 'utils/dashboard';

interface SettingsEntry {
    key: string;
    label: string;
    icon: ReactNode;
    to?: string;
    onClick?: () => void;
}

function SettingsList({ title, entries }: Readonly<{ title: string; entries: SettingsEntry[] }>) {
    if (!entries.length) return null;
    return (
        <section className='cinemaSettingsGroup' aria-label={title}>
            <h2>{title}</h2>
            <div className='cinemaSettingsList'>
                {entries.map(entry => (entry.to ? (
                    <Link key={entry.key} className='cinemaSettingsItem' to={entry.to}>
                        {entry.icon}<span>{entry.label}</span>
                    </Link>
                ) : (
                    <button key={entry.key} type='button' className='cinemaSettingsItem' onClick={entry.onClick}>
                        {entry.icon}<span>{entry.label}</span>
                    </button>
                )))}
            </div>
        </section>
    );
}

function CinemaOptions() {
    const collectionsLocked = useCollectionOperationsDisabled();
    const toggleCollections = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        currentSettings.disableCollectionOperations(event.target.checked);
    }, []);

    return (
        <section className='cinemaSettingsGroup' aria-label={globalize.translate('Collections')}>
            <h2>{globalize.translate('Collections')}</h2>
            <div className='cinemaSettingsList'>
                <label className='cinemaSettingsItem cinemaSettingsToggle'>
                    <CollectionsBookmarkOutlined />
                    <span>
                        {globalize.translate('CinemaDisableCollectionOperations')}
                        <small>{globalize.translate('CinemaDisableCollectionOperationsHelp')}</small>
                    </span>
                    <input type='checkbox' checked={collectionsLocked} onChange={toggleCollections} />
                </label>
            </div>
        </section>
    );
}

function SettingsContent({ user, userId }: Readonly<{ user: UserDto; userId: string }>) {
    const { user: currentUser } = useApi();
    const { data: isQuickConnectEnabled } = useQuickConnectEnabled();
    const isLoggedInUser = userId === currentUser?.Id;
    const query = `?userId=${userId}`;
    // The gamepad toggle is unavailable on EdgeUWP and smooth scroll only exists on TV.
    const isControlsPageEmpty = !keyboardNavigation.canEnableGamepad() && !layoutManager.tv;

    const preferences = useMemo(() => {
        const entries: SettingsEntry[] = [
            { key: 'profile', label: globalize.translate('Profile'), icon: <PersonOutlineRounded />, to: `/userprofile${query}` }
        ];
        if (isQuickConnectEnabled) {
            entries.push({ key: 'quickconnect', label: globalize.translate('QuickConnect'), icon: <PhonelinkLockOutlined />, to: `/quickconnect${query}` });
        }
        entries.push(
            { key: 'display', label: globalize.translate('Display'), icon: <TvOutlined />, to: `/mypreferencesdisplay${query}` },
            { key: 'home', label: globalize.translate('Home'), icon: <HomeOutlined />, to: `/mypreferenceshome${query}` },
            { key: 'playback', label: globalize.translate('TitlePlayback'), icon: <PlayCircleOutlined />, to: `/mypreferencesplayback${query}` },
            { key: 'subtitles', label: globalize.translate('Subtitles'), icon: <ClosedCaptionOutlined />, to: `/mypreferencessubtitles${query}` }
        );
        if (appHost.supports(AppFeature.DownloadManagement)) {
            entries.push({ key: 'downloads', label: globalize.translate('DownloadManager'), icon: <DownloadOutlined />, onClick: shell.openDownloadManager });
        }
        if (appHost.supports(AppFeature.ClientSettings)) {
            entries.push({ key: 'client', label: globalize.translate('ClientSettings'), icon: <DevicesOtherOutlined />, onClick: shell.openClientSettings });
        }
        if (isLoggedInUser && !browser.mobile && !isControlsPageEmpty) {
            entries.push({ key: 'controls', label: globalize.translate('Controls'), icon: <KeyboardOutlined />, to: `/mypreferencescontrols${query}` });
        }
        return entries;
    }, [isControlsPageEmpty, isLoggedInUser, isQuickConnectEnabled, query]);

    const admin: SettingsEntry[] = useMemo(() => (
        isLoggedInUser && user.Policy?.IsAdministrator && !layoutManager.tv ? [
            { key: 'dashboard', label: globalize.translate('TabDashboard'), icon: <DashboardOutlined />, to: '/dashboard' },
            { key: 'metadata', label: globalize.translate('MetadataManager'), icon: <EditOutlined />, to: '/metadata' }
        ] : []
    ), [isLoggedInUser, user.Policy?.IsAdministrator]);

    const account = useMemo(() => {
        if (!isLoggedInUser) return [];
        const entries: SettingsEntry[] = [];
        if (appHost.supports(AppFeature.MultiServer)) {
            entries.push({ key: 'server', label: globalize.translate('SelectServer'), icon: <StorageOutlined />, onClick: Dashboard.selectServer });
        }
        entries.push({ key: 'logout', label: globalize.translate('ButtonSignOut'), icon: <LogoutOutlined />, onClick: Dashboard.logout });
        if (appHost.supports(AppFeature.ExitMenu)) {
            entries.push({ key: 'exit', label: globalize.translate('ButtonExitApp'), icon: <PowerSettingsNewOutlined />, onClick: appHost.exit });
        }
        return entries;
    }, [isLoggedInUser]);

    return (
        <div className='cinemaSettings'>
            <SettingsList title={user.Name || globalize.translate('HeaderUser')} entries={preferences} />
            {isLoggedInUser && <CinemaOptions />}
            <SettingsList title={globalize.translate('HeaderAdmin')} entries={admin} />
            <SettingsList title={globalize.translate('HeaderUser')} entries={account} />
        </div>
    );
}

export default function UserSettingsPage() {
    const { user: currentUser } = useApi();
    const [ searchParams ] = useSearchParams();
    const { data: users } = useUsers();
    const { isPending: isQuickConnectPending } = useQuickConnectEnabled();
    const userId = searchParams.get('userId') || currentUser?.Id;
    const user = userId === currentUser?.Id ? currentUser : users?.find(({ Id }) => Id === userId);

    return (
        <CinemaPage title={globalize.translate('Settings')} active='settings'>
            {!userId || !user || isQuickConnectPending ?
                <RequestState pending /> :
                <SettingsContent key={userId} user={user} userId={userId} />}
        </CinemaPage>
    );
}
