import focusManager from 'components/focusManager';
import homeSections from 'components/homesections/homesections';
import { ServerConnections } from 'lib/jellyfin-apiclient';

import 'elements/emby-itemscontainer/emby-itemscontainer';
import 'elements/emby-scroller/emby-scroller';

/**
 * Creates a tab controller that renders horizontally scrolling genre rows for a
 * single item type (movies or series).
 * @param {object} sectionConfig a genre section config from `sections/genreRows`
 * @returns {Function} a tab controller class
 */
export default function createGenreTabController(sectionConfig) {
    return class GenreTab {
        constructor(view) {
            this.view = view;
            this.apiClient = ServerConnections.currentApiClient();
            this.sectionsContainer = view.querySelector('.sections');
        }

        onResume(options) {
            const sectionsContainer = this.sectionsContainer;

            if (this.sectionsRendered) {
                return sectionsContainer ? homeSections.resume(sectionsContainer, options) : Promise.resolve();
            }

            this.destroyHomeSections();
            this.sectionsRendered = true;

            return this.apiClient.getCurrentUser()
                .then(user => homeSections.loadGenreTab(sectionsContainer, this.apiClient, user, sectionConfig))
                .then(() => {
                    if (options?.autoFocus) {
                        focusManager.autoFocus(this.view);
                    }
                })
                .catch(err => {
                    console.error('[genreTab] failed to render genre rows', err);
                });
        }

        onPause() {
            if (this.sectionsContainer) {
                homeSections.pause(this.sectionsContainer);
            }
        }

        destroy() {
            this.destroyHomeSections();
            this.view = null;
            this.apiClient = null;
            this.sectionsContainer = null;
        }

        destroyHomeSections() {
            if (this.sectionsContainer) {
                homeSections.destroySections(this.sectionsContainer);
            }
        }
    };
}
