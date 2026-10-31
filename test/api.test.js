const assert = require('node:assert/strict');
const { after, test } = require('node:test');
const bcrypt = require('bcryptjs');

process.env.ADMIN_USERNAME = 'test-admin';
process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('test-admin-password', 4);
process.env.JWT_SECRET = 'test-jwt-secret-for-carepoint-api-32-bytes';

const app = require('../server');
const pool = require('../src/config/db');

const doctors = [
  { id: 1, name: 'Dr. Morgan Lee', specialty: 'Cardiology', created_at: '2026-01-01T00:00:00.000Z' }
];
const patients = [];
const appointments = [];
let nextPatientId = 1;
let nextAppointmentId = 1;

pool.query = async (sql, params = []) => {
  if (sql.includes('SELECT NOW()')) {
    return { rows: [{ now: '2026-10-31T12:00:00.000Z' }] };
  }
  if (sql.includes('FROM doctors')) return { rows: doctors };
  if (sql.includes('INSERT INTO patients')) {
    const [name, email] = params;
    if (patients.some((patient) => patient.email === email)) {
      const error = new Error('duplicate patient email');
      error.code = '23505';
      throw error;
    }
    const patient = { id: nextPatientId++, name, email, created_at: '2026-10-31T12:00:00.000Z' };
    patients.push(patient);
    return { rows: [patient] };
  }
  if (sql.includes('FROM patients')) {
    return { rows: patients.filter((patient) => patient.email === params[0]) };
  }
  if (sql.includes('INSERT INTO appointments')) {
    const [patientId, doctorId, appointmentTime] = params;
    if (!patients.some((patient) => patient.id === patientId) || !doctors.some((doctor) => doctor.id === doctorId)) {
      const error = new Error('foreign key violation');
      error.code = '23503';
      throw error;
    }
    const time = new Date(appointmentTime).toISOString();
    if (appointments.some((appointment) => appointment.doctor_id === doctorId && appointment.appointment_time === time && appointment.status !== 'cancelled')) {
      const error = new Error('duplicate active appointment');
      error.code = '23505';
      throw error;
    }
    const appointment = {
      id: nextAppointmentId++,
      patient_id: patientId,
      doctor_id: doctorId,
      appointment_time: time,
      status: 'booked',
      created_at: '2026-10-31T12:00:00.000Z'
    };
    appointments.push(appointment);
    return { rows: [appointment] };
  }
  if (sql.includes('UPDATE appointments')) {
    const appointment = appointments.find((item) => item.id === params[0] && item.status === 'booked');
    if (!appointment) return { rows: [] };
    appointment.status = 'cancelled';
    return { rows: [appointment] };
  }
  if (sql.includes('SELECT id, status FROM appointments')) {
    return { rows: appointments.filter((item) => item.id === params[0]).map(({ id, status }) => ({ id, status })) };
  }
  if (sql.includes('FROM appointments a')) {
    const matches = appointments.filter((item) => !params.length || item.id === params[0]);
    return {
      rows: matches.map((item) => ({
        id: item.id,
        patient_name: patients.find((patient) => patient.id === item.patient_id).name,
        doctor_name: doctors.find((doctor) => doctor.id === item.doctor_id).name,
        specialty: doctors.find((doctor) => doctor.id === item.doctor_id).specialty,
        appointment_time: item.appointment_time,
        status: item.status
      }))
    };
  }
  throw new Error(`Unexpected SQL in API test: ${sql}`);
};

