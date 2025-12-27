import React from 'react';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, theme = 'dark', t }) => {
    if (!isOpen) return null;

    const isLight = theme === 'light';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className={`relative z-10 w-full max-w-md mx-4 p-6 rounded-xl shadow-2xl border ${isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'}`}>
                <h3 className={`text-lg font-semibold mb-3 ${isLight ? 'text-gray-900' : 'text-gray-100'}`}>
                    {title}
                </h3>
                <p className={`mb-6 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                    {message}
                </p>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${isLight ? 'bg-gray-100 hover:bg-gray-200 text-gray-700' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                    >
                        {t ? t('cancel') : 'Cancel'}
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                    >
                        {t ? t('delete') : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
