import './DiaryIconPicker.css';

// Common emoji icons for diaries
const DIARY_ICONS = ['📓', '💭', '💤', '💖', '🎯', '✨', '🌟', '📝', '🌈', '🌙', '☀️', '🔥', '💡', '🎨', '🎵', '📚', '🌺', '🍀', '⭐', '🌸'];

/** The diary icon button and the emoji popup it opens. */
export default function DiaryIconPicker({
    icon,
    open,
    onToggle,
    onPick,
}: Readonly<{
    icon: string;
    open: boolean;
    onToggle: () => void;
    onPick: (icon: string) => void;
}>) {
    return (
        <div className="icon-picker-wrapper">
            <button type="button" className="icon-button" onClick={onToggle}>
                {icon}
            </button>
            {open && (
                <div className="icon-picker-popup">
                    {DIARY_ICONS.map((option) => (
                        <button key={option} type="button" className="icon-option" onClick={() => onPick(option)}>
                            {option}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
