import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, AlertCircle, Inbox, Search, ChevronRight, ChevronDown, BadgeCheck, BadgeAlert } from 'lucide-react';
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

function countryFlag(code: string | null): string {
  if (!code || code.length !== 2) return '';
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(c.charCodeAt(0) + 127397));
}

function UserDetail({ user }: { user: AdminUser }) {
  return (
    <div className="users-detail">
      <div className="users-detail__grid">
        <div className="users-detail__field"><span className="users-detail__label">Full name</span><span>{user.firstName} {user.lastName}</span></div>
        <div className="users-detail__field"><span className="users-detail__label">Email</span><span>{user.email}</span></div>
        <div className="users-detail__field"><span className="users-detail__label">Email verified</span><span>{user.emailVerified ? 'Yes' : 'No'}</span></div>
        <div className="users-detail__field"><span className="users-detail__label">Date of birth</span><span>{formatBirthday(user.birthday)}</span></div>
        <div className="users-detail__field"><span className="users-detail__label">Country of residence</span><span>{user.countryOfResidenceName ? `${countryFlag(user.countryOfResidenceCode)} ${user.countryOfResidenceName}` : '—'}</span></div>
        <div className="users-detail__field"><span className="users-detail__label">Registered</span><span>{formatTimestamp(user.createdAt)}</span></div>
        <div className="users-detail__field"><span className="users-detail__label">User ID</span><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{user.id}</span></div>
      </div>

      {user.citizenships.length === 0 ? (
        <div className="users-detail__section">
          <h4 className="users-detail__h">Citizenships</h4>
          <p className="users-detail__empty">No citizenships on file.</p>
        </div>
      ) : (
        user.citizenships.map((c) => {
          const visasForC = user.visas.filter((v) => v.citizenshipId === c.id);
          return (
            <div key={c.id} className="users-detail__section">
              <h4 className="users-detail__h">
                {countryFlag(c.countryCode)} {c.countryName} passport
                {c.isPrimary && <span className="users-detail__badge">Primary</span>}
              </h4>
              <div className="users-detail__grid">
                <div className="users-detail__field"><span className="users-detail__label">Passport / ID number</span><span>{c.documentNumber || '—'}</span></div>
              </div>

              {visasForC.length === 0 ? (
                <p className="users-detail__empty" style={{ marginTop: 8 }}>No visas on this passport.</p>
              ) : (
                <table className="users-visa-table">
                  <thead>
                    <tr>
                      <th>Destination</th>
                      <th>Type</th>
                      <th>Sticker #</th>
                      <th>Start</th>
                      <th>Expires</th>
                      <th>Entries</th>
                      <th>Issued by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visasForC.map((v) => (
                      <tr key={v.id}>
                        <td>{countryFlag(v.countryCode)} {v.countryName}</td>
                        <td>{v.visaType || '—'}</td>
                        <td>{v.stickerNumber || '—'}</td>
                        <td>{v.startDate || '—'}</td>
                        <td>{v.expirationDate || '—'}</td>
                        <td>{v.entries ? v.entries.charAt(0).toUpperCase() + v.entries.slice(1) : '—'}</td>
                        <td>{v.issuedByCountryName ? `${countryFlag(v.issuedByCountryCode)} ${v.issuedByCountryName}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

export function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      u.email.toLowerCase().includes(q)
      || u.firstName.toLowerCase().includes(q)
      || u.lastName.toLowerCase().includes(q)
      || (u.countryOfResidenceName ?? '').toLowerCase().includes(q)
      || u.citizenships.some((c) => c.countryName.toLowerCase().includes(q))
    );
  }, [users, search]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <h1 className="admin-page__title">Registered Users</h1>
          <p className="admin-page__subtitle">
            {loading ? '—' : `${filtered.length} of ${users.length} user${users.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className="admin-btn admin-btn--ghost" onClick={load} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="users-search">
        <Search size={14} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, country…"
        />
      </div>

      {error && (
        <div className="req-error">
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      {loading && users.length === 0 ? (
        <div className="admin-card admin-spin" style={{ height: '180px', opacity: 0.4 }} />
      ) : filtered.length === 0 ? (
        <div className="admin-card req-empty">
          <Inbox size={40} className="req-empty__icon" />
          <p className="req-empty__title">{users.length === 0 ? 'No registered users yet' : 'No users match this search'}</p>
          <p className="req-empty__sub">{users.length === 0 ? 'New sign-ups will appear here.' : 'Try a different search.'}</p>
        </div>
      ) : (
        <div className="admin-table-wrap users-table-wrap">
          <table className="admin-table users-table">
            <thead>
              <tr>
                <th className="admin-table__th users-table__th--left" style={{ width: 28 }}></th>
                <th className="admin-table__th users-table__th--left">Name</th>
                <th className="admin-table__th users-table__th--left">Email</th>
                <th className="admin-table__th">Verified</th>
                <th className="admin-table__th users-table__th--left">Residence</th>
                <th className="admin-table__th">Citizenships</th>
                <th className="admin-table__th">Visas</th>
                <th className="admin-table__th users-table__th--left">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const isOpen = expanded.has(u.id);
                return (
                  <>
                    <tr
                      key={u.id}
                      className="admin-table__row users-table__row"
                      onClick={() => toggle(u.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="admin-table__td users-table__td--left" style={{ paddingRight: 0 }}>
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="admin-table__td users-table__td--left">
                        <strong>{u.firstName} {u.lastName}</strong>
                      </td>
                      <td className="admin-table__td users-table__td--left">{u.email}</td>
                      <td className="admin-table__td" style={{ textAlign: 'center' }}>
                        {u.emailVerified
                          ? <BadgeCheck size={14} style={{ color: '#10b981' }} />
                          : <BadgeAlert size={14} style={{ color: '#f59e0b' }} />}
                      </td>
                      <td className="admin-table__td users-table__td--left">
                        {u.countryOfResidenceName ? `${countryFlag(u.countryOfResidenceCode)} ${u.countryOfResidenceName}` : '—'}
                      </td>
                      <td className={`admin-table__td ${u.citizenships.length === 0 ? 'admin-table__td--zero' : ''}`}>
                        {u.citizenships.length}
                      </td>
                      <td className={`admin-table__td ${u.visas.length === 0 ? 'admin-table__td--zero' : ''}`}>
                        {u.visas.length}
                      </td>
                      <td className="admin-table__td users-table__td--left admin-table__td--date">
                        {formatTimestamp(u.createdAt)}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${u.id}-detail`} className="users-table__detail-row">
                        <td colSpan={8} style={{ padding: 0 }}>
                          <UserDetail user={u} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
