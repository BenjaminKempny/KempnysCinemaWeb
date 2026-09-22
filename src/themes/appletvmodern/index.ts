import { buildCustomColorScheme } from 'themes/utils';

/** A modern, deep black Apple TV inspired color scheme. */
const theme = buildCustomColorScheme({
    palette: {
        mode: 'dark',
        background: {
            default: '#000',
            paper: '#141416'
        },
        primary: {
            main: '#fff',
            dark: '#e6e6e6',
            light: '#fff',
            contrastText: '#000'
        },
        secondary: {
            main: '#fff',
            contrastText: '#000'
        },
        text: {
            primary: '#fff',
            secondary: 'rgba(255, 255, 255, 0.7)'
        },
        action: {
            focus: 'rgba(255, 255, 255, 0.16)',
            hover: 'rgba(255, 255, 255, 0.08)'
        },
        divider: 'rgba(255, 255, 255, 0.08)',
        Alert: {
            infoFilledBg: 'rgba(255, 255, 255, 0.12)',
            infoFilledColor: '#fff'
        },
        AppBar: {
            defaultBg: 'rgba(12, 12, 14, 0.72)'
        },
        Button: {
            inheritContainedBg: 'rgba(255, 255, 255, 0.14)',
            inheritContainedHoverBg: 'rgba(255, 255, 255, 0.24)'
        },
        FilledInput: {
            bg: 'rgba(255, 255, 255, 0.08)'
        },
        SnackbarContent: {
            bg: 'rgba(28, 28, 30, 0.92)',
            color: '#fff'
        }
    }
});

export default theme;
