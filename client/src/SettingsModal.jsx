import React, { useState, useEffect } from 'react';

function SettingsModal({ isOpen, onClose, config, onUpdateConfig }) {
    const [localConfig, setLocalConfig] = useState(config);

    useEffect(() => {
        setLocalConfig(config);
    }, [config]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        setLocalConfig({ ...localConfig, [e.target.name]: e.target.value });
    };

    const handleSave = () => {
        onUpdateConfig(localConfig);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 w-full max-w-md shadow-2xl">
                <h2 className="text-xl font-bold text-gray-100 mb-4">Settings</h2>

                <div className="space-y-4">
                    {/* Journal File Path input removed as requested */}

                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Profile Name</label>
                        <input
                            type="text"
                            name="profileName"
                            value={localConfig.profileName || ''}
                            onChange={handleChange}
                            className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-gray-100 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="text-gray-300">Theme</span>
                        <select
                            name="theme"
                            value={localConfig.theme || 'dark'}
                            onChange={handleChange}
                            className="bg-gray-900 border border-gray-700 rounded p-2 text-gray-100 outline-none"
                        >
                            <option value="dark">Dark</option>
                            <option value="light">Light</option>
                        </select>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-400 hover:text-gray-200"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SettingsModal;
