import React from 'react';

function Profile({ name, onOpenSettings }) {
    const initial = (name || 'User').charAt(0).toUpperCase();

    return (
        <div className="flex items-center gap-4 mb-8 p-4 bg-gray-800/30 rounded-xl border border-gray-700/30 backdrop-blur-sm">
            <div className="w-12 h-12 rounded-full border-2 border-blue-500 shadow-lg bg-gradient-to-br from-blue-500/60 to-purple-600/60 flex items-center justify-center text-lg font-bold text-white">
                {initial}
            </div>
            <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-100">{name}</h3>
            </div>
            <button
                onClick={onOpenSettings}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-all"
                title="Settings"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </button>
        </div>
    );
}

export default Profile;
