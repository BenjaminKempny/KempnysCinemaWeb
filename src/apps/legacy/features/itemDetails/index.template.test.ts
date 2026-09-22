import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prepareCinemaLayout } from './cinemaLayout';

const template = readFileSync('src/apps/legacy/controllers/itemDetails/index.html', 'utf8');

describe('item detail template', () => {
    let page: HTMLDivElement;

    beforeEach(() => {
        const container = document.createElement('div');
        container.innerHTML = template;
        const detailPage = container.querySelector<HTMLDivElement>('#itemDetailPage');
        if (!detailPage) throw new Error('Missing detail page');
        page = detailPage;
    });

    it('does not render similar recommendations', () => {
        expect(page.querySelector('#similarCollapsible')).toBeNull();
        expect(page.querySelector('.similarContent')).toBeNull();
    });

    it('keeps collection items below the description inside the detail capsule', () => {
        const capsule = page.querySelector('.detailPageWrapperContainer');
        const description = page.querySelector('.detailSectionContent');
        const collection = page.querySelector('.collectionItems');

        if (!description || !collection) {
            throw new Error('Missing detail description or collection container');
        }

        expect(capsule?.contains(collection)).toBe(true);
        expect(description.compareDocumentPosition(collection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('keeps episode lists and all media selectors inside the detail capsule', () => {
        const capsule = page.querySelector('.detailPageWrapperContainer');
        expect(capsule?.querySelector('#childrenCollapsible')).not.toBeNull();
        expect(capsule?.querySelectorAll('.detailTrackSelect')).toHaveLength(4);
    });

    it('leaves cinema navigation hidden in the unmodified legacy/TV template', () => {
        expect(page.querySelector('.cinemaDetailNavigation')?.classList.contains('hide')).toBe(true);
        expect(page.querySelector('.cinemaDetailHero')).toBeNull();
        expect(page.querySelector('.cinemaDetailSummary')).toBeNull();
    });

    it('limits cinema columns to the hero and summary, keeping all remaining sections in flow', () => {
        prepareCinemaLayout(page);

        const capsule = page.querySelector('.detailPageWrapperContainer');
        const hero = page.querySelector('.cinemaDetailHero');
        const summary = page.querySelector('.cinemaDetailSummary');
        expect(page.classList.contains('cinemaDetailPage')).toBe(true);
        expect(hero?.children).toHaveLength(2);
        expect(hero?.querySelector('.detailRibbon')).not.toBeNull();
        expect(hero?.querySelector('.detailPagePrimaryContent')).toBeNull();
        expect(summary?.children).toHaveLength(2);
        expect(summary?.querySelector('.detailSectionContent')).not.toBeNull();
        expect(summary?.querySelector('.trackSelections')).not.toBeNull();
        expect(page.querySelector('.detailSection > .itemDetailsGroup')).not.toBeNull();
        expect(page.querySelector('.detailSection > .collectionItems')).not.toBeNull();
        expect(capsule?.querySelector('.detailPageSecondaryContainer #childrenCollapsible')).not.toBeNull();
        expect(capsule?.querySelector('#castCollapsible')).not.toBeNull();
        expect(page.querySelector('.cinemaDetailNavigation')?.classList.contains('hide')).toBe(false);
        expect(page.querySelector('.cinemaDetailNavigation a')?.getAttribute('href')).toBe('#/home');
    });

    it('preserves the existing media controls and their event handlers when grouping them', () => {
        const select = page.querySelector<HTMLSelectElement>('.selectAudio');
        if (!select) throw new Error('Missing audio selection');
        const onChange = vi.fn();
        select.addEventListener('change', onChange);

        prepareCinemaLayout(page);

        expect(page.querySelector('.cinemaDetailSummary .selectAudio')).toBe(select);
        select.dispatchEvent(new Event('change'));
        expect(onChange).toHaveBeenCalledOnce();
    });

    it('renders only the hero poster, never a second mobile poster inside the text', () => {
        expect(page.querySelectorAll('.detailImageContainer')).toHaveLength(2);

        prepareCinemaLayout(page);

        expect(page.querySelectorAll('.detailImageContainer')).toHaveLength(1);
        expect(page.querySelector('.cinemaDetailHero > .detailImageContainer')).not.toBeNull();
        expect(page.querySelector('.infoWrapper .detailImageContainer')).toBeNull();
    });
});
