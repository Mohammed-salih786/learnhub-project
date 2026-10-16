-- Swachh-Ayush operational data. Health information is stored only as
-- anonymized aggregate counts; do not add patient-level records here.

CREATE TABLE swachh_wards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_name TEXT NOT NULL,
  ward_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  population INTEGER NOT NULL DEFAULT 0 CHECK (population >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE swachh_streets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id UUID NOT NULL REFERENCES swachh_wards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  estimated_waste_kg NUMERIC(8, 2) NOT NULL DEFAULT 0 CHECK (estimated_waste_kg >= 0),
  collection_window_start TIME,
  collection_window_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ward_id, name),
  CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE TABLE swachh_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_code TEXT NOT NULL UNIQUE,
  capacity_kg INTEGER NOT NULL CHECK (capacity_kg > 0),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE swachh_route_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES swachh_vehicles(id),
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vehicle_id, service_date)
);

CREATE TABLE swachh_route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_run_id UUID NOT NULL REFERENCES swachh_route_runs(id) ON DELETE CASCADE,
  street_id UUID NOT NULL REFERENCES swachh_streets(id),
  sequence_number INTEGER NOT NULL CHECK (sequence_number > 0),
  planned_at TIMESTAMPTZ NOT NULL,
  recorded_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'collected', 'skipped', 'blocked')),
  gps_latitude DOUBLE PRECISION,
  gps_longitude DOUBLE PRECISION,
  skip_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (route_run_id, street_id),
  UNIQUE (route_run_id, sequence_number),
  CHECK (gps_latitude IS NULL OR gps_latitude BETWEEN -90 AND 90),
  CHECK (gps_longitude IS NULL OR gps_longitude BETWEEN -180 AND 180)
);

CREATE TABLE swachh_health_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id UUID NOT NULL REFERENCES swachh_wards(id) ON DELETE CASCADE,
  observed_on DATE NOT NULL,
  fever_cases INTEGER NOT NULL DEFAULT 0 CHECK (fever_cases >= 0),
  dengue_cases INTEGER NOT NULL DEFAULT 0 CHECK (dengue_cases >= 0),
  malaria_cases INTEGER NOT NULL DEFAULT 0 CHECK (malaria_cases >= 0),
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ward_id, observed_on, source)
);

CREATE TABLE swachh_weather_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id UUID NOT NULL REFERENCES swachh_wards(id) ON DELETE CASCADE,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rainfall_mm NUMERIC(7, 2) NOT NULL DEFAULT 0 CHECK (rainfall_mm >= 0),
  humidity_percent NUMERIC(5, 2) NOT NULL CHECK (humidity_percent BETWEEN 0 AND 100),
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE swachh_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id UUID NOT NULL REFERENCES swachh_wards(id) ON DELETE CASCADE,
  street_id UUID NOT NULL REFERENCES swachh_streets(id) ON DELETE CASCADE,
  route_stop_id UUID NOT NULL REFERENCES swachh_route_stops(id) ON DELETE CASCADE,
  risk_score INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'critical')),
  correlation_confidence NUMERIC(5, 4) NOT NULL CHECK (correlation_confidence BETWEEN 0 AND 1),
  factors JSONB NOT NULL DEFAULT '{}'::JSONB,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (route_stop_id)
);

CREATE TABLE swachh_preventive_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_assessment_id UUID NOT NULL REFERENCES swachh_risk_assessments(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('waste_collection', 'fogging', 'supervisor_notification')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE swachh_user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('city_commissioner', 'waste_manager', 'health_officer', 'supervisor')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_swachh_streets_ward ON swachh_streets(ward_id);
CREATE INDEX idx_swachh_route_runs_service_date ON swachh_route_runs(service_date, status);
CREATE INDEX idx_swachh_route_stops_route_status ON swachh_route_stops(route_run_id, status, planned_at);
CREATE INDEX idx_swachh_route_stops_street ON swachh_route_stops(street_id, created_at DESC);
CREATE INDEX idx_swachh_health_signals_ward_date ON swachh_health_signals(ward_id, observed_on DESC);
CREATE INDEX idx_swachh_weather_ward_observed ON swachh_weather_observations(ward_id, observed_at DESC);
CREATE INDEX idx_swachh_risk_ward_assessed ON swachh_risk_assessments(ward_id, assessed_at DESC);
CREATE INDEX idx_swachh_actions_status_schedule ON swachh_preventive_actions(status, scheduled_at);

ALTER TABLE swachh_wards ENABLE ROW LEVEL SECURITY;
ALTER TABLE swachh_streets ENABLE ROW LEVEL SECURITY;
ALTER TABLE swachh_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE swachh_route_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE swachh_route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE swachh_health_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE swachh_weather_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE swachh_risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE swachh_preventive_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE swachh_user_roles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  swachh_wards,
  swachh_streets,
  swachh_vehicles,
  swachh_route_runs,
  swachh_route_stops,
  swachh_health_signals,
  swachh_weather_observations,
  swachh_risk_assessments,
  swachh_preventive_actions,
  swachh_user_roles
FROM anon, authenticated;

GRANT ALL ON TABLE
  swachh_wards,
  swachh_streets,
  swachh_vehicles,
  swachh_route_runs,
  swachh_route_stops,
  swachh_health_signals,
  swachh_weather_observations,
  swachh_risk_assessments,
  swachh_preventive_actions,
  swachh_user_roles
TO service_role;
