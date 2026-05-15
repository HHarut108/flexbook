import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, Inbox, Mail, User, MapPin, Calendar, BadgeCheck, BadgeAlert, Clock } from 'lucide-react';
import { fetchUsers, AdminUser } from '../api/users';

function formatBirthday(birthday: string | null): string {
  if (!birthday) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthday);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString();
  }
  return new Date(birthday).toLocaleDateString();
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function UserCard({ user }: { user: AdminUser }) {
  return (
    <div className="req-card">
      <div className="req-card__header">
        <div className="req-card__header-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="req-card__route">
              <User size={13} className="req-card__route-icon" />
              <span className="req-card__city">{user.firstName} {user.lastName}</span>
            </div>
            <p className="req-card__route-meta">
              {user.citizenships.length} citizenship{user.citizenships.length !== 1 ? 's' : ''}
              {user.visas.length > 0 ? ` · ${user.visas.length} visa${user.visas.length !== 1 ? 's' : ''}` : ''}
            </p>
          </div>
          <div className="req-card__timestamp">
            <Clock size={11} className="req-card__timestamp-icon" />
            <span className="req-card__timestamp-text">{formatTimestamp(user.createdAt)}</span>
          </div>
        </div>
      </div>

      <div className="req-card__body">
        <div>
          <p className="req-card__section-label">Account</p>
          <div className="req-card__contact-grid">
            <div className="req-card__chip">
              <Mail size={13} className="req-card__chip-icon" />
              <span className="req-card__chip-text">{user.email}</span>
            </div>
            <div className="req-card__chip">
              {user.emailVerified ? <BadgeCheck size={13} className="req-card__chip-icon" /> : <BadgeAlert size={13} className="req-card__chip-icon" />}
              <span className="req-card__chip-text">{user.emailVerified ? 'Verified' : 'Unverified'}</span>
            </div>
            <div className="req-card__chip">
              <Calendar size={13} className="req-card__chip-icon" />
              <span className="req-card__chip-text">Born {formatBirthday(user.birthday)}</span>
            </div>
            {user.countryOfResidenceName && (
              <div className="req-card__chip">
                <MapPin size={13} className="req-card__chip-icon" />
                <span className="req-card__chip-text">Lives in {user.countryOfResidenceName}</span>
              </div>
            )}
          </div>
        </div>

        {user.citizenships.length > 0 && (
          <div>
            <p className="req-card__section-label">Citizenships</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {user.citizenships.map((c) => {
                const visasForC = user.visas.filter((v) => v.citizenshipId === c.id);
                return (
                  <div key={c.id} className="req-card__chip" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '8px 12px', gap: 4 }}>
                    <span className="req-card__chip-text">
                      <strong>{c.countryName}</strong>{c.isPrimary ? ' · Primary' : ''}
                      {c.documentNumber ? ` · ${c.documentNumber}` : ''}
                    </span>
                    {visasForC.length > 0 && (
                      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, opacity: 0.8 }}>
                        {visasForC.map((v) => (
                          <li key={v.id}>
                            {v.countryName}
                            {v.visaType ? ` · ${v.visaType}` : ''}
                            {v.documentNumber ? ` · #${v.documentNumber}` : ''}
                            {v.validUntil ? ` · until ${v.validUntil}` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <h1 className="admin-page__title">Registered Users</h1>
          <p className="admin-page__subtitle">
            {loading ? '—' : `${users.length} user${users.length !== 1 ? 's' : ''} registered`}
          </p>
        </div>
        <button className="admin-btn admin-btn--ghost" onClick={load} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="req-error">
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      {loading && users.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="admin-card admin-spin" style={{ height: '180px', opacity: 0.4 }} />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="admin-card req-empty">
          <Inbox size={40} className="req-empty__icon" />
          <p className="req-empty__title">No registered users yet</p>
          <p className="req-empty__sub">New sign-ups will appear here.</p>
        </div>
      ) : (
        users.map((u) => <UserCard key={u.id} user={u} />)
      )}
    </div>
  );
}
