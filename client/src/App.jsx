import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api } from './api.js';

const navigation = [
  { to: '/', label: 'Overview', icon: 'grid', end: true },
  { to: '/appointments', label: 'Appointments', icon: 'calendar' },
  { to: '/doctors', label: 'Doctors', icon: 'users' },
  { to: '/book', label: 'Book appointment', icon: 'plus' }
];

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

function Icon({ name, size = 20 }) {
  const shared = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  };
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    stethoscope: <><path d="M6 3v5a4 4 0 0 0 8 0V3M4 3h4M12 3h4M10 12v2a5 5 0 0 0 10 0v-1" /><circle cx="20" cy="11" r="2" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>
  };
  return <svg {...shared}>{paths[name] || paths.grid}</svg>;
}

function formatDate(value, options = { dateStyle: 'medium', timeStyle: 'short' }) {
  return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
}

function StatusBadge({ status }) {
  return <span className={`status-badge status-${status}`}>{status}</span>;
}

function App() {
  const [authenticated, setAuthenticated] = useState(() => Boolean(api.getToken()));
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [doctorsError, setDoctorsError] = useState('');
  const [appointmentsError, setAppointmentsError] = useState('');
  const [toast, setToast] = useState(null);

  const loadDoctors = useCallback(async () => {
    setDoctorsLoading(true);
    setDoctorsError('');
    try {
      const result = await api.getDoctors();
      setDoctors(result.doctors);
    } catch (error) {
      setDoctorsError(error.message);
    } finally {
      setDoctorsLoading(false);
    }
  }, []);

  const loadAppointments = useCallback(async () => {
    setAppointmentsLoading(true);
    setAppointmentsError('');
    try {
      const result = await api.getAppointments();
      setAppointments(result.appointments);
    } catch (error) {
      setAppointmentsError(error.message);
    } finally {
      setAppointmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => setAuthenticated(false);
    window.addEventListener('carepoint:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('carepoint:unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    if (!authenticated) return undefined;
    loadDoctors();
    loadAppointments();
    return undefined;
  }, [authenticated, loadAppointments, loadDoctors]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  if (!authenticated) {
    return <Login onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <>
      <Routes>
        <Route element={<DashboardLayout onLogout={() => { api.logout(); setAuthenticated(false); }} />}>
          <Route
            index
            element={
              <Dashboard
                appointments={appointments}
                doctors={doctors}
                loading={appointmentsLoading}
                error={appointmentsError}
              />
            }
          />
          <Route
            path="appointments"
            element={
              <Appointments
                appointments={appointments}
                loading={appointmentsLoading}
                error={appointmentsError}
                onCancel={async (id) => {
                  await api.cancelAppointment(id);
                  await loadAppointments();
                  showToast('Appointment cancelled successfully.');
                }}
                showToast={showToast}
              />
            }
          />
          <Route
            path="doctors"
            element={
              <Doctors
                doctors={doctors}
                loading={doctorsLoading}
                error={doctorsError}
                onRetry={loadDoctors}
              />
            }
          />
          <Route
            path="book"
            element={
              <BookAppointment
                doctors={doctors}
                doctorsLoading={doctorsLoading}
                doctorsError={doctorsError}
                onRetry={loadDoctors}
                onBooked={async () => {
                  await loadAppointments();
                  showToast('Your appointment is booked.');
                }}
                showToast={showToast}
              />
            }
          />
        </Route>
      </Routes>
      {toast && (
        <div className={`toast toast-${toast.type}`} role="status">
          <span className="toast-mark"><Icon name={toast.type === 'error' ? 'close' : 'check'} size={17} /></span>
          <span>{toast.message}</span>
          <button className="icon-button toast-close" onClick={() => setToast(null)} aria-label="Dismiss notification">
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </>
  );
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.login({ username, password });
      onLogin();
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <Link className="brand login-brand" to="/">
          <span className="brand-mark"><span>+</span></span>
          <span>care<span className="brand-light">point</span><small>HEALTHCARE OPERATIONS</small></span>
        </Link>
        <div className="login-heading"><span className="eyebrow">ADMIN ACCESS</span><h1>Welcome back</h1><p>Sign in to manage hospital appointments.</p></div>
        <form className="login-form" onSubmit={submit}>
          <label className="field"><span>Username</span><input name="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
          <label className="field"><span>Password</span><input name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="button button-primary login-submit" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="login-footnote">Authorized administrators only</p>
      </section>
    </main>
  );
}

function DashboardLayout({ onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const pageLabel = navigation.find((item) => item.to === location.pathname)?.label || 'Overview';
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <Link className="brand" to="/" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark"><span>+</span></span>
          <span>care<span className="brand-light">point</span><small>HEALTHCARE OPERATIONS</small></span>
        </Link>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => `nav-link ${isActive ? 'nav-active' : ''}`}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
              {item.to === '/appointments' && <span className="nav-indicator" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="support-card">
            <span className="support-icon"><Icon name="stethoscope" size={19} /></span>
            <strong>Care starts here</strong>
            <span>Keep your team and patients in sync.</span>
          </div>
          <div className="profile">
            <div className="avatar">AD</div>
            <div className="profile-copy"><strong>Admin Desk</strong><span>Hospital administrator</span></div>
            <button className="logout-button" onClick={onLogout}>Sign out</button>
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">
            <Icon name="menu" />
          </button>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{pageLabel}</strong></div>
          <div className="topbar-right">
            <span className="live-indicator"><i /> System operational</span>
            <div className="topbar-date"><Icon name="calendar" size={17} />{new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</div>
          </div>
        </header>
        <main className="page-content"><Outlet /></main>
        <footer className="footer"><span>CarePoint Hospital Management</span><span>Appointment operations made simpler</span></footer>
      </div>
      {menuOpen && <button className="sidebar-scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>
      {action}
    </div>
  );
}

function Dashboard({ appointments, doctors, loading, error }) {
  const counts = useMemo(() => ({
    total: appointments.length,
    booked: appointments.filter((item) => item.status === 'booked').length,
    cancelled: appointments.filter((item) => item.status === 'cancelled').length,
    completed: appointments.filter((item) => item.status === 'completed').length
  }), [appointments]);
  const recent = [...appointments].sort((a, b) => new Date(b.appointment_time) - new Date(a.appointment_time)).slice(0, 5);
  const metrics = [
    { label: 'Total appointments', value: counts.total, icon: 'calendar', tint: 'blue', note: 'Across all records' },
    { label: 'Booked', value: counts.booked, icon: 'clock', tint: 'green', note: 'Upcoming visits' },
    { label: 'Completed', value: counts.completed, icon: 'check', tint: 'violet', note: 'Visits completed' },
    { label: 'Cancelled', value: counts.cancelled, icon: 'close', tint: 'orange', note: 'Cancelled visits' }
  ];

  return (
    <>
      <PageHeading
        eyebrow="YOUR HOSPITAL AT A GLANCE"
        title="Good day, Admin"
        description="Here’s what’s happening across your appointments today."
        action={<Link className="button button-primary" to="/book"><Icon name="plus" size={18} />Book appointment</Link>}
      />
      {error && <ErrorBanner message={error} />}
      <section className="metric-grid" aria-label="Appointment statistics">
        {metrics.map((metric, index) => (
          <article className={`metric-card metric-${metric.tint}`} key={metric.label} style={{ '--card-index': index }}>
            <div className="metric-top"><span>{metric.label}</span><span className="metric-icon"><Icon name={metric.icon} size={19} /></span></div>
            <div className="metric-value">{loading ? <span className="skeleton skeleton-number" /> : metric.value}</div>
            <div className="metric-note"><span className="metric-dot" />{metric.note}</div>
          </article>
        ))}
      </section>
      <section className="dashboard-grid">
        <article className="panel recent-panel">
          <div className="panel-heading">
            <div><h2>Recent appointments</h2><p>Your latest patient visits</p></div>
            <Link className="text-link" to="/appointments">View all <Icon name="arrow" size={16} /></Link>
          </div>
          {loading ? <LoadingState label="Loading appointments…" /> : recent.length ? <AppointmentTable appointments={recent} compact /> : <EmptyState title="No appointments yet" message="New appointments will appear here once they’re booked." action={<Link className="button button-soft" to="/book">Book the first appointment</Link>} />}
        </article>
        <article className="panel care-panel">
          <div className="care-heading"><span className="care-symbol"><Icon name="stethoscope" size={21} /></span><span className="care-kicker">YOUR CARE TEAM</span></div>
          <h2>Great care begins with a connected team.</h2>
          <p>Manage your doctors and keep every appointment moving smoothly.</p>
          <div className="doctor-peek">
            <div className="avatar-stack">{doctors.slice(0, 3).map((doctor, i) => <span className={`doctor-avatar doctor-avatar-${i}`} key={doctor.id}>{initials(doctor.name)}</span>)}</div>
            <span><strong>{doctors.length}</strong> {doctors.length === 1 ? 'specialist' : 'specialists'} available</span>
          </div>
          <Link className="button button-white" to="/doctors">Meet the doctors <Icon name="arrow" size={16} /></Link>
          <div className="care-decoration care-decoration-one" /><div className="care-decoration care-decoration-two" />
        </article>
      </section>
    </>
  );
}

function Appointments({ appointments, loading, error, onCancel, showToast }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [cancelling, setCancelling] = useState(null);
  const filtered = appointments.filter((item) => {
    const matchesStatus = filter === 'all' || item.status === filter;
    const searchText = `${item.patient_name} ${item.doctor_name} ${item.specialty}`.toLowerCase();
    return matchesStatus && searchText.includes(query.toLowerCase());
  });

  async function cancel(id) {
    setCancelling(id);
    try {
      await onCancel(id);
    } catch (requestError) {
      showToast(requestError.message, 'error');
    } finally {
      setCancelling(null);
    }
  }

  return (
    <>
      <PageHeading eyebrow="SCHEDULE & VISITS" title="Appointments" description="Keep track of patient visits and manage your schedule." action={<Link className="button button-primary" to="/book"><Icon name="plus" size={18} />New appointment</Link>} />
      {error && <ErrorBanner message={error} />}
      <section className="panel appointments-panel">
        <div className="appointment-toolbar">
          <div className="filter-tabs" role="tablist" aria-label="Filter appointments">
            {['all', 'booked', 'completed', 'cancelled'].map((status) => (
              <button key={status} role="tab" aria-selected={filter === status} className={`filter-tab ${filter === status ? 'filter-active' : ''}`} onClick={() => setFilter(status)}>{status === 'all' ? 'All visits' : capitalize(status)}<span>{status === 'all' ? appointments.length : appointments.filter((item) => item.status === status).length}</span></button>
            ))}
          </div>
          <label className="search-field"><span className="search-icon">⌕</span><input aria-label="Search appointments" placeholder="Search patients or doctors" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        </div>
        {loading ? <LoadingState label="Loading appointments…" /> : error ? <EmptyState title="Appointments couldn’t load" message="Check your connection to the API and try again." /> : filtered.length ? <AppointmentTable appointments={filtered} onCancel={cancel} cancelling={cancelling} /> : <EmptyState title={query ? 'No matching appointments' : 'No appointments in this view'} message={query ? 'Try another patient or doctor name.' : 'Book an appointment to add the first visit.'} action={!query && <Link className="button button-soft" to="/book">Book appointment</Link>} />}
      </section>
    </>
  );
}

function AppointmentTable({ appointments, compact = false, onCancel, cancelling }) {
  return (
    <div className={`table-wrap ${compact ? 'table-compact' : ''}`}>
      <table>
        <thead><tr><th>Patient</th><th>Doctor</th><th>Appointment</th><th>Status</th>{onCancel && <th><span className="sr-only">Actions</span></th>}</tr></thead>
        <tbody>
          {appointments.map((appointment) => (
            <tr key={appointment.id}>
              <td><div className="patient-cell"><span className="patient-avatar">{initials(appointment.patient_name)}</span><span><strong>{appointment.patient_name}</strong><small>Patient #{appointment.id}</small></span></div></td>
              <td><div className="doctor-cell"><strong>{appointment.doctor_name}</strong><small>{appointment.specialty}</small></div></td>
              <td><div className="date-cell"><strong>{formatDate(appointment.appointment_time, { month: 'short', day: 'numeric', year: 'numeric' })}</strong><small>{formatDate(appointment.appointment_time, { hour: 'numeric', minute: '2-digit' })}</small></div></td>
              <td><StatusBadge status={appointment.status} /></td>
              {onCancel && <td className="action-cell">{appointment.status === 'booked' && <button className="cancel-button" onClick={() => cancel(appointment.id)} disabled={cancelling === appointment.id}>{cancelling === appointment.id ? 'Cancelling…' : 'Cancel'}</button>}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Doctors({ doctors, loading, error, onRetry }) {
  return (
    <>
      <PageHeading eyebrow="MEET YOUR CARE TEAM" title="Our doctors" description="Find the right specialist for every patient." action={<Link className="button button-primary" to="/book"><Icon name="plus" size={18} />Book appointment</Link>} />
      {error && <ErrorBanner message={error} onRetry={onRetry} />}
      {loading ? <LoadingState label="Loading doctors…" /> : error ? null : doctors.length ? (
        <section className="doctor-grid">
          {doctors.map((doctor, index) => (
            <article className="doctor-card" key={doctor.id}>
              <div className={`doctor-portrait portrait-${index % 4}`}><span>{initials(doctor.name)}</span><i className="portrait-cross">+</i></div>
              <div className="doctor-card-body"><span className="doctor-label">MEDICAL SPECIALIST</span><h2>{doctor.name}</h2><p>{doctor.specialty}</p><div className="doctor-card-footer"><span><i />Available for appointments</span><Link to="/book" state={{ doctorId: doctor.id }} aria-label={`Book with ${doctor.name}`}><Icon name="arrow" size={18} /></Link></div></div>
            </article>
          ))}
        </section>
      ) : <EmptyState title="No doctors found" message="Doctors will show here when they are added to the system." />}
    </>
  );
}

function BookAppointment({ doctors, doctorsLoading, doctorsError, onRetry, onBooked, showToast }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', doctorId: '', date: today(), time: '' });

  useEffect(() => {
    if (location.state?.doctorId) {
      setForm((current) => ({ ...current, doctorId: String(location.state.doctorId) }));
    }
  }, [location.state]);

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.doctorId || !form.date || !form.time) {
      showToast('Complete every field before booking.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      let patient;
      try {
        const result = await api.createPatient({ name: form.name.trim(), email: form.email.trim() });
        patient = result.patient;
      } catch (error) {
        if (error.status !== 409) throw error;
        const existing = await api.getPatientByEmail(form.email.trim());
        patient = existing.patient;
      }

      const appointmentTime = new Date(`${form.date}T${form.time}`);
      if (Number.isNaN(appointmentTime.getTime()) || appointmentTime <= new Date()) {
        throw new Error('Choose an appointment time in the future.');
      }
      await api.bookAppointment({
        patient_id: patient.id,
        doctor_id: Number(form.doctorId),
        appointment_time: appointmentTime.toISOString()
      });
      await onBooked();
      navigate('/appointments');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeading eyebrow="PATIENT SERVICES" title="Book an appointment" description="A few details are all it takes to arrange a visit." />
      <div className="booking-layout">
        <section className="panel booking-panel">
          <div className="form-heading"><span className="form-step">01</span><div><h2>Appointment details</h2><p>Enter the patient and visit information below.</p></div></div>
          <form onSubmit={submit} className="booking-form">
            <div className="form-section-label">PATIENT INFORMATION</div>
            <div className="form-row">
              <label className="field"><span>Patient name</span><input name="name" autoComplete="name" placeholder="e.g. Alex Morgan" value={form.name} onChange={update} required maxLength={120} /></label>
              <label className="field"><span>Email address</span><input name="email" type="email" autoComplete="email" placeholder="alex@example.com" value={form.email} onChange={update} required maxLength={254} /></label>
            </div>
            <div className="form-section-label form-section-spaced">VISIT INFORMATION</div>
            <label className="field"><span>Select doctor</span><select name="doctorId" value={form.doctorId} onChange={update} required disabled={doctorsLoading || Boolean(doctorsError) || !doctors.length}><option value="">{doctorsLoading ? 'Loading doctors…' : 'Choose a doctor'}</option>{doctors.map((doctor) => <option value={doctor.id} key={doctor.id}>{doctor.name} · {doctor.specialty}</option>)}</select>{doctorsError && <span className="field-error">{doctorsError} <button type="button" className="inline-link" onClick={onRetry}>Retry</button></span>}</label>
            <div className="form-row">
              <label className="field"><span>Appointment date</span><input type="date" name="date" min={today()} value={form.date} onChange={update} required /></label>
              <label className="field"><span>Appointment time</span><input type="time" name="time" value={form.time} onChange={update} required /></label>
            </div>
            <div className="form-hint"><Icon name="clock" size={16} />Appointments are scheduled in your local time zone.</div>
            <div className="form-actions"><Link className="button button-quiet" to="/appointments">Cancel</Link><button className="button button-primary" type="submit" disabled={submitting || doctorsLoading || !doctors.length}>{submitting ? <><span className="button-spinner" />Booking…</> : <><Icon name="check" size={18} />Confirm appointment</>}</button></div>
          </form>
        </section>
        <aside className="booking-aside">
          <div className="booking-note"><span className="note-icon"><Icon name="check" size={19} /></span><h3>Simple, thoughtful care</h3><p>Patient details are linked to their appointment record so your team can stay organized.</p></div>
          <div className="booking-note note-muted"><span className="note-icon"><Icon name="calendar" size={19} /></span><h3>Need to make a change?</h3><p>Booked visits can be cancelled from your appointments list at any time.</p><Link className="text-link" to="/appointments">View appointments <Icon name="arrow" size={15} /></Link></div>
        </aside>
      </div>
    </>
  );
}

function ErrorBanner({ message, onRetry }) {
  return <div className="error-banner" role="alert"><span>{message}</span>{onRetry && <button onClick={onRetry}>Try again</button>}</div>;
}

function LoadingState({ label }) {
  return <div className="loading-state"><span className="loading-spinner" />{label}</div>;
}

function EmptyState({ title, message, action }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name="calendar" size={24} /></span><h3>{title}</h3><p>{message}</p>{action}</div>;
}

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default App;
