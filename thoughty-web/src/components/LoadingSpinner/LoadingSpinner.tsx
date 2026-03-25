interface LoadingSpinnerProps {
  className?: string;
}

function LoadingSpinner({ className = '' }: Readonly<LoadingSpinnerProps>) {
  return (
    <div className={`min-h-screen flex items-center justify-center bg-gray-900 ${className}`}>
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
    </div>
  );
}

export default LoadingSpinner;
