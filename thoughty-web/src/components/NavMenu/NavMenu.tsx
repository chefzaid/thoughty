import { useCallback, useMemo, useState } from 'react';
import './NavMenu.css';
import type { ViewType } from '../../types';
import NavGroup from './NavGroup';
import { buildNavGroups, type NavGroupId } from './navGroups';
import PrivacyBlurButton from '../PrivacyBlur/PrivacyBlurButton';
import type { PrivacyBlurState } from '../PrivacyBlur/usePrivacyBlur';
import QuickCaptureButton from '../QuickCapture/QuickCaptureButton';

interface NavMenuProps {
    readonly currentView: ViewType;
    readonly onViewChange: (view: ViewType) => void;
    readonly theme?: 'light' | 'dark';
    readonly name?: string;
    readonly avatarUrl?: string;
    readonly isEmailVerified?: boolean;
    readonly t: (key: string, params?: Record<string, string | number>) => string;
    readonly onLogout?: () => void;
    /** The privacy blur its button toggles, beside the profile. */
    readonly privacyBlur?: PrivacyBlurState;
    /** Quick capture, which its button opens, beside the privacy blur. */
    readonly quickCapture?: { readonly isOpen: boolean; readonly open: () => void };
}

function NavMenu({ currentView, onViewChange, theme, name, avatarUrl, isEmailVerified, t, onLogout, privacyBlur, quickCapture }: NavMenuProps) {
    const isLight = theme === 'light';
    const displayName = name || t('user');
    const initial = displayName.charAt(0).toUpperCase();
    const groups = useMemo(() => buildNavGroups(t), [t]);
    const [openGroup, setOpenGroup] = useState<NavGroupId | null>(null);
    const closeGroup = useCallback(() => setOpenGroup(null), []);
    const selectView = useCallback((view: ViewType) => {
        setOpenGroup(null);
        onViewChange(view);
    }, [onViewChange]);

    return (
        <nav className={`nav-menu ${isLight ? 'light' : 'dark'}`}>
            {/* Logo and App Name */}
            <div className="nav-brand">
                <img src="/thoughty-logo.svg" alt="Thoughty" className="brand-logo" />
                <span className="brand-name">Thoughty</span>
            </div>

            {/* The pages, grouped */}
            <div className="nav-items">
                {groups.map((group) => (
                    <NavGroup
                        key={group.id}
                        label={group.label}
                        icon={group.icon}
                        items={group.items}
                        currentView={currentView}
                        isOpen={openGroup === group.id}
                        onToggle={() => setOpenGroup((open) => (open === group.id ? null : group.id))}
                        onClose={closeGroup}
                        onSelect={selectView}
                    />
                ))}
            </div>

            {/* User Profile Section */}
            <div className="nav-user-section">
                {quickCapture && (
                    <QuickCaptureButton isOpen={quickCapture.isOpen} onOpen={quickCapture.open} className="nav-icon-btn nav-capture-btn" t={t} />
                )}
                {privacyBlur && <PrivacyBlurButton privacyBlur={privacyBlur} className="nav-icon-btn nav-privacy-btn" t={t} />}
                <button type="button"
                    className={`nav-profile-btn ${currentView === 'profile' ? 'active' : ''}`}
                    onClick={() => onViewChange('profile')}
                    title={t('profile')}
                >
                    <span className={`profile-avatar ${avatarUrl ? 'has-image' : ''}`}>
                        {avatarUrl ? (
                            <img src={avatarUrl} alt={displayName} className="profile-avatar-img" />
                        ) : (
                            initial
                        )}
                    </span>
                    <span className="profile-name" title={displayName}>{displayName}</span>
                    {isEmailVerified && (
                        <span className="verified-badge compact" title={t('verifiedAccount')} aria-label={t('verifiedAccount')}>
                            ✓
                        </span>
                    )}
                </button>
                {onLogout && (
                    <button type="button"
                        className="nav-icon-btn nav-logout-btn"
                        onClick={onLogout}
                        title={t('logout')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                )}
            </div>
        </nav>
    );
}

export default NavMenu;
