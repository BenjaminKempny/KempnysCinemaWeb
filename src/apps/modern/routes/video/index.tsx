import Box from '@mui/material/Box/Box';
import Fade from '@mui/material/Fade/Fade';
import React, { useRef, type FC, useEffect, useState } from 'react';

import RemotePlayButton from 'apps/modern/components/AppToolbar/RemotePlayButton';
import SyncPlayButton from 'apps/modern/components/AppToolbar/SyncPlayButton';
import AppToolbar from 'components/toolbar/AppToolbar';
import ViewManagerPage from 'components/viewManager/ViewManagerPage';
import { EventType } from 'constants/eventType';
import Events, { type Event } from 'utils/events';

/**
 * Video player page component that renders mui controls for the top controls and the legacy view for everything else.
 */
const VideoPage: FC = () => {
    const documentRef = useRef<Document>(document);
    const [ isVisible, setIsVisible ] = useState(true);

    const onShowVideoOsd = (_e: Event, isShowing: boolean) => {
        setIsVisible(isShowing);
    };

    useEffect(() => {
        const doc = documentRef.current;

        if (doc) {
            Events.on(doc, EventType.SHOW_VIDEO_OSD, onShowVideoOsd);
        }

        return () => {
            if (doc) {
                Events.off(doc, EventType.SHOW_VIDEO_OSD, onShowVideoOsd);
            }
        };
    }, []);

    return (
        <>
            <Fade
                in={isVisible}
                easing='fade-out'
            >
                <Box
                    className='skinHeader osdHeader'
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        color: 'white',
                        background: 'none',
                        backdropFilter: 'none',
                        pointerEvents: 'none'
                    }}
                >
                    <AppToolbar
                        isDrawerAvailable={false}
                        isDrawerOpen={false}
                        isUserMenuAvailable={false}
                        buttons={
                            <>
                                <SyncPlayButton />
                                <RemotePlayButton />
                            </>
                        }
                        className='videoOsd-appBar'
                    />
                </Box>
            </Fade>

            <ViewManagerPage
                controller='playback/video/index'
                view='playback/video/index.html'
                type='video-osd'
                isFullscreen
                isNowPlayingBarEnabled={false}
                isThemeMediaSupported
            />
        </>
    );
};

export default VideoPage;
