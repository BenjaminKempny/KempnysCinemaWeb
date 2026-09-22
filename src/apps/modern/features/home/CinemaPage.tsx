import React, { type ReactNode, useEffect } from 'react';
import { Link } from 'react-router-dom';

import Page from 'components/Page';
import { clearBackdrop } from 'components/backdrop/backdrop';
import globalize from 'lib/globalize';

import CinemaSidebar, { type CinemaDestination } from './CinemaSidebar';
import { useCinemaAppearance } from './settings';
import useCinemaFocus from './useCinemaFocus';

import './cinema.scss';

export default function CinemaPage({ title, active, children }: Readonly<{
    title: string;
    active: CinemaDestination;
    children: ReactNode;
}>) {
    const focusRoot = useCinemaFocus();
    const appearance = useCinemaAppearance();
    useEffect(() => clearBackdrop(true), []);

    return <Page id={`cinema-${active}`} className='cinemaPage cinemaUtilityPage focuscontainer' title={title}>
        <div ref={focusRoot} className='cinemaHome' data-directional-navigation data-appearance={appearance}
            data-theme={appearance === 'light' ? 'light' : undefined}
            data-scroll-mode-x='nearest' data-scroll-mode-y='nearest'>
            <CinemaSidebar active={active} />
            <div className='cinemaShell'>
                <header className='cinemaHeader'>
                    <Link className='cinemaBrand' to='/home' aria-label={globalize.translate('Home')}>
                        <img src='assets/img/appIcon.png' alt="Kempny's Cinema" />
                    </Link>
                </header>
                <div className='cinemaContent'>
                    {/* Mirrors the home layout so every cinema page shares one geometry. */}
                    <div className='cinemaToolbar'>
                        <h1 className='cinemaHeading'>{title}</h1>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    </Page>;
}
