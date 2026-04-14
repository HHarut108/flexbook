import { useApiSwitcher } from '../store/api-switcher';
import { Database, Zap } from 'lucide-react';

export function ApiModeSwitcher() {
  const { mode, toggle } = useApiSwitcher();
  const isMockMode = mode === 'mock';

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition-all duration-200 text-sm border ${
        isMockMode
          ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 active:scale-95'
          : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 active:scale-95'
      }`}
      title={`Currently in ${isMockMode ? 'Mock Data' : 'Real API'} mode. Click to switch.`}
    >
      {isMockMode ? (
        <>
          <Database size={14} />
          <span>Mock</span>
        </>
      ) : (
        <>
          <Zap size={14} />
          <span>Live</span>
        </>
      )}
    </button>
  );
}
