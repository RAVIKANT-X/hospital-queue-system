const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const TOKEN_KEY = 'carepoint_admin_token';

function getToken() {
  return window.sessionStorage.getItem(TOKEN_KEY);
}

function clearToken() {
  window.sessionStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = path === '/api/auth/login' ? null : getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && token) {
      clearToken();
      window.dispatchEvent(new Event('carepoint:unauthorized'));
    }
    const error = new Error(result.message || 'The request could not be completed.');
    error.status = response.status;
    throw error;
  }

  return result;
}

export const api = {
  getToken,
  logout: clearToken,
  async login(credentials) {
    const result = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    window.sessionStorage.setItem(TOKEN_KEY, result.token);
  },
  getDoctors: () => request('/api/doctors'),
  getAppointments: () => request('/api/appointments'),
  getPatientByEmail: (email) =>
    request(`/api/patients?email=${encodeURIComponent(email)}`),
  createPatient: (patient) =>
    request('/api/patients', {
      method: 'POST',
      body: JSON.stringify(patient)
    }),
  bookAppointment: (appointment) =>
    request('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(appointment)
    }),
  cancelAppointment: (id) =>
    request(`/api/appointments/${id}/cancel`, { method: 'PATCH' })
};
