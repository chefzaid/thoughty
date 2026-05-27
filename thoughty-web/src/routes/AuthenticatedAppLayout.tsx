import type { ReactNode } from 'react';
import NavMenu from '../components/NavMenu/NavMenu';
import ConfirmModal from '../components/ConfirmModal/ConfirmModal';
import Footer from '../components/Footer/Footer';
import AiChatModal from '../components/AiChatModal/AiChatModal';
import type { ViewType, Config, Entry } from '../types';

interface AuthenticatedAppLayoutProps {
  readonly children: ReactNode;
  readonly config: Config;
  readonly currentView: ViewType;
  readonly userName: string;
  readonly avatarUrl?: string;
  readonly onViewChange: (view: ViewType) => void;
  readonly onLogout: () => void;
  readonly t: (key: string, params?: Record<string, string | number>) => string;
  readonly deleteModalOpen: boolean;
  readonly onCloseDeleteModal: () => void;
  readonly onConfirmDelete: () => void;
  readonly bulkModalOpen: boolean;
  readonly onCloseBulkModal: () => void;
  readonly onConfirmBulkDelete: () => void;
  readonly selectedCount: number;
  readonly entryToastVisible: boolean;
  readonly chatEntry: Entry | null;
  readonly onCloseChat: () => void;
  readonly onLoadChatHistory: (entryId: number) => Promise<Array<{ role: 'user' | 'assistant'; content: string }>>;
  readonly onSendChat: (entryId: number, entryContent: string, messages: { role: 'user' | 'assistant'; content: string }[]) => Promise<string | null>;
}

function AuthenticatedAppLayout({
  children,
  config,
  currentView,
  userName,
  avatarUrl,
  onViewChange,
  onLogout,
  t,
  deleteModalOpen,
  onCloseDeleteModal,
  onConfirmDelete,
  bulkModalOpen,
  onCloseBulkModal,
  onConfirmBulkDelete,
  selectedCount,
  entryToastVisible,
  chatEntry,
  onCloseChat,
  onLoadChatHistory,
  onSendChat,
}: Readonly<AuthenticatedAppLayoutProps>) {
  return (
    <div className={`min-h-screen p-4 md:p-6 lg:p-8 font-sans transition-colors duration-300 ${config.theme === 'light' ? 'bg-gray-100 text-gray-900' : 'bg-gray-900 text-gray-100'}`}>
      <div className="max-w-7xl mx-auto">
        <NavMenu
          currentView={currentView}
          onViewChange={onViewChange}
          theme={config.theme ?? 'dark'}
          name={userName}
          avatarUrl={avatarUrl}
          t={t}
          onLogout={onLogout}
        />

        <ConfirmModal
          isOpen={deleteModalOpen}
          onClose={onCloseDeleteModal}
          onConfirm={onConfirmDelete}
          title={t('deleteEntryTitle')}
          message={t('deleteEntryMessage')}
          theme={config.theme}
        />

        <ConfirmModal
          isOpen={bulkModalOpen}
          onClose={onCloseBulkModal}
          onConfirm={onConfirmBulkDelete}
          title={t('bulkDeleteTitle')}
          message={t('bulkDeleteMessage', { count: selectedCount })}
          theme={config.theme}
        />

        {entryToastVisible && (
          <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4">
            <div
              role="alert"
              aria-live="assertive"
              className={`pointer-events-auto rounded-xl border px-4 py-3 shadow-xl backdrop-blur ${config.theme === 'light' ? 'border-amber-200 bg-white/95 text-gray-900' : 'border-amber-400/30 bg-gray-800/95 text-gray-100'}`}
            >
              <p className="text-sm font-semibold text-amber-500">{t('entryNotFound')}</p>
              <p className={`mt-1 text-sm ${config.theme === 'light' ? 'text-gray-600' : 'text-gray-300'}`}>{t('entryNotFoundMessage')}</p>
            </div>
          </div>
        )}

        {chatEntry && (
          <AiChatModal
            entry={chatEntry}
            isOpen={!!chatEntry}
            onClose={onCloseChat}
            onLoadHistory={onLoadChatHistory}
            onSend={onSendChat}
            theme={config.theme}
            t={t}
          />
        )}

        {children}

        <Footer t={t} theme={config.theme ?? 'dark'} />
      </div>
    </div>
  );
}

export default AuthenticatedAppLayout;