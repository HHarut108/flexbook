import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { RefreshCw, AlertCircle, Inbox, Search, X, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import { fetchUsers, AdminUser } from '../api/users';

type SortKey = 'createdAt' | 'name' | 'email' | 'lastLoginAt';
type SortDir = 'asc' | 'desc';

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

function formatLastLogin(iso: string | null): string {
  if (!iso) return 'Never';
  return formatTimestamp(iso);
}

function formatGender(g?: string | null): string {
  if (!g) return '—';
  return {
    male: 'Male',
    female: 'Female',
    other: 'Other',
    prefer_not_to_say: 'Prefer not to say',
  }[g] ?? g;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="users-copy-btn"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      aria-label="Copy user ID"
      title="Copy user ID"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  );
}

export function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [citizenshipFilter, setCitizenshipFilter] = useState<string>('');
  const [genderFilter, setGenderFilter] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
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

  // Distinct citizenship countries across all users — populates the filter pill row.
  const citizenshipOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of users) {
      for (const c of u.citizenships) map.set(c.countryCode, c.countryName);
    }
    return Array.from(map.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = users.filter((u) => {
      if (q) {
        const hay = `${u.firstName} ${u.lastName} ${u.email} ${u.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (citizenshipFilter && !u.citizenships.some((c) => c.countryCode === citizenshipFilter)) return false;
      if (genderFilter && (u.gender ?? '') !== genderFilter) return false;
      return true;
    });
    out.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'createdAt') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortKey === 'name') cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      else if (sortKey === 'lastLoginAt') {
        // Users who never logged in sort to the very bottom regardless of direction.
        const av = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : -Infinity;
        const bv = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : -Infinity;
        cmp = av - bv;
      }
      else cmp = a.email.localeCompare(b.email);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return out;
  }, [users, search, citizenshipFilter, genderFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'createdAt' ? 'desc' : 'asc'); }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function clearFilters() {
    setSearch(''); setCitizenshipFilter(''); setGenderFilter('');
  }

  const hasActiveFilters = search || citizenshipFilter || genderFilter;

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <h1 className="admin-page__title">Registered Users</h1>
          <p className="admin-page__subtitle">
            {loading
              ? '—'
              : hasActiveFilters
                ? `${filtered.length} of ${users.length} user${users.length !== 1 ? 's' : ''}`
                : `${users.length} user${users.length !== 1 ? 's' : ''} registered`}
          </p>
        </div>
        <button className="admin-btn admin-btn--ghost" onClick={load} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'admin-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filters bar */}
      <div className="users-toolbar">
        <div className="users-search">
          <Search size={14} className="users-search__icon" />
          <input
            type="text"
            placeholder="Search by name, email, or user ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="users-search__input"
          />
          {search && (
            <button onClick={() => setSearch('')} className="users-search__clear" aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </div>

        <div className="admin-filter">
          <span className="admin-filter__label">Citizenship</span>
          <button
            className={`admin-filter__pill ${citizenshipFilter === '' ? 'admin-filter__pill--active' : ''}`}
            onClick={() => setCitizenshipFilter('')}
          >
            All
          </button>
          {citizenshipOptions.map((c) => (
            <button
              key={c.code}
              className={`admin-filter__pill ${citizenshipFilter === c.code ? 'admin-filter__pill--active' : ''}`}
              onClick={() => setCitizenshipFilter(c.code)}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="admin-filter">
          <span className="admin-filter__label">Sex</span>
          {[
            { value: '', label: 'All' },
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
            { value: 'other', label: 'Other' },
            { value: 'prefer_not_to_say', label: 'Prefer not to say' },
          ].map((g) => (
            <button
              key={g.value || 'all'}
              className={`admin-filter__pill ${genderFilter === g.value ? 'admin-filter__pill--active' : ''}`}
              onClick={() => setGenderFilter(g.value)}
            >
              {g.label}
            </button>
          ))}
        </div>

        {hasActiveFilters && (
          <button onClick={clearFilters} className="users-clear-filters">
            Clear filters
          </button>
        )}
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
          <p className="req-empty__title">
            {users.length === 0 ? 'No registered users yet' : 'No users match these filters'}
          </p>
          <p className="req-empty__sub">
            {users.length === 0 ? 'New sign-ups will appear here.' : 'Try clearing the filters.'}
          </p>
        </div>
      ) : (
        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th style={{ width: 28 }} aria-label="Expand"></th>
                <th
                  className={`users-table__th users-table__th--sortable ${sortKey === 'name' ? 'is-sorted' : ''}`}
                  onClick={() => toggleSort('name')}
                >
                  Name {sortKey === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className={`users-table__th users-table__th--sortable ${sortKey === 'email' ? 'is-sorted' : ''}`}
                  onClick={() => toggleSort('email')}
                >
                  Email {sortKey === 'email' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th className="users-table__th">User ID</th>
                <th className="users-table__th">Sex</th>
                <th className="users-table__th">Born</th>
                <th className="users-table__th">Citizenship</th>
                <th className="users-table__th">Visas</th>
                <th
                  className={`users-table__th users-table__th--sortable ${sortKey === 'createdAt' ? 'is-sorted' : ''}`}
                  onClick={() => toggleSort('createdAt')}
                >
                  Joined {sortKey === 'createdAt' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  className={`users-table__th users-table__th--sortable ${sortKey === 'lastLoginAt' ? 'is-sorted' : ''}`}
                  onClick={() => toggleSort('lastLoginAt')}
                >
                  Last login {sortKey === 'lastLoginAt' && (sortDir === 'asc' ? '↑' : '↓')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const open = expanded.has(u.id);
                const primary = u.citizenships.find((c) => c.isPrimary) ?? u.citizenships[0];
                return (
                  <Fragment key={u.id}>
                    <tr
                      className="users-table__row"
                      onClick={() => toggleExpand(u.id)}
                    >
                      <td className="users-table__td users-table__td--toggle">
                        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="users-table__td users-table__td--name">
                        {u.firstName} {u.lastName}
                      </td>
                      <td className="users-table__td">{u.email}</td>
                      <td className="users-table__td users-table__td--id">
                        <code title={u.id}>{u.id.slice(0, 10)}…</code>
                        <CopyButton value={u.id} />
                      </td>
                      <td className="users-table__td">{formatGender(u.gender)}</td>
                      <td className="users-table__td">{formatBirthday(u.birthday)}</td>
                      <td className="users-table__td">
                        {primary ? primary.countryName : '—'}
                        {u.citizenships.length > 1 && (
                          <span className="users-table__pill">+{u.citizenships.length - 1}</span>
                        )}
                      </td>
                      <td className="users-table__td">
                        {u.visas.length > 0 ? `${u.visas.length}` : '—'}
                      </td>
                      <td className="users-table__td users-table__td--date">
                        {formatTimestamp(u.createdAt)}
                      </td>
                      <td className={`users-table__td users-table__td--date ${!u.lastLoginAt ? 'users-table__td--muted' : ''}`}>
                        {formatLastLogin(u.lastLoginAt)}
                      </td>
                    </tr>
                    {open && (
                      <tr className="users-table__detail-row">
                        <td colSpan={10}>
                          <div className="users-detail">
                            <div>
                              <p className="users-detail__label">Country of residence</p>
                              <p>{u.countryOfResidenceName ?? '—'}</p>
                            </div>
                            <div>
                              <p className="users-detail__label">Citizenships</p>
                              {u.citizenships.length === 0 ? <p>—</p> : (
                                <ul className="users-detail__list">
                                  {u.citizenships.map((c) => (
                                    <li key={c.id}>
                                      <strong>{c.countryName}</strong>
                                      {c.isPrimary ? ' · Primary' : ''}
                                      {c.documentNumber ? ` · #${c.documentNumber}` : ''}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <div>
                              <p className="users-detail__label">Visas</p>
                              {u.visas.length === 0 ? <p>—</p> : (
                                <ul className="users-detail__list">
                                  {u.visas.map((v) => {
                                    const c = u.citizenships.find((x) => x.id === v.citizenshipId);
                                    return (
                                      <li key={v.id}>
                                        <strong>{v.countryName}</strong>
                                        {v.visaType ? ` · ${v.visaType}` : ''}
                                        {v.documentNumber ? ` · #${v.documentNumber}` : ''}
                                        {v.validUntil ? ` · until ${v.validUntil}` : ''}
                                        {c ? ` (on ${c.countryName} passport)` : ''}
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
