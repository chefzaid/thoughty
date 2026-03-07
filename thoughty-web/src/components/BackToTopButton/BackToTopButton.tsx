import React from 'react';

interface BackToTopButtonProps {
  t: (key: string, params?: Record<string, string | number>) => string;
}

const BackToTopButton: React.FC<BackToTopButtonProps> = ({ t }) => {
  return (
    <div className="flex justify-center mt-6 mb-8">
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="text-sm text-gray-400 hover:text-blue-500 transition-colors flex items-center gap-1 group"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-4 w-4 transform group-hover:-translate-y-1 transition-transform" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
        {t('backToTop')}
      </button>
    </div>
  );
};

export default BackToTopButton;
