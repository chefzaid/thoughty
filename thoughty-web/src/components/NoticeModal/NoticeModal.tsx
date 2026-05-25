interface NoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  theme?: 'light' | 'dark';
  closeLabel?: string;
}

const NoticeModal = ({
  isOpen,
  onClose,
  title,
  message,
  theme = 'dark',
  closeLabel = 'Close',
}: NoticeModalProps) => {
  if (!isOpen) {
    return null;
  }

  const isLight = theme === 'light';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="notice-modal-title">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`relative z-10 w-full max-w-md mx-4 overflow-hidden rounded-2xl border shadow-2xl ${
          isLight ? 'bg-white border-amber-200' : 'bg-gray-800 border-amber-500/30'
        }`}
      >
        <div className={`px-6 py-4 border-b ${isLight ? 'border-amber-100 bg-amber-50' : 'border-gray-700 bg-amber-500/10'}`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/15 text-amber-300'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m0 3.75h.008v.008H12v-.008z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              </svg>
            </div>
            <h3 id="notice-modal-title" className={`text-lg font-semibold ${isLight ? 'text-gray-900' : 'text-gray-100'}`}>
              {title}
            </h3>
          </div>
        </div>

        <div className="px-6 py-5">
          <p className={isLight ? 'text-gray-600' : 'text-gray-300'}>{message}</p>
        </div>

        <div className={`flex justify-end px-6 py-4 border-t ${isLight ? 'border-gray-100 bg-gray-50' : 'border-gray-700 bg-gray-900/40'}`}>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              isLight
                ? 'bg-gray-900 text-white hover:bg-gray-800'
                : 'bg-amber-400 text-gray-900 hover:bg-amber-300'
            }`}
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NoticeModal;