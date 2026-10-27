interface SettingSwitchProps {
  /** The setting it turns on and off, sent to `handleChange` as `'true'` or `'false'`. */
  name: string;
  label: string;
  description: string;
  enabled: boolean;
  handleChange: (event: { target: { name: string; value: string } }) => void;
  /** Extra class for the row, for its layout. */
  rowClassName?: string;
}

/** A Profile setting row with an on/off switch; its state is announced, not shown by color alone. */
function SettingSwitch({ name, label, description, enabled, handleChange, rowClassName = '' }: Readonly<SettingSwitchProps>) {
  return (
    <div className={`setting-row horizontal ${rowClassName}`.trim()}>
      <div className="setting-info">
        <span className="setting-label">{label}</span>
        <span className="setting-description">{description}</span>
      </div>
      <div className="theme-switch-container setting-row-control">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          className={`theme-switch ${enabled ? 'dark' : 'light'}`}
          onClick={() => handleChange({ target: { name, value: enabled ? 'false' : 'true' } })}
          aria-label={label}
        >
          <span className={`switch-thumb ${enabled ? 'on' : 'off'}`} />
        </button>
      </div>
    </div>
  );
}

export default SettingSwitch;
