import { useRef, type ReactNode } from 'react';
import NavMenu from '../components/NavMenu/NavMenu';
import AutoDismiss from '../components/AutoDismiss/AutoDismiss';
import ConfirmModal from '../components/ConfirmModal/ConfirmModal';
import Footer from '../components/Footer/Footer';
import AiChatModal from '../components/AiChatModal/AiChatModal';
import type { ViewType, Config, Entry } from '../types';
import { normalizeFontSize, resolveFontFamily } from '../types/config';
import { useRouteChangeFocus } from '../hooks/useRouteChangeFocus';
import { resolveLanguage } from '../utils/language';
import { pluralPhrase } from '../utils/pluralPhrase';
import type { TransientMessage } from '../hooks/useTransientMessage';

interface AuthenticatedAppLayoutProps {
  readonly children: ReactNode;
  readonly config: Config;
  readonly currentView: ViewType;
  readonly userName: string;
  readonly avatarUrl?: string;
  readonly isEmailVerified?: boolean;
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
  readonly entryToast: TransientMessage;
  /** The outcome of an entry action, such as a failed save or a bulk summary. */
  readonly notice: TransientMessage;
  readonly noticeText: string;
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
  isEmailVerified,
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
  entryToast,
  notice,
  noticeText,
  chatEntry,
  onCloseChat,
  onLoadChatHistory,
  onSendChat,
}: Readonly<AuthenticatedAppLayoutProps>) {
  const mainContentRef = useRef<HTMLElement>(null);
  const appTypographyStyle = {
    fontFamily: resolveFontFamily(config.fontFamily),
    fontSize: `${normalizeFontSize(config.fontSize)}px`,
  };

  useRouteChangeFocus(currentView, mainContentRef);
  const isLight = config.theme === 'light';
  const toastClassName = `pointer-events-auto rounded-xl border px-4 py-3 shadow-xl backdrop-blur ${isLight ? 'border-amber-200 bg-white/95 text-gray-900' : 'border-amber-400/30 bg-gray-800/95 text-gray-100'}`;
  const toastTextClassName = isLight ? 'text-gray-600' : 'text-gray-300';

  const focusMainContent = () => {
    document.getElementById('main-content')?.focus();
  };

  return (
    <div
      className={`min-h-screen p-4 md:p-6 lg:p-8 font-sans transition-colors duration-300 ${config.theme === 'light' ? 'bg-gray-100 text-gray-900' : 'bg-gray-900 text-gray-100'}`}
      style={appTypographyStyle}
    >
      <a href="#main-content" className="skip-link" onClick={focusMainContent}>
        {t('skipToContent')}
      </a>
      <div className="max-w-7xl mx-auto">
        <NavMenu
          currentView={currentView}
          onViewChange={onViewChange}
          theme={config.theme ?? 'dark'}
          name={userName}
          avatarUrl={avatarUrl}
          isEmailVerified={isEmailVerified}
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
          t={t}
        />

        <ConfirmModal
          isOpen={bulkModalOpen}
          onClose={onCloseBulkModal}
          onConfirm={onConfirmBulkDelete}
          title={t('bulkDeleteTitle')}
          message={pluralPhrase(t, 'bulkDeleteMessage', selectedCount, resolveLanguage(config.language))}
          theme={config.theme}
          t={t}
        />

        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
          <AutoDismiss message={entryToast} durationMs={4000}>
            <div role="alert" aria-live="assertive" className={toastClassName}>
              <p className="text-sm font-semibold text-amber-500">{t('entryNotFound')}</p>
              <p className={`mt-1 text-sm ${toastTextClassName}`}>{t('entryNotFoundMessage')}</p>
            </div>
          </AutoDismiss>
          <AutoDismiss message={notice} durationMs={6000}>
            <div role="alert" aria-live="assertive" className={toastClassName}>
              <p className="text-sm font-medium">{noticeText}</p>
            </div>
          </AutoDismiss>
        </div>

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

        <main id="main-content" ref={mainContentRef} tabIndex={-1}>
          {children}
        </main>

        <Footer t={t} theme={config.theme ?? 'dark'} />
      </div>
    </div>
  );
}

export default AuthenticatedAppLayout;