test('hospital API supports booking, lookup, cancellation, and validation', async (t) => {
  const server = app.listen(0);
  t.after(() => new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  }));
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options) => fetch(`${baseUrl}${path}`, options);
  const json = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let token;
  const authenticatedRequest = (path, options = {}) =>
    request(path, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`
      }
    });

  await t.test('health checks and doctor listing', async () => {
    assert.equal((await request('/health')).status, 200);
    assert.equal((await request('/db-health')).status, 200);
    const response = await request('/api/doctors');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).doctors[0].specialty, 'Cardiology');
  });

  await t.test('admin login issues JWT and protects patient and appointment APIs', async () => {
    assert.equal((await request('/api/appointments')).status, 401);
    assert.equal((await request('/api/appointments', {
      headers: { Authorization: 'Bearer invalid-token' }
    })).status, 401);
    assert.equal((await request('/api/patients?email=alex%40example.com')).status, 401);
    assert.equal((await request('/api/auth/login', json('POST', {}))).status, 400);
    assert.equal((await request('/api/auth/login', json('POST', {
      username: 'test-admin',
      password: 'wrong-password'
    }))).status, 401);

    const login = await request('/api/auth/login', json('POST', {
      username: 'test-admin',
      password: 'test-admin-password'
    }));
    assert.equal(login.status, 200);
    const result = await login.json();
    assert.equal(result.token_type, 'Bearer');
    token = result.token;
    assert.ok(token);
    assert.equal((await authenticatedRequest('/api/appointments')).status, 200);
    assert.equal((await authenticatedRequest('/api/patients?email=missing%40example.com')).status, 404);

    const originalHash = process.env.ADMIN_PASSWORD_HASH;
    const originalSecret = process.env.JWT_SECRET;
    try {
      process.env.ADMIN_PASSWORD_HASH = '';
      assert.equal((await request('/api/auth/login', json('POST', {
        username: 'test-admin',
        password: 'test-admin-password'
      }))).status, 503);
      process.env.ADMIN_PASSWORD_HASH = originalHash;
      process.env.JWT_SECRET = '';
      assert.equal((await authenticatedRequest('/api/appointments')).status, 503);
    } finally {
      process.env.ADMIN_PASSWORD_HASH = originalHash;
      process.env.JWT_SECRET = originalSecret;
    }
  });

  let patient;
  await t.test('patient validation, creation, and duplicate lookup', async () => {
    assert.equal((await authenticatedRequest('/api/patients', json('POST', { name: '', email: 'bad' }))).status, 400);
    const created = await authenticatedRequest('/api/patients', json('POST', { name: 'Alex Morgan', email: 'alex@example.com' }));
    assert.equal(created.status, 201);
    patient = (await created.json()).patient;
    assert.equal((await authenticatedRequest('/api/patients?email=not-an-email')).status, 400);
    const duplicate = await authenticatedRequest('/api/patients', json('POST', { name: 'Alex Morgan', email: 'alex@example.com' }));
    assert.equal(duplicate.status, 409);
    const found = await authenticatedRequest('/api/patients?email=alex%40example.com');
    assert.equal(found.status, 200);
    assert.equal((await found.json()).patient.id, patient.id);
    assert.equal((await authenticatedRequest('/api/patients?email=missing%40example.com')).status, 404);
  });

  let appointment;
  const appointmentTime = '2026-11-02T10:00:00.000Z';
  await t.test('booking, listing, single lookup, and duplicate prevention', async () => {
    assert.equal((await authenticatedRequest('/api/appointments', json('POST', { patient_id: 1, doctor_id: 1, appointment_time: 'invalid' }))).status, 400);
    const created = await authenticatedRequest('/api/appointments', json('POST', {
      patient_id: patient.id,
      doctor_id: 1,
      appointment_time: appointmentTime
    }));
    assert.equal(created.status, 201);
    appointment = (await created.json()).appointment;
    assert.equal((await authenticatedRequest('/api/appointments', json('POST', {
      patient_id: patient.id,
      doctor_id: 1,
      appointment_time: appointmentTime
    }))).status, 409);
    const listing = await authenticatedRequest('/api/appointments');
    assert.equal((await listing.json()).appointments.length, 1);
    assert.equal((await authenticatedRequest(`/api/appointments/${appointment.id}`)).status, 200);
    assert.equal((await authenticatedRequest('/api/appointments/999')).status, 404);
    assert.equal((await authenticatedRequest('/api/appointments/nope')).status, 400);
  });

  await t.test('cancellation frees a doctor time and handles missing records', async () => {
    const cancelled = await authenticatedRequest(`/api/appointments/${appointment.id}/cancel`, { method: 'PATCH' });
    assert.equal(cancelled.status, 200);
    assert.equal((await cancelled.json()).appointment.status, 'cancelled');
    assert.equal((await authenticatedRequest(`/api/appointments/${appointment.id}/cancel`, { method: 'PATCH' })).status, 409);
    assert.equal((await authenticatedRequest('/api/appointments/999/cancel', { method: 'PATCH' })).status, 404);
    assert.equal((await authenticatedRequest('/api/appointments/invalid/cancel', { method: 'PATCH' })).status, 400);
    const replacement = await authenticatedRequest('/api/appointments', json('POST', {
      patient_id: patient.id,
      doctor_id: 1,
      appointment_time: appointmentTime
    }));
    assert.equal(replacement.status, 201);
  });
});
