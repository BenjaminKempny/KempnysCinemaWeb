import React, { StrictMode, useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import { type Theme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Outlet, useLocation } from 'react-router-dom';

import AppBody from 'components/AppBody';
import CustomCss from 'components/CustomCss';
import OffsetAppBar from 'components/OffsetAppBar';
import ThemeCss from 'components/ThemeCss';
import { useApi } from 'hooks/useApi';

import AppToolbar from './components/AppToolbar';
import AppDrawer, { isDrawerPath } from './components/drawers/AppDrawer';
import LibraryToolbar from './features/libraries/components/LibraryToolbar';
import { LibraryProvider } from './features/libraries/hooks/useLibrary';
import { isLibraryPath } from './features/libraries/utils/path';

import './AppOverrides.scss';

export const Component = () => {
    const [ isDrawerActive, setIsDrawerActive ] = useState(false);
    const { user } = useApi();
    const location = useLocation();
    const isCinemaPage = ['/home', '/details', '/search', '/userprofile'].includes(location.pathname);

    const isMediumScreen = useMediaQuery((t: Theme) => t.breakpoints.up('md'));
    const isDrawerAvailable = !isCinemaPage && isDrawerPath(location.pathname) && Boolean(user) && !isMediumScreen;
    const isDrawerOpen = isDrawerActive && isDrawerAvailable;

    const onToggleDrawer = useCallback(() => {
        setIsDrawerActive(!isDrawerActive);
    }, [ isDrawerActive, setIsDrawerActive ]);

    return (
        <LibraryProvider>
            <Box
                className='modernAppLayout'
                sx={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    // `height: 100%` only resolves when every ancestor has a definite
                    // height. Legacy ViewManager pages are `position: absolute; inset: 0`
                    // and use the <main> box below as their containing block, so without
                    // a guaranteed height they collapse to the height of their (empty)
                    // React sibling and become unscrollable.
                    minHeight: '100vh',
                    '@supports (min-height: 100dvh)': {
                        minHeight: '100dvh'
                    }
                }}
            >
                <StrictMode>
                    {!isCinemaPage && <OffsetAppBar dense>
                        <AppToolbar
                            isDrawerAvailable={!isMediumScreen && isDrawerAvailable}
                            isDrawerOpen={isDrawerOpen}
                            onDrawerButtonClick={onToggleDrawer}
                        />
                        {isLibraryPath(location.pathname) && <LibraryToolbar />}
                    </OffsetAppBar>}

                    {
                        isDrawerAvailable && (
                            <AppDrawer
                                open={isDrawerOpen}
                                onClose={onToggleDrawer}
                                onOpen={onToggleDrawer}
                            />
                        )
                    }
                </StrictMode>

                <Box
                    component='main'
                    sx={{
                        position: 'relative',
                        width: '100%',
                        flexGrow: 1,
                        // Flex items default to `min-height: auto`, so a page taller than
                        // the viewport would stretch this box instead of scrolling inside
                        // it — and the document itself does not scroll.
                        minHeight: 0,
                        overflowY: 'auto',
                        overflowX: 'hidden'
                    }}
                >
                    <AppBody>
                        <Outlet />
                    </AppBody>
                </Box>
            </Box>
            <ThemeCss />
            <CustomCss />
        </LibraryProvider>
    );
};
