import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

import globalize from '../../../lib/globalize';
import { clearBackdrop } from '../../../components/backdrop/backdrop';
import layoutManager from '../../../components/layoutManager';
import Page from '../../../components/Page';
import { enableGenreHome } from '../../../scripts/settings/userSettings';
import { EventType } from 'constants/eventType';
import Events from 'utils/events';

import '../../../elements/emby-tabs/emby-tabs';
import '../../../elements/emby-button/emby-button';
import '../../../elements/emby-scroller/emby-scroller';

type OnResumeOptions = {
    autoFocus?: boolean;
    refresh?: boolean
};

type ControllerProps = {
    onResume: (
        options: OnResumeOptions
    ) => void;
    refreshed: boolean;
    onPause: () => void;
    destroy: () => void;
};

const Home = () => {
    const [ searchParams ] = useSearchParams();
    const initialTabIndex = parseInt(searchParams.get('tab') ?? '0', 10);

    const libraryMenu = useMemo(async () => ((await import('../../../scripts/libraryMenu')).default), []);
    const mainTabsManager = useMemo(() => import('../../../components/maintabsmanager'), []);
    const tabController = useRef<ControllerProps | null>();
    const tabControllers = useMemo<ControllerProps[]>(() => [], []);

    // When the genre home screen is enabled, movies and series each get their own tab
    const isGenreHome = useMemo(() => enableGenreHome(), []);

    const documentRef = useRef<Document>(document);
    const element = useRef<HTMLDivElement>(null);

    const setTitle = async () => {
        (await libraryMenu).setTitle(null);
    };

    const getTabs = useCallback(() => {
        if (isGenreHome) {
            return [
                { name: globalize.translate('Home') },
                { name: globalize.translate('Movies') },
                { name: globalize.translate('Shows') },
                { name: globalize.translate('Favorites') }
            ];
        }

        return [
            { name: globalize.translate('Home') },
            { name: globalize.translate('Favorites') }
        ];
    }, [ isGenreHome ]);

    const getTabContainers = () => {
        return element.current?.querySelectorAll('.tabContent');
    };

    const getTabController = useCallback((index: number) => {
        if (index == null) {
            throw new Error('index cannot be null');
        }

        const tabModules = isGenreHome ?
            [ 'hometab', 'moviesgenretab', 'seriesgenretab', 'favorites' ] :
            [ 'hometab', 'favorites' ];

        const depends = tabModules[index] ?? tabModules[0];

        return import(/* webpackChunkName: "[request]" */ `../../../apps/legacy/controllers/${depends}`).then(({ default: ControllerFactory }) => {
            let controller = tabControllers[index];

            if (!controller) {
                const tabContent = element.current?.querySelector(".tabContent[data-index='" + index + "']");
                controller = new ControllerFactory(tabContent, null);
                tabControllers[index] = controller;
            }

            return controller;
        });
    }, [ isGenreHome, tabControllers ]);

    const loadTab = useCallback((index: number, previousIndex: number | null) => {
        getTabController(index).then((controller) => {
            const refresh = !controller.refreshed;

            controller.onResume({
                autoFocus: previousIndex == null && layoutManager.tv,
                refresh: refresh
            });

            controller.refreshed = true;
            tabController.current = controller;
        }).catch(err => {
            console.error('[Home] failed to get tab controller', err);
        });
    }, [ getTabController ]);

    const onTabChange = useCallback((e: { detail: { selectedTabIndex: string; previousIndex: number | null }; }) => {
        const newIndex = parseInt(e.detail.selectedTabIndex, 10);
        const previousIndex = e.detail.previousIndex;

        const previousTabController = previousIndex == null ? null : tabControllers[previousIndex];
        if (previousTabController?.onPause) {
            previousTabController.onPause();
        }

        loadTab(newIndex, previousIndex);
    }, [ loadTab, tabControllers ]);

    const onSetTabs = useCallback(async () => {
        (await mainTabsManager).setTabs(element.current, initialTabIndex, getTabs, getTabContainers, null, onTabChange, false);
    }, [ getTabs, initialTabIndex, mainTabsManager, onTabChange ]);

    const onResume = useCallback(async () => {
        void setTitle();
        clearBackdrop();

        const currentTabController = tabController.current;

        if (!currentTabController) {
            (await mainTabsManager).selectedTabIndex(initialTabIndex);
        } else if (currentTabController?.onResume) {
            currentTabController.onResume({});
        }
        (documentRef.current.querySelector('.skinHeader') as HTMLDivElement).classList.add('noHomeButtonHeader');
    }, [ initialTabIndex, mainTabsManager ]);

    const onPause = useCallback(() => {
        const currentTabController = tabController.current;
        if (currentTabController?.onPause) {
            currentTabController.onPause();
        }
        (documentRef.current.querySelector('.skinHeader') as HTMLDivElement).classList.remove('noHomeButtonHeader');
    }, []);

    const renderHome = useCallback(() => {
        void onSetTabs();
        void onResume();
    }, [ onResume, onSetTabs ]);

    useEffect(() => {
        if (documentRef.current?.querySelector('.headerTabs')) {
            renderHome();
        }

        return () => {
            onPause();
        };
    }, [onPause, renderHome]);

    useEffect(() => {
        const doc = documentRef.current;
        if (doc) Events.on(doc, EventType.HEADER_RENDERED, renderHome);

        return () => {
            if (doc) Events.off(doc, EventType.HEADER_RENDERED, renderHome);
        };
    }, [ renderHome ]);

    return (
        <div ref={element}>
            <Page
                id='indexPage'
                className='mainAnimatedPage homePage libraryPage allLibraryPage pageWithAbsoluteTabs withTabs'
                isBackButtonEnabled={false}
                backDropType={[
                    BaseItemKind.Movie,
                    BaseItemKind.Series,
                    BaseItemKind.Book
                ]}
            >
                <div className='tabContent pageTabContent' id='homeTab' data-index='0'>
                    <div className='sections'></div>
                </div>
                {isGenreHome && (
                    <div className='tabContent pageTabContent' id='moviesGenreTab' data-index='1'>
                        <div className='sections'></div>
                    </div>
                )}
                {isGenreHome && (
                    <div className='tabContent pageTabContent' id='seriesGenreTab' data-index='2'>
                        <div className='sections'></div>
                    </div>
                )}
                <div className='tabContent pageTabContent' id='favoritesTab' data-index={isGenreHome ? '3' : '1'}>
                    <div className='sections'></div>
                </div>
            </Page>
        </div>
    );
};

export default Home;
