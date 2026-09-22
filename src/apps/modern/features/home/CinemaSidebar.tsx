import MovieOutlined from '@mui/icons-material/MovieOutlined';
import PersonOutlineRounded from '@mui/icons-material/PersonOutlineRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import TvRounded from '@mui/icons-material/TvRounded';
import React from 'react';
import { Link } from 'react-router-dom';

import globalize from 'lib/globalize';

import { cinemaUrl, type CinemaMedia, type CinemaView } from './navigation';

export type CinemaDestination = 'search' | 'profile' | 'settings';

export default function CinemaSidebar({ media, view = 'all', active }: Readonly<{
    media?: CinemaMedia;
    view?: CinemaView;
    active?: CinemaDestination;
}>) {
    const links = [
        { to: '/search', label: 'Search', icon: <SearchRounded />, active: active === 'search' },
        { to: cinemaUrl('movies', view), label: 'Movies', icon: <MovieOutlined />, active: media === 'movies' },
        { to: cinemaUrl('series', view), label: 'Shows', icon: <TvRounded />, active: media === 'series' },
        { to: '/userprofile', label: 'Profile', icon: <PersonOutlineRounded />, active: active === 'profile' },
        { to: '/mypreferencesmenu', label: 'Settings', icon: <SettingsOutlined />, active: active === 'settings' }
    ];

    return <nav className='cinemaSidebar' aria-label={globalize.translate('CinemaNavigation')}>
        {links.map(link => <Link key={link.label} to={link.to} className='cinemaNavItem' aria-current={link.active ? 'page' : undefined}
            aria-label={globalize.translate(link.label)} title={globalize.translate(link.label)}>{link.icon}</Link>)}
    </nav>;
}
