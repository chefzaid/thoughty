import { useState, useEffect, useCallback, useRef } from 'react';
import type { ChangeEvent } from 'react';
import type { TranslationFunction, ProfileConfig } from './types';
import { useApiServices } from '../../hooks/useAppState';
import './AISection.css';

interface AISectionProps {
  localConfig: ProfileConfig;
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | { target: { name: string; value: string } }) => void;
  t: TranslationFunction;
}

interface OpenRouterModel {
  id: string;
  name: string;
}

const TASK_MODEL_FIELDS: ReadonlyArray<{ name: keyof ProfileConfig; labelKey: string }> = [
  { name: 'openRouterTagModel', labelKey: 'openRouterTagModel' },
  { name: 'openRouterWritingModel', labelKey: 'openRouterWritingModel' },
  { name: 'openRouterChatModel', labelKey: 'openRouterChatModel' },
  { name: 'openRouterToneModel', labelKey: 'openRouterToneModel' },
  { name: 'openRouterBookModel', labelKey: 'openRouterBookModel' },
];

function AISection({
  localConfig,
  handleChange,
  t
}: Readonly<AISectionProps>) {
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { aiService } = useApiServices();

  const loadModels = useCallback(async () => {
    if (models.length > 0) return;
    setLoadingModels(true);
    try {
      const fetched = await aiService.fetchModels();
      setModels(fetched);
    } catch {
      // Server may not have an API key configured
    } finally {
      setLoadingModels(false);
    }
  }, [aiService, models.length]);

  useEffect(() => {
    if (models.length === 0) {
      void loadModels();
    }
  }, [loadModels, models.length]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredModels = modelSearch
    ? models.filter(m =>
        m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
        m.name.toLowerCase().includes(modelSearch.toLowerCase())
      )
    : models;

  const getModelDisplayName = (modelId?: string) => {
    if (!modelId) return 'openai/gpt-4o-mini';
    return models.find(m => m.id === modelId)?.name || modelId;
  };

  const selectedModelName = getModelDisplayName(localConfig.openRouterModel);

  const handleSelectModel = (name: string, modelId: string) => {
    handleChange({ target: { name, value: modelId } });
    setShowDropdown(false);
    setModelSearch('');
  };

  return (
    <div className="profile-section">
      <div className="section-header">
        <svg xmlns="http://www.w3.org/2000/svg" className="section-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
        </svg>
        <h3 className="section-title">{t('aiConfiguration')}</h3>
      </div>
      <div className="section-content">
        <div className="ai-settings-row">
          <div className="ai-setting-field ai-setting-model" ref={dropdownRef}>
            <label className="setting-label">{t('openRouterModel')}</label>
            {models.length > 0 ? (
              <div className="model-dropdown-container">
                <button
                  type="button"
                  className={`setting-input model-dropdown-trigger ${localConfig.theme === 'light' ? 'light' : 'dark'}`}
                  onClick={() => setShowDropdown(!showDropdown)}
                >
                  <span className="model-dropdown-text">
                    {localConfig.openRouterModel
                      ? selectedModelName
                      : 'openai/gpt-4o-mini'}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" className="model-dropdown-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showDropdown && (
                  <div className={`model-dropdown-panel ${localConfig.theme === 'light' ? 'light' : 'dark'}`}>
                    <input
                      type="text"
                      className={`model-dropdown-search ${localConfig.theme === 'light' ? 'light' : 'dark'}`}
                      placeholder={t('searchModels')}
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      autoFocus
                    />
                    <div className="model-dropdown-list">
                      {filteredModels.length === 0 ? (
                        <div className="model-dropdown-empty">{t('noModelsFound')}</div>
                      ) : (
                        filteredModels.map((model) => (
                          <button
                            key={model.id}
                            type="button"
                            className={`model-dropdown-item ${model.id === localConfig.openRouterModel ? 'selected' : ''}`}
                            onClick={() => handleSelectModel('openRouterModel', model.id)}
                          >
                            <span className="model-dropdown-item-name">{model.name}</span>
                            <span className="model-dropdown-item-id">{model.id}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="model-input-container">
                <input
                  type="text"
                  name="openRouterModel"
                  value={localConfig.openRouterModel || ''}
                  onChange={handleChange}
                  placeholder="openai/gpt-4o-mini"
                  className={`setting-input ${localConfig.theme === 'light' ? 'light' : 'dark'}`}
                />
                {loadingModels && (
                  <span className="model-loading-indicator">{t('loadingModels')}</span>
                )}
              </div>
            )}
          </div>
          <div className="ai-setting-field ai-setting-maxtags">
            <label className="setting-label">{t('autoTagMaxTags')}</label>
            <input
              type="number"
              min="0"
              max="10"
              name="autoTagMaxTags"
              value={localConfig.autoTagMaxTags ?? '0'}
              onChange={handleChange}
              className={`setting-input ${localConfig.theme === 'light' ? 'light' : 'dark'}`}
            />
          </div>
        </div>
        <div className="ai-task-models">
          <div>
            <h4 className="ai-task-models-title">{t('openRouterTaskModels')}</h4>
            <p className="ai-task-models-description">{t('openRouterTaskModelsDescription')}</p>
          </div>
          <div className="ai-task-model-grid">
            {TASK_MODEL_FIELDS.map((field) => (
              <label key={field.name} className="ai-task-model-field">
                <span className="setting-label">{t(field.labelKey)}</span>
                {models.length > 0 ? (
                  <select
                    name={field.name}
                    value={String(localConfig[field.name] || '')}
                    onChange={handleChange}
                    className={`setting-input ${localConfig.theme === 'light' ? 'light' : 'dark'}`}
                  >
                    <option value="">{t('inheritDefaultModel')}</option>
                    {models.map((model) => (
                      <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    name={field.name}
                    value={String(localConfig[field.name] || '')}
                    onChange={handleChange}
                    placeholder={t('inheritDefaultModel')}
                    className={`setting-input ${localConfig.theme === 'light' ? 'light' : 'dark'}`}
                  />
                )}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AISection;
