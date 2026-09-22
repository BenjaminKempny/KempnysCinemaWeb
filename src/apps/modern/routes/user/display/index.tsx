import Button from '@mui/material/Button';
import { SelectChangeEvent } from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import React, { useCallback } from 'react';

import { DisplayPreferences } from 'apps/modern/features/preferences/components/DisplayPreferences';
import { ItemDetailPreferences } from 'apps/modern/features/preferences/components/ItemDetailPreferences';
import { LibraryPreferences } from 'apps/modern/features/preferences/components/LibraryPreferences';
import { useDisplaySettingForm } from 'apps/modern/features/preferences/hooks/useDisplaySettingForm';
import { LocalizationPreferences } from 'apps/modern/features/preferences/components/LocalizationPreferences';
import { NextUpPreferences } from 'apps/modern/features/preferences/components/NextUpPreferences';
import type { DisplaySettingsValues } from 'apps/modern/features/preferences/types/displaySettingsValues';
import CinemaPage from 'apps/modern/features/home/CinemaPage';
import LoadingComponent from 'components/loading/LoadingComponent';
import globalize from 'lib/globalize';

export default function UserDisplayPreferences() {
    const {
        loading,
        submitChanges,
        updateField,
        values
    } = useDisplaySettingForm();

    const handleSubmitForm = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        void submitChanges();
    }, [submitChanges]);

    const handleFieldChange = useCallback((e: SelectChangeEvent | React.SyntheticEvent) => {
        const target = e.target as HTMLInputElement;
        const fieldName = target.name as keyof DisplaySettingsValues;
        const fieldValue = target.type === 'checkbox' ? target.checked : target.value;

        if (values?.[fieldName] !== fieldValue) {
            updateField({
                name: fieldName,
                value: fieldValue
            });
        }
    }, [updateField, values]);

    return (
        <CinemaPage title={globalize.translate('Display')} active='settings'>
            {loading || !values ? <LoadingComponent /> : (
                <form
                    className='displayPreferencesForm cinemaSettingsForm'
                    onSubmit={handleSubmitForm}
                >
                    <Stack className='displayPreferencesSections' spacing={4}>
                        <LocalizationPreferences
                            onChange={handleFieldChange}
                            values={values}
                        />
                        <DisplayPreferences
                            onChange={handleFieldChange}
                            values={values}
                        />
                        <LibraryPreferences
                            onChange={handleFieldChange}
                            values={values}
                        />
                        <NextUpPreferences
                            onChange={handleFieldChange}
                            values={values}
                        />
                        <ItemDetailPreferences
                            onChange={handleFieldChange}
                            values={values}
                        />

                        <Button
                            type='submit'
                            size='large'
                        >
                            {globalize.translate('Save')}
                        </Button>
                    </Stack>
                </form>
            )}
        </CinemaPage>
    );
}
