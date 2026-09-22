import { useCallback, useSyncExternalStore } from 'react';

import { currentSettings } from 'scripts/settings/userSettings';
import Events from 'utils/events';

export type CinemaAppearance = 'dark' | 'light';

/** Subscribes to a single user setting so the cinema UI reacts to preference changes. */
function useUserSetting<T>(read: () => T) {
    const subscribe = useCallback((onChange: () => void) => {
        Events.on(currentSettings, 'change', onChange);
        return () => Events.off(currentSettings, 'change', onChange);
    }, []);
    return useSyncExternalStore(subscribe, read, read);
}

export function useCinemaAppearance(): CinemaAppearance {
    return useUserSetting(() => (currentSettings.cinemaAppearance() === 'light' ? 'light' : 'dark'));
}

/** True when every collection editing feature must be hidden. */
export function useCollectionOperationsDisabled(): boolean {
    return useUserSetting(() => currentSettings.disableCollectionOperations());
}
