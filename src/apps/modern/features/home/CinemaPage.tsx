import React, { type ReactNode, useEffect } from 'react';
import { Link } from 'react-router-dom';

import Page from 'components/Page';
import { clearBackdrop } from 'components/backdrop/backdrop';
import globalize from 'lib/globalize';

import CinemaSidebar, { type CinemaDestination } from './CinemaSidebar';
import useCinemaFocus from './useCinemaFocus';

import './cinema.scss';

export default function CinemaPage({ title, active, children }: Readonly<{
    title: string;
    active: CinemaDestination;
    children: ReactNode;
}>) {
    const focusRoot = useCinemaFocus();
    useEffect(() => clearBackdrop(true), []);

    return <Page id={`cinema-${active}`} className='cinemaPage cinemaUtilityPage focuscontainer' title={title}>
        <div ref={focusRoot} className='cinemaHome' data-directional-navigation
            data-scroll-mode-x='nearest' data-scroll-mode-y='nearest'>
            <CinemaSidebar active={active} />
            <div className='cinemaShell'>
                <header className='cinemaHeader cinemaUtilityHeader'>
                    <Link className='cinemaBrand' to='/home' aria-label={globalize.translate('Home')}>
                        <img src='assets/img/appIcon.png' alt="Kempny's Cinema" />
                    </Link>
                    <h1 className='cinemaHeading'>{title}</h1>
                </header>
                <div className='cinemaContent'>{children}</div>
            </div>
        </div>
    </Page>;
}
