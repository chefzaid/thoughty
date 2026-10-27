import { DEFAULT_DIARY_COLORS } from '../../utils/diaryColors';
import './DiaryColorField.css';

/** The diary color picker with the preset swatches beside it. */
export default function DiaryColorField({
    color,
    onChange,
    label,
}: Readonly<{
    color: string;
    onChange: (color: string) => void;
    label: string;
}>) {
    return (
        <div className="color-section">
            <span className="visibility-label">{label}</span>
            <div className="color-picker-row">
                <input
                    type="color"
                    value={color}
                    onChange={(event) => onChange(event.target.value.toUpperCase())}
                    className="diary-color-input"
                    aria-label={label}
                />
                <div className="diary-color-swatches">
                    {DEFAULT_DIARY_COLORS.map((swatch) => (
                        <button
                            key={swatch}
                            type="button"
                            className={`diary-color-swatch ${color === swatch ? 'selected' : ''}`}
                            style={{ backgroundColor: swatch }}
                            onClick={() => onChange(swatch)}
                            aria-label={`${label} ${swatch}`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
