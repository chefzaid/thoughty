import { useState, useRef, type ComponentPropsWithoutRef, type CSSProperties } from 'react';
import './DiaryManager.css';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import DiaryGoalField from './DiaryGoalField';
import DiaryIconPicker from './DiaryIconPicker';
import DiaryColorField from './DiaryColorField';
import type { Diary as ApiDiary, DiaryFormData } from '../../types';
import { DEFAULT_DIARY_COLORS, normalizeDiaryColor, resolveDiaryColor, withAlpha } from '../../utils/diaryColors';
import { describeDiaryGoal, diaryGoalDraft, NO_DIARY_GOAL, readDiaryGoal } from '../../utils/diaryGoals';
import { resolveLanguage } from '../../utils/language';

/** The diary fields Manage Diaries reads. */
type Diary = Pick<ApiDiary, 'id' | 'name' | 'icon' | 'color' | 'visibility' | 'isDefault' | 'goalType' | 'goalTarget'>;

const DEFAULT_NEW_DIARY_COLOR = DEFAULT_DIARY_COLORS[0] ?? '#E76F51';

interface DiaryManagerProps {
    readonly diaries: Diary[];
    readonly onCreateDiary: (data: DiaryFormData) => Promise<void>;
    readonly onUpdateDiary: (id: number, data: DiaryFormData) => Promise<void>;
    readonly onDeleteDiary: (id: number) => Promise<void>;
    readonly onSetDefault: (id: number) => Promise<void>;
    readonly onReorderDiaries: (orderedIds: number[]) => Promise<void>;
    readonly onBack: () => void;
    readonly theme?: 'light' | 'dark';
    readonly language?: string;
    readonly t: (key: string, params?: Record<string, string | number>) => string;
}

