import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';

const template = readFileSync('src/apps/legacy/controllers/itemDetails/index.html', 'utf8');

describe('item detail template', () => {
    let page: HTMLDivElement;

    beforeEach(() => {
        page = document.createElement('div');
        page.innerHTML = template;
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
});
