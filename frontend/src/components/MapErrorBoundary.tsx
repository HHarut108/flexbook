import { Component, ReactNode } from 'react';
import { MapPin } from 'lucide-react';

interface Props { children: ReactNode }
interface State { crashed: boolean; error: string }

export class MapErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { crashed: false, error: '' };
  }

  static getDerivedStateFromError(err: Error): State {
    return { crashed: true, error: err.message };
  }

  render() {
    if (this.state.crashed) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-3 text-text-muted px-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-soft border border-indigo-border flex items-center justify-center">
            <MapPin size={20} className="text-indigo" />
          </div>
          <p className="text-sm font-medium text-text-primary">Map couldn't load</p>
          <p className="text-xs leading-5">
            The interactive map failed to render. Try switching back to Timeline view.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
