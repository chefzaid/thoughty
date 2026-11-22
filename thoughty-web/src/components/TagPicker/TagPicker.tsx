import { useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import TagBadge from '../TagBadge/TagBadge';
import type { TranslationFunction } from '../../types';
import { getTagMetadata, type TagMetadataMap } from '../../utils/tagMetadata';
import { mutedTextClass } from '../../utils/tintedText';

interface TagPickerProps {
    availableTags?: string[];
    selectedTags?: string[];
    tagMetadata?: TagMetadataMap;
    onChange: (tags: string[]) => void;
    allowNew?: boolean;
    placeholder: string;
    singleSelect?: boolean;
    theme?: 'light' | 'dark';
    t: TranslationFunction;
}

/** A row of the suggestion list: an existing tag, or the tag typed so far, to create. */
interface Suggestion {
    readonly kind: 'tag' | 'create';
    readonly tag: string;
}

function sortedSuggestions(availableTags: string[], selectedTags: string[], query: string, tagMetadata?: TagMetadataMap): string[] {
    const category = (tag: string) => getTagMetadata(tag, tagMetadata || {})?.category || '';
    return availableTags
        .filter(tag => tag.toLowerCase().includes(query.toLowerCase()) && !selectedTags.includes(tag))
        .sort((left, right) => category(left).localeCompare(category(right)) || left.localeCompare(right));
}

/**
 * A tag field with suggestions, following the ARIA combobox pattern: focus stays in the field, Up and
 * Down move through the list (`aria-activedescendant`), Enter picks the highlighted tag or the one typed,
 * and Escape closes the list (only then: with the list closed, Escape reaches the popover or dialog
 * around it). Picking a tag closes the list, so it never covers what comes after the field; typing,
 * Down, or a click in the field opens it again.
 */
function TagPicker({
    availableTags = [],
    selectedTags = [],
    tagMetadata,
    onChange,
    allowNew = true,
    placeholder,
    singleSelect = false,
    theme = 'dark',
    t,
}: Readonly<TagPickerProps>) {
    const [inputValue, setInputValue] = useState<string>('');
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [active, setActive] = useState<number>(-1);
    const listRef = useRef<HTMLUListElement>(null);
    const id = useId();
    const listId = `${id}-suggestions`;
    const optionId = (index: number) => `${id}-option-${index}`;

    const isLight = theme === 'light';
    const typed = inputValue.trim();
    const filteredTags = sortedSuggestions(availableTags, selectedTags, inputValue, tagMetadata);
    const offersCreate = allowNew && typed !== '' && !filteredTags.some(tag => tag.toLowerCase() === typed.toLowerCase());
    const options: Suggestion[] = [
        ...filteredTags.map((tag): Suggestion => ({ kind: 'tag', tag })),
        ...(offersCreate ? [{ kind: 'create', tag: typed } satisfies Suggestion] : []),
    ];
    const listVisible = isOpen && (inputValue !== '' || filteredTags.length > 0);
    const activeIndex = listVisible && active < options.length ? active : -1;

    // The highlighted row stays in view when the arrows move past the list's visible part
    useEffect(() => {
        if (activeIndex < 0) return;
        listRef.current?.children[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
    }, [activeIndex]);

    const close = (): void => {
        setIsOpen(false);
        setActive(-1);
    };

    const selectTag = (tag: string): void => {
        onChange(singleSelect ? [tag] : [...selectedTags, tag]);
        setInputValue('');
        close();
    };

    const createTag = (tag: string): void => {
        if (selectedTags.includes(tag)) {
            setInputValue('');
            return;
        }
        selectTag(tag);
    };

    const choose = (option: Suggestion): void => {
        if (option.kind === 'tag') selectTag(option.tag);
        else createTag(option.tag);
    };

    const pickWithEnter = (): void => {
        const highlighted = options[activeIndex];
        if (highlighted) {
            choose(highlighted);
            return;
        }
        if (!typed) return;
        const exactMatch = filteredTags.find(tag => tag.toLowerCase() === typed.toLowerCase());
        if (exactMatch) selectTag(exactMatch);
        else if (allowNew) createTag(typed);
    };

    const moveActive = (step: 1 | -1): void => {
        setIsOpen(true);
        const count = options.length;
        if (count === 0) return;
        if (activeIndex < 0) setActive(step > 0 ? 0 : count - 1);
        else setActive((activeIndex + step + count) % count);
    };

    const handleRemoveTag = (tagToRemove: string): void => {
        onChange(selectedTags.filter(tag => tag !== tagToRemove));
    };

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
        setInputValue(e.target.value);
        setIsOpen(true);
        setActive(-1);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            moveActive(e.key === 'ArrowDown' ? 1 : -1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            pickWithEnter();
        } else if (e.key === 'Escape' && listVisible) {
            // Only the list closes; a second Escape is left to the popover or dialog around the field
            e.preventDefault();
            e.stopPropagation();
            close();
        } else if (e.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
            const lastTag = selectedTags.at(-1);
            if (lastTag) handleRemoveTag(lastTag);
        }
    };

    const rowClass = (selected: boolean): string => {
        if (isLight) return selected ? 'bg-gray-100' : 'hover:bg-gray-100';
        return selected ? 'bg-gray-700' : 'hover:bg-gray-700';
    };

    return (
        <div className="relative">
            <div className={`flex min-h-10 flex-wrap items-center gap-2 rounded-lg border px-3 py-1 focus-within:ring-2 focus-within:ring-blue-500 transition-colors ${isLight ? 'bg-gray-50 border-gray-300' : 'bg-gray-900 border-gray-700'}`}>
                {selectedTags.map(tag => (
                    <TagBadge
                        key={tag}
                        tag={tag}
                        metadata={tagMetadata}
                        theme={theme}
                        showHash={false}
                        removable={true}
                        onRemove={() => handleRemoveTag(tag)}
                        removeLabel={t('removeTagNamed', { tag })}
                    />
                ))}
                <input
                    type="text"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={listVisible}
                    aria-controls={listVisible ? listId : undefined}
                    aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
                    className={`min-h-8 flex-1 min-w-[120px] outline-none bg-transparent ${isLight ? 'text-gray-900 placeholder-gray-500' : 'text-gray-100 placeholder-gray-400'}`}
                    placeholder={selectedTags.length === 0 ? placeholder : ''}
                    aria-label={placeholder}
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    onClick={() => setIsOpen(true)}
                    onBlur={close}
                    onKeyDown={handleKeyDown}
                />
            </div>

            {listVisible && (
                <ul
                    id={listId}
                    ref={listRef}
                    role="listbox"
                    aria-label={t('tagPickerSuggestions')}
                    // Choosing with the pointer (or scrolling the list) keeps focus in the field
                    onMouseDown={(event) => event.preventDefault()}
                    className={`absolute z-50 w-full mt-1 top-full left-0 max-h-60 overflow-auto border rounded-lg shadow-lg ${isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}
                >
                    {options.map((option, index) => (
                        <li
                            key={`${option.kind}-${option.tag}`}
                            id={optionId(index)}
                            role="option"
                            aria-selected={index === activeIndex}
                            onClick={() => choose(option)}
                            onMouseEnter={() => setActive(index)}
                            className={`px-4 py-2 cursor-pointer ${rowClass(index === activeIndex)} ${option.kind === 'create'
                                ? `font-medium ${isLight ? 'text-blue-700' : 'text-blue-300'}`
                                : (isLight ? 'text-gray-900' : 'text-gray-100')}`}
                        >
                            {option.kind === 'tag' ? (
                                <TagBadge tag={option.tag} metadata={tagMetadata} theme={theme} showHash={false} size="xs" />
                            ) : t('tagPickerCreate', { tag: option.tag })}
                        </li>
                    ))}
                    {options.length === 0 && (
                        <li role="option" aria-disabled="true" aria-selected={false} className={`px-4 py-2 italic ${mutedTextClass(!isLight)}`}>
                            {t('tagPickerNoTags')}
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}

export default TagPicker;
