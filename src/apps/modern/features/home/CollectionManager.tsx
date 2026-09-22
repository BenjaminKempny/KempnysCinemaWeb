import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import React, { useCallback, useEffect, useState } from 'react';

import globalize from 'lib/globalize';

import { type CinemaScope, useCinemaCollectionMutations, useCinemaItems } from './api';
import Dialog from './CinemaDialog';
import InfiniteScroll from './InfiniteScroll';
import { Artwork, RequestState } from './MediaCard';

export interface CollectionEditorOptions {
    item?: BaseItemDto;
    collectionId?: string;
}

function PickerItem({ item, checked, disabled, toggle, chip = false }: Readonly<{
    item: BaseItemDto;
    checked: boolean;
    disabled: boolean;
    toggle: (item: BaseItemDto) => void;
    chip?: boolean;
}>) {
    const onToggle = useCallback(() => toggle(item), [item, toggle]);
    if (chip) {
        return <button type='button' className='cinemaButton' disabled={disabled}
            onClick={onToggle} aria-label={globalize.translate('ButtonRemove') + ': ' + item.Name}>
            {item.Name} &times;
        </button>;
    }
    return <label className='cinemaPickerItem'>
        <input type='checkbox' checked={checked} onChange={onToggle} disabled={disabled} />
        <Artwork item={item} />
        <span>{item.Name} {item.ProductionYear && <small>({item.ProductionYear})</small>}</span>
    </label>;
}

