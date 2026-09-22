import postcss from 'postcss';
import { compile } from 'sass';
import { describe, expect, it } from 'vitest';

const styles = postcss.parse(compile('src/apps/modern/features/home/cinema.scss').css);
const detailStyles = postcss.parse(compile('src/themes/appletvmodern/theme.scss').css);

function declarations(selector: string, media?: string, stylesheet = styles) {
    const result: Record<string, string> = {};
    stylesheet.walkRules(selector, rule => {
        const parent = rule.parent;
        const condition = parent?.type === 'atrule' ? parent.params : undefined;
        if (condition === media) {
            rule.walkDecls(declaration => {
                result[declaration.prop] = declaration.value;
            });
        }
    });
    return result;
}

describe('cinema layout constraints', () => {
    it('gives every home tab a full-width scrolling page independent of its content', () => {
        expect(declarations('#cinemaHomePage.cinemaPage,\n.cinemaPage.cinemaUtilityPage')).toMatchObject({
            position: 'absolute',
            inset: '0',
            width: '100%',
            height: '100%',
            padding: '0',
            'overflow-y': 'auto'
        });
        expect(declarations('.cinemaHome')).toMatchObject({ width: '100%', 'min-height': '100%' });
        expect(declarations('.cinemaShell')).toMatchObject({ width: '100%', 'max-width': 'none', margin: '0' });
    });

    it('reserves a separate desktop grid column and gap for the sidebar', () => {
        expect(declarations('.cinemaHome')).toMatchObject({
            display: 'grid',
            'grid-template-columns': '64px minmax(0, 1fr)',
            gap: '24px'
        });
        expect(declarations('.cinemaSidebar')).toMatchObject({ position: 'sticky', width: '64px' });
    });

    it('retains mobile bottom navigation with space below the content', () => {
        expect(declarations('.cinemaSidebar', '(max-width: 700px)').position).toBe('fixed');
        const mobile = declarations('.cinemaHome', '(max-width: 700px)');
        expect(mobile.display).toBe('block');
        expect(mobile.padding).toContain('100px + env(safe-area-inset-bottom)');
    });

    it('hides only the genre scrollbars without disabling horizontal scrolling', () => {
        expect(declarations('.cinemaRow')['overflow-x']).toBe('auto');
        expect(declarations('.cinemaGenre .cinemaRow')['scrollbar-width']).toBe('none');
        expect(declarations('.cinemaGenre .cinemaRow::-webkit-scrollbar').display).toBe('none');
    });

    it('lets the detail capsule fill its available width and contain its artwork', () => {
        const prefix = ':not(.layout-tv) > body #itemDetailPage';
        expect(declarations(`${prefix} .detailPageWrapperContainer`, undefined, detailStyles)).toMatchObject({
            width: 'calc(100% - 48px)',
            'max-width': 'none',
            height: 'auto',
            contain: 'none'
        });
        expect(declarations(`${prefix} .detailPagePrimaryContainer,\n${prefix} .cinemaDetailHero`, undefined, detailStyles).position).toBe('relative');
        const modernWrapper = '.modernAppLayout #itemDetailPage.itemDetailPage .detailPageWrapperContainer';
        expect(declarations(modernWrapper, undefined, detailStyles)['margin-block']).toBe('24px');
        expect(declarations(modernWrapper, '(max-width: 50em)', detailStyles)['margin-block']).toBe('12px');
    });

    it('aligns detail information and buttons without legacy poster offsets', () => {
        const prefix = '.modernAppLayout #itemDetailPage.cinemaDetailPage';
        const selector = `${prefix} .detailRibbon > .infoWrapper,\n${prefix} .detailRibbon > .mainDetailButtons`;
        expect(declarations(selector, undefined, detailStyles)).toMatchObject({
            position: 'static',
            inset: 'auto',
            'box-sizing': 'border-box',
            width: '100%',
            'min-width': '0',
            'max-width': 'none',
            height: 'auto',
            'margin-inline': '0',
            padding: '0',
            transform: 'none'
        });
        detailStyles.walkRules(selector, rule => {
            rule.walkDecls(/^(position|inset|width|height|margin-inline|padding|transform)$/, declaration => {
                expect(declaration.important).toBe(true);
            });
        });
    });

    it('keeps textual detail titles visible even when logo styles hide them', () => {
        const prefix = '.modernAppLayout #itemDetailPage.cinemaDetailPage';
        const selector = `${prefix} .nameContainer > .itemName,\n${prefix} .nameContainer > .parentName`;
        expect(declarations(selector, undefined, detailStyles)).toMatchObject({
            display: 'block',
            visibility: 'visible',
            height: 'auto',
            'max-height': 'none',
            opacity: '1'
        });
        detailStyles.walkRules(selector, rule => {
            rule.walkDecls(declaration => {
                expect(declaration.important).toBe(true);
            });
        });
    });

    it('keeps the complete cinema detail capsule in a non-shrinking vertical flow', () => {
        const prefix = '.modernAppLayout #itemDetailPage.cinemaDetailPage';
        const containers = [
            '.detailPageWrapperContainer',
            '.detailPagePrimaryContainer',
            '.detailPagePrimaryContent',
            '.detailSection',
            '.detailPageSecondaryContainer'
        ];
        const selector = containers.map(container => `${prefix} ${container}`).join(',\n');
        expect(declarations(selector, undefined, detailStyles)).toMatchObject({
            position: 'relative',
            inset: 'auto',
            display: 'flex',
            flex: '0 0 auto',
            'flex-direction': 'column',
            'align-items': 'stretch',
            height: 'auto',
            'max-height': 'none',
            contain: 'none'
        });
        expect(declarations(`${prefix} .detailPagePrimaryContainer::before`, undefined, detailStyles).content).toBe('none');
        expect(declarations(`${prefix} .cinemaDetailSummary`, undefined, detailStyles)).toMatchObject({
            display: 'grid',
            'grid-template-columns': 'minmax(0, 1fr)',
            order: '0'
        });
        expect(declarations(`${prefix} .cinemaDetailSummary:has(> .trackSelections:not(.hide))`, '(min-width: 62.5em)', detailStyles)['grid-template-columns'])
            .toBe('minmax(0, 1.4fr) minmax(0, 1fr)');
    });
});
