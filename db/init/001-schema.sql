CREATE TABLE IF NOT EXISTS doctors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  doctor_id INTEGER NOT NULL REFERENCES doctors(id),
  appointment_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked'
    CHECK (status IN ('booked', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS appointments_doctor_time_not_cancelled_unique
  ON appointments (doctor_id, appointment_time)
  WHERE status <> 'cancelled';

INSERT INTO doctors (name, specialty)
SELECT sample.name, sample.specialty
FROM (VALUES
  ('Dr. Emily Chen', 'Cardiology'),
  ('Dr. Marcus Williams', 'Family Medicine'),
  ('Dr. Priya Patel', 'Pediatrics'),
  ('Dr. James Okafor', 'Orthopedics')
) AS sample(name, specialty)
WHERE NOT EXISTS (SELECT 1 FROM doctors);
