import React, { useState, useEffect } from 'react';
import './DiaryManager.css';

// Common emoji icons for diaries
const DIARY_ICONS = ['📓', '💭', '💤', '💖', '🎯', '✨', '🌟', '📝', '🌈', '🌙', '☀️', '🔥', '💡', '🎨', '🎵', '📚', '🌺', '🍀', '⭐', '🌸'];

function DiaryManager({ diaries, onCreateDiary, onUpdateDiary, onDeleteDiary, onSetDefault, onBack, theme, t }) {
    const [newDiaryName, setNewDiaryName] = useState('');
    const [newDiaryIcon, setNewDiaryIcon] = useState('📓');
    const [newDiaryVisibility, setNewDiaryVisibility] = useState('private');
    const [editingDiary, setEditingDiary] = useState(null);
    const [editName, setEditName] = useState('');
    const [editIcon, setEditIcon] = useState('');
    const [editVisibility, setEditVisibility] = useState('private');
    const [error, setError] = useState('');
    const [showIconPicker, setShowIconPicker] = useState(null); // 'new' or diary.id

    const isLight = theme === 'light';

    const handleCreate = async (e) => {
        e.preventDefault();
        setError('');

        if (!newDiaryName.trim()) {
            setError(t('diaryName') + ' is required');
            return;
        }

        try {
            await onCreateDiary({
                name: newDiaryName.trim(),
                icon: newDiaryIcon,
                visibility: newDiaryVisibility
            });
            setNewDiaryName('');
            setNewDiaryIcon('📓');
            setNewDiaryVisibility('private');
        } catch (err) {
            setError(err.message || 'Failed to create diary');
        }
    };

    const handleEdit = (diary) => {
        setEditingDiary(diary);
        setEditName(diary.name);
        setEditIcon(diary.icon);
        setEditVisibility(diary.visibility);
    };

    const handleSaveEdit = async () => {
        if (!editName.trim()) return;

        try {
            await onUpdateDiary(editingDiary.id, {
                name: editName.trim(),
                icon: editIcon,
                visibility: editVisibility
            });
            setEditingDiary(null);
        } catch (err) {
            setError(err.message || 'Failed to update diary');
        }
    };

    const handleDelete = async (diary) => {
        if (diary.is_default) {
            setError('Cannot delete the default diary');
            return;
        }
        if (window.confirm(`${t('deleteDiary')}? ${t('deleteDiaryWarning')}`)) {
            try {
                await onDeleteDiary(diary.id);
            } catch (err) {
                setError(err.message || 'Failed to delete diary');
            }
        }
    };

    const handleSetDefault = async (diary) => {
        try {
            await onSetDefault(diary.id);
        } catch (err) {
            setError(err.message || 'Failed to set default diary');
        }
    };

    return (
        <div className={`diary-manager ${isLight ? 'light' : 'dark'}`}>
            <div className="diary-manager-header">
                <button className="back-btn" onClick={onBack}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {t('journal')}
                </button>
                <h2>{t('manageDiaries')}</h2>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                    <button onClick={() => setError('')}>×</button>
                </div>
            )}

            {/* Create New Diary Form */}
            <div className="create-diary-section">
                <h3>{t('newDiary')}</h3>
                <form onSubmit={handleCreate} className="create-diary-form">
                    <div className="form-row">
                        <div className="icon-picker-wrapper">
                            <button
                                type="button"
                                className="icon-button"
                                onClick={() => setShowIconPicker(showIconPicker === 'new' ? null : 'new')}
                            >
                                {newDiaryIcon}
                            </button>
                            {showIconPicker === 'new' && (
                                <div className="icon-picker-popup">
                                    {DIARY_ICONS.map(icon => (
                                        <button
                                            key={icon}
                                            type="button"
                                            className="icon-option"
                                            onClick={() => {
                                                setNewDiaryIcon(icon);
                                                setShowIconPicker(null);
                                            }}
                                        >
                                            {icon}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <input
                            type="text"
                            value={newDiaryName}
                            onChange={(e) => setNewDiaryName(e.target.value)}
                            placeholder={t('diaryName')}
                            className="diary-name-input"
                        />
                        <div className="visibility-section">
                            <span className="visibility-label">{t('defaultVisibility')}</span>
                            <div className="visibility-toggle">
                                <span className={`toggle-label ${newDiaryVisibility === 'private' ? 'active' : ''}`}>{t('private')}</span>
                                <button
                                    type="button"
                                    className={`toggle-switch ${newDiaryVisibility === 'public' ? 'public' : 'private'}`}
                                    onClick={() => setNewDiaryVisibility(newDiaryVisibility === 'private' ? 'public' : 'private')}
                                    aria-label="Toggle visibility"
                                    title={t('visibilityOverrideHint')}
                                >
                                    <span className={`toggle-thumb ${newDiaryVisibility === 'public' ? 'on' : 'off'}`} />
                                </button>
                                <span className={`toggle-label ${newDiaryVisibility === 'public' ? 'active' : ''}`}>{t('public')}</span>
                            </div>
                        </div>
                        <button type="submit" className="create-btn">
                            {t('createDiary')}
                        </button>
                    </div>
                </form>
            </div>

            {/* Diaries List */}
            <div className="diaries-list">
                <h3>{t('diaries')}</h3>
                {diaries.length === 0 ? (
                    <p className="no-diaries">{t('noDiaries')}</p>
                ) : (
                    <div className="diary-cards">
                        {diaries.map(diary => (
                            <div
                                key={diary.id}
                                className={`diary-card ${diary.is_default ? 'default' : ''} ${editingDiary?.id === diary.id ? 'editing' : ''}`}
                            >
                                {editingDiary?.id === diary.id ? (
                                    <div className="edit-form">
                                        <div className="edit-row">
                                            <div className="icon-picker-wrapper">
                                                <button
                                                    type="button"
                                                    className="icon-button"
                                                    onClick={() => setShowIconPicker(showIconPicker === diary.id ? null : diary.id)}
                                                >
                                                    {editIcon}
                                                </button>
                                                {showIconPicker === diary.id && (
                                                    <div className="icon-picker-popup">
                                                        {DIARY_ICONS.map(icon => (
                                                            <button
                                                                key={icon}
                                                                type="button"
                                                                className="icon-option"
                                                                onClick={() => {
                                                                    setEditIcon(icon);
                                                                    setShowIconPicker(null);
                                                                }}
                                                            >
                                                                {icon}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="diary-name-input"
                                            />
                                            <div className="visibility-section">
                                                <span className="visibility-label">{t('defaultVisibility')}</span>
                                                <div className="visibility-toggle">
                                                    <span className={`toggle-label ${editVisibility === 'private' ? 'active' : ''}`}>{t('private')}</span>
                                                    <button
                                                        type="button"
                                                        className={`toggle-switch ${editVisibility === 'public' ? 'public' : 'private'}`}
                                                        onClick={() => setEditVisibility(editVisibility === 'private' ? 'public' : 'private')}
                                                        aria-label="Toggle visibility"
                                                        title={t('visibilityOverrideHint')}
                                                    >
                                                        <span className={`toggle-thumb ${editVisibility === 'public' ? 'on' : 'off'}`} />
                                                    </button>
                                                    <span className={`toggle-label ${editVisibility === 'public' ? 'active' : ''}`}>{t('public')}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="edit-actions">
                                            <button onClick={handleSaveEdit} className="save-btn">{t('save')}</button>
                                            <button onClick={() => setEditingDiary(null)} className="cancel-btn">{t('cancel')}</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="diary-info">
                                            <span className="diary-icon">{diary.icon || '📓'}</span>
                                            <div className="diary-details">
                                                <span className="diary-name">{diary.name}</span>
                                                <span className="diary-visibility">{t('defaultVisibility')}: {t(diary.visibility)}</span>
                                            </div>
                                            {diary.is_default && (
                                                <span className="default-badge">{t('defaultDiary')}</span>
                                            )}
                                        </div>
                                        <div className="diary-actions">
                                            {!diary.is_default && (
                                                <button
                                                    onClick={() => handleSetDefault(diary)}
                                                    className="action-btn set-default"
                                                    title={t('setAsDefault')}
                                                >
                                                    ☆
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleEdit(diary)}
                                                className="action-btn edit"
                                                title={t('edit')}
                                            >
                                                ✏️
                                            </button>
                                            {!diary.is_default && (
                                                <button
                                                    onClick={() => handleDelete(diary)}
                                                    className="action-btn delete"
                                                    title={t('delete')}
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default DiaryManager;
