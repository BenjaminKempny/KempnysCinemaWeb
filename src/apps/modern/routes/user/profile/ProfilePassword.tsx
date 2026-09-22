import type { UserDto } from '@jellyfin/sdk/lib/generated-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { type FormEvent, useCallback, useRef, useState } from 'react';

import globalize from 'lib/globalize';

interface ProfilePasswordProps {
    readonly user: UserDto;
}

const ProfilePassword = ({ user }: ProfilePasswordProps) => {
    const queryClient = useQueryClient();
    const formRef = useRef<HTMLFormElement>(null);
    const [validation, setValidation] = useState<string>();
    const [confirmReset, setConfirmReset] = useState(false);
    const password = useMutation({
        mutationFn: ({ current, next, reset }: { current: string; next: string; reset: boolean }) => {
            if (!user.Id) throw new Error('Missing user id');
            return reset ?
                window.ApiClient.resetUserPassword(user.Id) :
                window.ApiClient.updateUserPassword(user.Id, current, next);
        },
        onSuccess: async () => {
            formRef.current?.reset();
            setConfirmReset(false);
            await queryClient.invalidateQueries({ queryKey: ['User', user.Id] });
        }
    });

    const onSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (password.isPending) return;
        const data = new FormData(event.currentTarget);
        const next = String(data.get('newPassword') || '');
        setValidation(undefined);
        password.reset();
        if (next !== data.get('confirmPassword')) {
            setValidation('PasswordMatchError');
        } else if (!next && user.Policy?.IsAdministrator) {
            setValidation('PasswordMissingSaveError');
        } else {
            password.mutate({
                current: user.HasConfiguredPassword ? String(data.get('currentPassword') || '') : '',
                next,
                reset: false
            });
        }
    }, [password, user]);

    const onRequestReset = useCallback(() => setConfirmReset(true), []);
    const onCancelReset = useCallback(() => setConfirmReset(false), []);
    const onReset = useCallback(() => {
        setValidation(undefined);
        password.mutate({ current: '', next: '', reset: true });
    }, [password]);

    return (
        <section className='cinemaProfilePanel' aria-labelledby='profile-password-heading'>
            <h2 id='profile-password-heading'>{globalize.translate('HeaderPassword')}</h2>
            <form ref={formRef} onSubmit={onSubmit}>
                <fieldset disabled={password.isPending}>
                    {user.HasConfiguredPassword && (
                        <label className='cinemaProfileField'>
                            <span>{globalize.translate('LabelCurrentPassword')}</span>
                            <input type='password' name='currentPassword' autoComplete='current-password' />
                        </label>
                    )}
                    <label className='cinemaProfileField'>
                        <span>{globalize.translate('LabelNewPassword')}</span>
                        <input type='password' name='newPassword' autoComplete='new-password' />
                    </label>
                    <label className='cinemaProfileField'>
                        <span>{globalize.translate('LabelNewPasswordConfirm')}</span>
                        <input type='password' name='confirmPassword' autoComplete='new-password' />
                    </label>
                    <div className='cinemaProfileActions'>
                        <button className='cinemaProfileButton cinemaProfileButtonPrimary' type='submit'>
                            {globalize.translate('SavePassword')}
                        </button>
                        {user.HasConfiguredPassword && !user.Policy?.IsAdministrator && (
                            <button className='cinemaProfileButton' type='button' onClick={onRequestReset}>
                                {globalize.translate('ResetPassword')}
                            </button>
                        )}
                    </div>
                    {confirmReset && (
                        <div className='cinemaProfileConfirmation'>
                            <p>{globalize.translate('PasswordResetConfirmation')}</p>
                            <div className='cinemaProfileActions'>
                                <button className='cinemaProfileButton' type='button' onClick={onReset}>
                                    {globalize.translate('ResetPassword')}
                                </button>
                                <button className='cinemaProfileButton' type='button' onClick={onCancelReset}>
                                    {globalize.translate('ButtonCancel')}
                                </button>
                            </div>
                        </div>
                    )}
                </fieldset>
                {password.isPending && <p role='status'>{globalize.translate('CinemaProfileSaving')}</p>}
                {(validation || password.isError) && (
                    <p className='cinemaProfileError' role='alert'>
                        {globalize.translate(validation || 'MessageInvalidUser')}
                    </p>
                )}
                {password.isSuccess && (
                    <p role='status'>
                        {globalize.translate(password.variables.reset ? 'PasswordResetComplete' : 'PasswordSaved')}
                    </p>
                )}
            </form>
        </section>
    );
};

export default ProfilePassword;
