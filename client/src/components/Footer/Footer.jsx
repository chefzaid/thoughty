import React from 'react';
import PropTypes from 'prop-types';

const Footer = ({ t, theme }) => {
    const year = new Date().getFullYear();
    const isLight = theme === 'light';

    return (
        <footer className={`mt-12 py-8 border-t transition-colors ${isLight ? 'border-gray-200 bg-gray-50/50' : 'border-gray-800 bg-gray-900/50'}`}>
            <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 flex flex-col items-center gap-6">
                <div className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'} flex flex-col items-center text-center gap-1`}>
                    <span>{t('copyright', { year })}</span>
                    <span>{t('madeWithLove')}</span>
                </div>

                <div className="flex gap-6">
                    <a href="/privacy" className={`text-sm hover:underline transition-colors ${isLight ? 'text-gray-500 hover:text-gray-900' : 'text-gray-400 hover:text-gray-100'}`}>
                        {t('privacy')}
                    </a>
                    <a href="/terms" className={`text-sm hover:underline transition-colors ${isLight ? 'text-gray-500 hover:text-gray-900' : 'text-gray-400 hover:text-gray-100'}`}>
                        {t('terms')}
                    </a>
                    <a href="/contact" className={`text-sm hover:underline transition-colors ${isLight ? 'text-gray-500 hover:text-gray-900' : 'text-gray-400 hover:text-gray-100'}`}>
                        {t('contact')}
                    </a>
                </div>
            </div>
        </footer>
    );
};

Footer.propTypes = {
    t: PropTypes.func.isRequired,
    theme: PropTypes.string.isRequired
};

export default Footer;
