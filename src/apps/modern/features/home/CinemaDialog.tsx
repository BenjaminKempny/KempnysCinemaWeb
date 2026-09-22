import Dialog, { type DialogProps } from '@mui/material/Dialog';
import React, { useCallback } from 'react';

import layoutManager from 'components/layoutManager';
import { getKeyName, isInteractiveElement } from 'scripts/keyboardUtils';

export default function CinemaDialog({ onClose, onKeyDown, disableEscapeKeyDown, ...props }: Readonly<DialogProps>) {
    const handleClose = useCallback<NonNullable<DialogProps['onClose']>>((event, reason) => {
        if (reason === 'escapeKeyDown' && 'repeat' in event && event.repeat) return;
        onClose?.(event, reason);
    }, [onClose]);

    const handleKeyDown = useCallback<NonNullable<DialogProps['onKeyDown']>>(event => {
        onKeyDown?.(event);
        if (event.key === 'Escape') {
            // MUI closes this case itself, but disabled/pending dialogs must still contain Back.
            event.stopPropagation();
            return;
        }
        if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;

        const key = getKeyName(event.nativeEvent);
        const target = event.target instanceof Element ? event.target : document.activeElement;
        const backspace = key === 'Backspace' && target?.tagName !== 'SELECT' && !isInteractiveElement(target);
        if (key !== 'Back' && !((layoutManager.tv || layoutManager.modern) && key === 'Escape') && !backspace) return;

        const handled = event.defaultPrevented;
        event.preventDefault();
        event.stopPropagation();
        if (!handled && !disableEscapeKeyDown && !event.repeat) {
            onClose?.(event, 'escapeKeyDown');
        }
    }, [onClose, onKeyDown, disableEscapeKeyDown]);

    return <Dialog {...props} disableEscapeKeyDown={disableEscapeKeyDown}
        onClose={handleClose} onKeyDown={handleKeyDown} />;
}
