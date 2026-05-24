import { Navigate, Outlet } from 'react-router-dom';
import { useTripStore } from '../store/trip.store';

export function RequireOrigin() {
  const origin = useTripStore((s) => s.origin);
  if (!origin) return <Navigate to="/" replace />;
  return <Outlet />;
}