export default function CollectionManager({ scope, options, onClose }: Readonly<{
    scope: CinemaScope;
    options: CollectionEditorOptions;
    onClose: () => void;
}>) {
    const [ selected, setSelected ] = useState<BaseItemDto[]>(options.item ? [options.item] : []);
    const [ collectionId, setCollectionId ] = useState(options.collectionId || '');
    const [ createNew, setCreateNew ] = useState(!options.item && !options.collectionId);
    const [ name, setName ] = useState('');
    const [ enableMetadata, setEnableMetadata ] = useState(true);
    const [ search, setSearch ] = useState('');
    const [ searchTerm, setSearchTerm ] = useState('');
    const [ invalidSubmission, setInvalidSubmission ] = useState(false);
    const mutations = useCinemaCollectionMutations();
    const pending = mutations.create.isPending || mutations.add.isPending;
    const failed = mutations.create.isError || mutations.add.isError;
    const canSubmit = selected.some(item => !!item.Id) && (createNew ? !!name.trim() : !!collectionId);
    const items = useCinemaItems(scope, { searchTerm });
    const collections = useCinemaItems(scope, {
        parentId: undefined,
        includeItemTypes: [BaseItemKind.BoxSet]
    }, !options.collectionId);

    useEffect(() => {
        const timer = setTimeout(() => setSearchTerm(search.trim()), 250);
        return () => clearTimeout(timer);
    }, [search]);

    const toggle = useCallback((item: BaseItemDto) => {
        setSelected(previous => previous.some(value => value.Id === item.Id) ?
            previous.filter(value => value.Id !== item.Id) : [...previous, item]);
    }, []);
    const save = useCallback((event: React.FormEvent) => {
        event.preventDefault();
        if (pending) return;
        if (!canSubmit) {
            setInvalidSubmission(true);
            return;
        }
        setInvalidSubmission(false);
        const ids = selected.map(item => item.Id).filter((id): id is string => !!id);
        if (createNew) {
            mutations.create.mutate({ name: name.trim(), ids, enableMetadata }, { onSuccess: onClose });
        } else {
            mutations.add.mutate({ collectionId, ids }, { onSuccess: onClose });
        }
    }, [selected, createNew, mutations, name, enableMetadata, onClose, collectionId, pending, canSubmit]);
    const changeCollection = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        setCreateNew(event.target.value === 'new');
    }, []);
    const selectCollection = useCallback((event: React.ChangeEvent<HTMLInputElement>) => setCollectionId(event.target.value), []);
    const changeName = useCallback((event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value), []);
    const changeMetadata = useCallback((event: React.ChangeEvent<HTMLInputElement>) => setEnableMetadata(event.target.checked), []);
    const changeSearch = useCallback((event: React.ChangeEvent<HTMLInputElement>) => setSearch(event.target.value), []);
    const retryItems = useCallback(() => {
        void (items.isFetchNextPageError ? items.fetchNextPage() : items.refetch());
    }, [items]);
    const retryCollections = useCallback(() => {
        void (collections.isFetchNextPageError ? collections.fetchNextPage() : collections.refetch());
    }, [collections]);

    return (
        <Dialog open onClose={pending ? undefined : onClose} fullWidth maxWidth='md' className='cinemaDialog'>
            <form onSubmit={save}>
                <DialogTitle>{globalize.translate(createNew ? 'NewCollection' : 'HeaderAddToCollection')}</DialogTitle>
                <DialogContent>
                    <div className='cinemaForm'>
                        {!options.collectionId && (
                            <label>
                                {globalize.translate('Collections')}
                                <select className='cinemaSelect' value={createNew ? 'new' : 'existing'} disabled={pending}
                                    onChange={changeCollection}>
                                    <option value='existing'>{globalize.translate('CinemaChooseCollection')}</option>
                                    <option value='new'>{globalize.translate('NewCollection')}</option>
                                </select>
                            </label>
                        )}
                        {!options.collectionId && !createNew && (
                            <>
                                <RequestState pending={collections.isPending} error={collections.isError} retry={retryCollections} />
                                <div className='cinemaPickerResults' role='radiogroup' aria-label={globalize.translate('Collections')}>
                                    {collections.data?.pages.flatMap(page => page.Items || []).map(item => (
                                        <label key={item.Id} className='cinemaPickerItem'>
                                            <input type='radio' name='collection' value={item.Id} checked={collectionId === item.Id}
                                                onChange={selectCollection} disabled={pending || !item.Id} />
                                            <span>{item.Name}</span>
                                        </label>
                                    ))}
                                    <InfiniteScroll query={collections} queryKey={JSON.stringify(scope)} />
                                </div>
                            </>
                        )}
                        {createNew && (
                            <>
                                <label>
                                    {globalize.translate('LabelName')}
                                    <input value={name} onChange={changeName} required maxLength={200} disabled={pending} />
                                </label>
                                <label className='cinemaCheckbox'>
                                    <input type='checkbox' checked={enableMetadata} onChange={changeMetadata} disabled={pending} />
                                    {globalize.translate('SearchForCollectionInternetMetadata')}
                                </label>
                                <p>{globalize.translate('CinemaMetadataHelp')}</p>
                            </>
                        )}
                        <p>{globalize.translate('CinemaCollectionHelp')}</p>
                        {selected.length > 0 && (
                            <div className='cinemaSelection'>
                                {selected.map(item => <PickerItem key={item.Id} item={item} checked disabled={pending} toggle={toggle} chip />)}
                            </div>
                        )}
                        <label>
                            {globalize.translate('Search')}
                            <input type='search' value={search} onChange={changeSearch} disabled={pending} />
                        </label>
                        <RequestState pending={items.isPending} error={items.isError} retry={retryItems}
                            empty={!items.isPending && !items.hasNextPage && !items.data?.pages.some(page => page.Items?.length)} />
                        <div className='cinemaPickerResults'>
                            {items.data?.pages.flatMap(page => page.Items || []).map(item => (
                                <PickerItem key={item.Id} item={item} checked={selected.some(value => value.Id === item.Id)} toggle={toggle} disabled={pending} />
                            ))}
                            <InfiniteScroll query={items} queryKey={JSON.stringify([scope, searchTerm])} />
                        </div>
                        {failed && <p role='alert'>{globalize.translate('CinemaSaveError')}</p>}
                        {invalidSubmission && !canSubmit && <p role='alert'>{globalize.translate('CinemaCompleteCollectionForm')}</p>}
                    </div>
                </DialogContent>
                <DialogActions>
                    <button className='cinemaButton' type='button' onClick={onClose} disabled={pending}>{globalize.translate('ButtonCancel')}</button>
                    <button className='cinemaButton cinemaButton-primary' type='submit'
                        disabled={pending || !canSubmit}>
                        {globalize.translate('Save')}
                    </button>
                </DialogActions>
            </form>
        </Dialog>
    );
}
