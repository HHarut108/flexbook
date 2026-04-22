import { useApiSwitcher, ApiMode } from '../store/api-switcher';
import { ChevronDown, Zap, Database } from 'lucide-react';

export function ApiModeSwitcher() {
  const { mode, setMode } = useApiSwitcher();
  const isMock = mode === 'mock';

  return (
    <div
      className={`relative flex items-center gap-1.5 pl-3 pr-2 py-2 rounded-lg border text-sm font-medium transition-colors ${
        isMock
          ? 'bg-orange-50 text-orange-700 border-orange-200'
          : 'bg-green-50 text-green-700 border-green-200'
      }`}
    >
      {isMock ? <Database size={14} /> : <Zap size={14} />}
      <span>{isMock ? 'Mock' : 'Live'}</span>
      <ChevronDown size={14} className="opacity-70" />
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as ApiMode)}
        className="absolute inset-0 opacity-0 cursor-pointer"
        aria-label="Select data source"
      >
        <option value="real">Live</option>
        <option value="mock">Mock</option>
      </select>
    </div>
  );
}