function DiaryManager({ diaries, onCreateDiary, onUpdateDiary, onDeleteDiary, onSetDefault, onReorderDiaries, onBack, theme, language, t }: DiaryManagerProps) {
    const [newDiaryName, setNewDiaryName] = useState<string>('');
    const [newDiaryIcon, setNewDiaryIcon] = useState<string>('📓');
    const [newDiaryColor, setNewDiaryColor] = useState<string>(DEFAULT_NEW_DIARY_COLOR);
    const [newDiaryVisibility, setNewDiaryVisibility] = useState<'public' | 'private'>('private');
    const [newDiaryGoal, setNewDiaryGoal] = useState(NO_DIARY_GOAL);
    const [editingDiary, setEditingDiary] = useState<Diary | null>(null);
    const [editName, setEditName] = useState<string>('');
    const [editIcon, setEditIcon] = useState<string>('');
    const [editColor, setEditColor] = useState<string>(DEFAULT_NEW_DIARY_COLOR);
    const [editVisibility, setEditVisibility] = useState<'public' | 'private'>('private');
    const [editGoal, setEditGoal] = useState(NO_DIARY_GOAL);
    /** A translation key, or a message the API sent, which `t` passes through. */
    const [error, setError] = useState<string>('');
    const [showIconPicker, setShowIconPicker] = useState<'new' | number | null>(null);
    const [diaryPendingDelete, setDiaryPendingDelete] = useState<Diary | null>(null);
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    const isLight = theme === 'light';
    const uiLanguage = resolveLanguage(language);

    const getDiaryAccentStyle = (diary: Pick<Diary, 'id' | 'name' | 'color'>): CSSProperties => {
        const diaryColor = resolveDiaryColor(diary);
        return {
            '--diary-accent': diaryColor,
            '--diary-accent-soft': withAlpha(diaryColor, isLight ? 0.14 : 0.18),
        } as CSSProperties;
    };

    const handleCreate = async (e: Parameters<NonNullable<ComponentPropsWithoutRef<'form'>['onSubmit']>>[0]) => {
        e.preventDefault();
        setError('');

        if (!newDiaryName.trim()) {
            setError('diaryNameRequired');
            return;
        }
        const goal = readDiaryGoal(newDiaryGoal, t, uiLanguage);
        if ('error' in goal) {
            setError(goal.error);
            return;
        }

        try {
            await onCreateDiary({
                name: newDiaryName.trim(),
                icon: newDiaryIcon,
                color: normalizeDiaryColor(newDiaryColor) ?? DEFAULT_NEW_DIARY_COLOR,
                visibility: newDiaryVisibility,
                ...goal.fields,
            });
            setNewDiaryName('');
            setNewDiaryIcon('📓');
            setNewDiaryColor(DEFAULT_NEW_DIARY_COLOR);
            setNewDiaryVisibility('private');
            setNewDiaryGoal(NO_DIARY_GOAL);
        } catch (err) {
            setError((err as Error).message || 'diaryCreateFailed');
        }
    };

    const handleEdit = (diary: Diary): void => {
        setEditingDiary(diary);
        setEditName(diary.name);
        setEditIcon(diary.icon);
        setEditColor(resolveDiaryColor(diary));
        setEditVisibility(diary.visibility);
        setEditGoal(diaryGoalDraft(diary.goalType, diary.goalTarget));
    };

    const handleSaveEdit = async (): Promise<void> => {
        if (!editName.trim() || !editingDiary) return;
        const goal = readDiaryGoal(editGoal, t, uiLanguage);
        if ('error' in goal) {
            setError(goal.error);
            return;
        }

        try {
            await onUpdateDiary(editingDiary.id, {
                name: editName.trim(),
                icon: editIcon,
                color: normalizeDiaryColor(editColor) ?? resolveDiaryColor(editingDiary),
                visibility: editVisibility,
                ...goal.fields,
            });
            setEditingDiary(null);
        } catch (err) {
            setError((err as Error).message || 'diaryUpdateFailed');
        }
    };

    const handleDelete = (diary: Diary): void => {
        if (diary.isDefault) {
            setError('diaryDefaultDeleteBlocked');
            return;
        }
        setDiaryPendingDelete(diary);
    };

    const confirmDelete = async (): Promise<void> => {
        if (!diaryPendingDelete) return;
        const { id } = diaryPendingDelete;
        setDiaryPendingDelete(null);
        try {
            await onDeleteDiary(id);
        } catch (err) {
            setError((err as Error).message || 'diaryDeleteFailed');
        }
    };

    const handleSetDefault = async (diary: Diary): Promise<void> => {
        try {
            await onSetDefault(diary.id);
        } catch (err) {
            setError((err as Error).message || 'diarySetDefaultFailed');
        }
    };

    const handleDragStart = (index: number): void => {
        dragItem.current = index;
    };

    const handleDragOver = (e: React.DragEvent, index: number): void => {
        e.preventDefault();
        dragOverItem.current = index;
    };

    const handleDrop = async (): Promise<void> => {
        if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
            dragItem.current = null;
            dragOverItem.current = null;
            return;
        }
        const reordered = [...diaries];
        const [removed] = reordered.splice(dragItem.current, 1);
        if (!removed) {
            return;
        }
        reordered.splice(dragOverItem.current, 0, removed);
        dragItem.current = null;
        dragOverItem.current = null;
        try {
            await onReorderDiaries(reordered.map(d => d.id));
        } catch (err) {
            setError((err as Error).message || 'diaryReorderFailed');
        }
    };

    const handleKeyboardReorder = async (index: number, direction: -1 | 1): Promise<void> => {
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= diaries.length) {
            return;
        }

        const reordered = [...diaries];
        const [movedDiary] = reordered.splice(index, 1);
        if (!movedDiary) {
            return;
        }
        reordered.splice(targetIndex, 0, movedDiary);

        try {
            await onReorderDiaries(reordered.map((diary) => diary.id));
        } catch (err) {
            setError((err as Error).message || 'diaryReorderFailed');
        }
    };

    return (
        <div className={`diary-manager ${isLight ? 'light' : 'dark'}`}>
            <div className="diary-manager-header">
                <button type="button" className="back-btn" onClick={onBack}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {t('journal')}
                </button>
                <h2>{t('manageDiaries')}</h2>
            </div>

            {error && (
                <div className="error-message">
                    {t(error)}
                    <button type="button" onClick={() => setError('')}>×</button>
                </div>
            )}

            {/* Create New Diary Form */}
            <div className="create-diary-section">
                <h3>{t('newDiary')}</h3>
                <form onSubmit={handleCreate} className="create-diary-form" noValidate>
                    <div className="form-row">
                        <DiaryIconPicker
                            icon={newDiaryIcon}
                            open={showIconPicker === 'new'}
                            onToggle={() => setShowIconPicker(showIconPicker === 'new' ? null : 'new')}
                            onPick={(icon) => {
                                setNewDiaryIcon(icon);
                                setShowIconPicker(null);
                            }}
                        />
                        <input
                            type="text"
                            value={newDiaryName}
                            onChange={(e) => setNewDiaryName(e.target.value)}
                            placeholder={t('diaryName')}
                            className="diary-name-input"
                        />
                        <DiaryColorField
                            color={newDiaryColor}
                            onChange={setNewDiaryColor}
                            label={t('diaryColor')}
                        />
                        <div className="visibility-section">
                            <span className="visibility-label">{t('defaultVisibility')}</span>
                            <div className="visibility-toggle">
                                <span className={`toggle-label ${newDiaryVisibility === 'private' ? 'active' : ''}`}>{t('private')}</span>
                                <button
                                    type="button"
                                    className={`toggle-switch ${newDiaryVisibility === 'public' ? 'public' : 'private'}`}
                                    onClick={() => setNewDiaryVisibility(newDiaryVisibility === 'private' ? 'public' : 'private')}
                                    aria-label={t('diaryVisibilityToggle')}
                                    title={t('visibilityOverrideHint')}
                                >
                                    <span className={`toggle-thumb ${newDiaryVisibility === 'public' ? 'on' : 'off'}`} />
                                </button>
                                <span className={`toggle-label ${newDiaryVisibility === 'public' ? 'active' : ''}`}>{t('public')}</span>
                            </div>
                        </div>
                        <DiaryGoalField goal={newDiaryGoal} onChange={setNewDiaryGoal} t={t} />
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
                    <ul className="diary-cards">
                        {diaries.map((diary, index) => (
                            <li
                                key={diary.id}
                                className={`diary-card ${diary.isDefault ? 'default' : ''} ${editingDiary?.id === diary.id ? 'editing' : ''}`}
                                draggable={editingDiary?.id !== diary.id}
                                onDragStart={() => handleDragStart(index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDrop={handleDrop}
                                style={getDiaryAccentStyle(diary)}
                            >
                                {editingDiary?.id === diary.id ? (
                                    <div className="edit-form">
                                        <div className="edit-row">
                                            <DiaryIconPicker
                                                icon={editIcon}
                                                open={showIconPicker === diary.id}
                                                onToggle={() => setShowIconPicker(showIconPicker === diary.id ? null : diary.id)}
                                                onPick={(icon) => {
                                                    setEditIcon(icon);
                                                    setShowIconPicker(null);
                                                }}
                                            />
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="diary-name-input"
                                            />
                                            <DiaryColorField
                                                color={editColor}
                                                onChange={setEditColor}
                                                label={t('diaryColor')}
                                            />
                                            <div className="visibility-section">
                                                <span className="visibility-label">{t('defaultVisibility')}</span>
                                                <div className="visibility-toggle">
                                                    <span className={`toggle-label ${editVisibility === 'private' ? 'active' : ''}`}>{t('private')}</span>
                                                    <button
                                                        type="button"
                                                        className={`toggle-switch ${editVisibility === 'public' ? 'public' : 'private'}`}
                                                        onClick={() => setEditVisibility(editVisibility === 'private' ? 'public' : 'private')}
                                                        aria-label={t('diaryVisibilityToggle')}
                                                        title={t('visibilityOverrideHint')}
                                                    >
                                                        <span className={`toggle-thumb ${editVisibility === 'public' ? 'on' : 'off'}`} />
                                                    </button>
                                                    <span className={`toggle-label ${editVisibility === 'public' ? 'active' : ''}`}>{t('public')}</span>
                                                </div>
                                            </div>
                                            <DiaryGoalField goal={editGoal} onChange={setEditGoal} t={t} />
                                        </div>
                                        <div className="edit-actions">
                                            <button type="button" onClick={handleSaveEdit} className="save-btn">{t('save')}</button>
                                            <button type="button" onClick={() => setEditingDiary(null)} className="cancel-btn">{t('cancel')}</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="diary-info">
                                            <button
                                                type="button"
                                                className="drag-handle"
                                                title={t('dragToReorder')}
                                                aria-label={`${diary.name} ${t('dragToReorder')}`}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'ArrowUp') {
                                                        event.preventDefault();
                                                        void handleKeyboardReorder(index, -1);
                                                    }

                                                    if (event.key === 'ArrowDown') {
                                                        event.preventDefault();
                                                        void handleKeyboardReorder(index, 1);
                                                    }
                                                }}
                                            >
                                                ⠿
                                            </button>
                                            <span className="diary-icon">{diary.icon || '📓'}</span>
                                            <div className="diary-details">
                                                <span className="diary-name-row">
                                                    <span className="diary-color-dot" />
                                                    <span className="diary-name">{diary.name}</span>
                                                </span>
                                                <span className="diary-visibility">{t('defaultVisibility')}: {t(diary.visibility)}</span>
                                                {diary.goalType && diary.goalTarget && (
                                                    <span className="diary-goal-summary">
                                                        {t('diaryGoalSummary', { goal: describeDiaryGoal(t, uiLanguage, diary.goalType, diary.goalTarget) })}
                                                    </span>
                                                )}
                                            </div>
                                            {diary.isDefault && (
                                                <span className="default-badge">{t('defaultDiary')}</span>
                                            )}
                                        </div>
                                        <div className="diary-actions">
                                            {!diary.isDefault && (
                                                <button type="button"
                                                    onClick={() => handleSetDefault(diary)}
                                                    className="action-btn set-default"
                                                    title={t('setAsDefault')}
                                                >
                                                    ☆
                                                </button>
                                            )}
                                            <button type="button"
                                                onClick={() => handleEdit(diary)}
                                                className="action-btn edit"
                                                title={t('edit')}
                                            >
                                                ✏️
                                            </button>
                                            {!diary.isDefault && (
                                                <button type="button"
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
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <ConfirmModal
                isOpen={diaryPendingDelete !== null}
                onClose={() => setDiaryPendingDelete(null)}
                onConfirm={confirmDelete}
                title={t('deleteDiary')}
                message={t('deleteDiaryMessage', { name: diaryPendingDelete?.name ?? '' })}
                theme={isLight ? 'light' : 'dark'}
                t={t}
            />
        </div>
    );
}

export default DiaryManager;
