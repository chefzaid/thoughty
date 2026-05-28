export function getVisibilityButtonClass(visibility: 'public' | 'private', theme?: 'light' | 'dark'): string {
  if (visibility === 'public') {
    return 'border-green-500 bg-green-500/10 text-green-500';
  }

  return theme === 'light'
    ? 'border-gray-300 bg-gray-50 text-gray-500'
    : 'border-gray-600 bg-gray-800 text-gray-400';
}