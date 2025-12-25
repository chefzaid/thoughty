import React, { useState, useEffect, useRef } from 'react';

const TagPicker = ({
    availableTags = [],
    selectedTags = [],
    onChange,
    allowNew = true,
    placeholder = "Add tags...",
    singleSelect = false,
    theme = 'dark'
}) => {
    const [inputValue, setInputValue] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    const isLight = theme === 'light';

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredTags = availableTags.filter(tag =>
        tag.toLowerCase().includes(inputValue.toLowerCase()) &&
        !selectedTags.includes(tag)
    );

    const handleInputChange = (e) => {
        setInputValue(e.target.value);
        setIsOpen(true);
    };

    const handleSelectTag = (tag) => {
        if (singleSelect) {
            onChange([tag]);
            setInputValue('');
            setIsOpen(false);
        } else {
            onChange([...selectedTags, tag]);
            setInputValue('');
            setIsOpen(true);
        }
    };

    const handleCreateTag = () => {
        if (!inputValue.trim()) return;
        const newTag = inputValue.trim();
        if (selectedTags.includes(newTag)) {
            setInputValue('');
            return;
        }

        if (singleSelect) {
            onChange([newTag]);
        } else {
            onChange([...selectedTags, newTag]);
        }
        setInputValue('');
        setIsOpen(false);
    };

    const handleRemoveTag = (tagToRemove) => {
        onChange(selectedTags.filter(tag => tag !== tagToRemove));
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (inputValue.trim()) {
                const exactMatch = filteredTags.find(t => t.toLowerCase() === inputValue.trim().toLowerCase());
                if (exactMatch) {
                    handleSelectTag(exactMatch);
                } else if (allowNew) {
                    handleCreateTag();
                }
            }
        } else if (e.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
            handleRemoveTag(selectedTags[selectedTags.length - 1]);
        }
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <div className={`flex flex-wrap gap-2 p-2 border rounded-lg focus-within:ring-2 focus-within:ring-blue-500 transition-colors ${isLight ? 'bg-gray-50 border-gray-300' : 'bg-gray-900 border-gray-700'}`}>
                {selectedTags.map(tag => (
                    <span key={tag} className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm ${isLight ? 'bg-blue-100 text-blue-800' : 'bg-blue-900 text-blue-200'}`}>
                        {tag}
                        <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className={`font-bold ${isLight ? 'hover:text-blue-600' : 'hover:text-blue-100'}`}
                        >
                            &times;
                        </button>
                    </span>
                ))}
                <input
                    type="text"
                    className={`flex-1 min-w-[120px] outline-none bg-transparent placeholder-gray-500 ${isLight ? 'text-gray-900' : 'text-gray-100'}`}
                    placeholder={selectedTags.length === 0 ? placeholder : ''}
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                />
            </div>

            {isOpen && (inputValue || filteredTags.length > 0) && (
                <ul className={`absolute z-50 w-full mt-1 top-full left-0 max-h-60 overflow-auto border rounded-lg shadow-lg ${isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}>
                    {filteredTags.map(tag => (
                        <li
                            key={tag}
                            onClick={() => handleSelectTag(tag)}
                            className={`px-4 py-2 cursor-pointer ${isLight ? 'hover:bg-gray-100 text-gray-900' : 'hover:bg-gray-700 text-gray-100'}`}
                        >
                            {tag}
                        </li>
                    ))}
                    {allowNew && inputValue && !filteredTags.some(t => t.toLowerCase() === inputValue.toLowerCase()) && (
                        <li
                            onClick={handleCreateTag}
                            className={`px-4 py-2 cursor-pointer font-medium ${isLight ? 'hover:bg-gray-100 text-blue-600' : 'hover:bg-gray-700 text-blue-400'}`}
                        >
                            Create "{inputValue}"
                        </li>
                    )}
                    {filteredTags.length === 0 && (!allowNew || !inputValue) && (
                        <li className={`px-4 py-2 italic ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                            No tags found
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
};

export default TagPicker;
