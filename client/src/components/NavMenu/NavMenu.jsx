import React from 'react';
import PropTypes from 'prop-types';
import './NavMenu.css';

function NavMenu({ currentView, onViewChange, theme, name, t }) {
    const initial = (name || t('user')).charAt(0).toUpperCase();
    const isLight = theme === 'light';

    return (
        <nav className={`nav-menu ${isLight ? 'light' : 'dark'}`}>
            {/* Logo and App Name */}
            <div className="nav-brand">
                <img src="/thoughty-logo.svg" alt="Thoughty" className="brand-logo" />
                <span className="brand-name">Thoughty</span>
            </div>

            {/* Navigation Items */}
            <div className="nav-items">
                <button
                    className={`nav-item ${currentView === 'journal' ? 'active' : ''}`}
                    onClick={() => onViewChange('journal')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    {t('journal')}
                </button>
                <button
                    className={`nav-item ${currentView === 'stats' ? 'active' : ''}`}
                    onClick={() => onViewChange('stats')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    {t('stats')}
                </button>
                <button
                    className={`nav-item ${currentView === 'importExport' ? 'active' : ''}`}
                    onClick={() => onViewChange('importExport')}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    {t('importExport')}
                </button>
            </div>

            {/* User Profile Section */}
            <button
                className={`nav-profile-btn ${currentView === 'profile' ? 'active' : ''}`}
                onClick={() => onViewChange('profile')}
                title={t('profile')}
            >
                <div className="profile-avatar">
                    {initial}
                </div>
                <span className="profile-name">{name || t('user')}</span>
            </button>
        </nav>
    );
}

NavMenu.propTypes = {
    currentView: PropTypes.string.isRequired,
    onViewChange: PropTypes.func.isRequired,
    theme: PropTypes.string,
    name: PropTypes.string,
    t: PropTypes.func.isRequired
};

export default NavMenu;
