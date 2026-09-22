/**
 * Isolate the two column layouts so asynchronously populated sections remain
 * in the capsule's vertical flow. Keep the legacy/TV template unchanged.
 */
export function prepareCinemaLayout(page: HTMLElement) {
    const primary = page.querySelector('.detailPagePrimaryContainer');
    const poster = primary?.querySelector(':scope > .detailImageContainer');
    const ribbon = primary?.querySelector(':scope > .detailRibbon');
    const section = page.querySelector('.detailSection');
    const description = section?.querySelector(':scope > .detailSectionContent');
    const tracks = section?.querySelector(':scope > .trackSelections');
    const navigation = page.querySelector('.cinemaDetailNavigation');

    if (!primary || !poster || !ribbon || !section || !description || !tracks || !navigation) {
        throw new Error('Incomplete cinema detail template');
    }

    const hero = page.ownerDocument.createElement('div');
    hero.className = 'cinemaDetailHero';
    primary.insertBefore(hero, poster);
    hero.appendChild(poster);
    hero.appendChild(ribbon);

    // The cinema hero owns the poster; legacy mobile CSS must not add one over the text.
    ribbon.querySelector('.infoWrapper > .detailImageContainer')?.remove();

    const summary = page.ownerDocument.createElement('div');
    summary.className = 'cinemaDetailSummary';
    section.insertBefore(summary, section.firstChild);
    summary.appendChild(description);
    summary.appendChild(tracks);

    navigation.classList.remove('hide');
    page.classList.add('cinemaDetailPage');
}
