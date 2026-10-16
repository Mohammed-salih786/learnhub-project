INSERT INTO plans (key, label, amount_cents, currency, is_active, trial_days, description)
VALUES
  ('trial', 'Free trial', 0, 'INR', true, 7, '7-day trial with two free course enrollments'),
  ('monthly', 'Monthly', 14900, 'INR', true, 0, 'Full library access for one month'),
  ('yearly', 'Yearly', 99900, 'INR', true, 0, 'Full library access for one year with certificates and priority support');

INSERT INTO categories (name, slug)
VALUES
  ('Development', 'development'),
  ('Design', 'design'),
  ('Business', 'business');

INSERT INTO swachh_wards (id, city_name, ward_code, name, population)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'Pilot City', 'W-01', 'Central Ward', 18400),
  ('10000000-0000-4000-8000-000000000002', 'Pilot City', 'W-02', 'River Ward', 12600);

INSERT INTO swachh_streets (id, ward_id, name, latitude, longitude, estimated_waste_kg, collection_window_start, collection_window_end)
VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Market Road', 18.5204, 73.8567, 120, '06:00', '08:00'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Station Lane', 18.5231, 73.8581, 90, '06:00', '08:00'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'Canal Street', 18.5158, 73.8642, 110, '07:00', '09:00'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'Lake View Road', 18.5121, 73.8613, 75, '07:00', '09:00');

INSERT INTO swachh_vehicles (id, vehicle_code, capacity_kg)
VALUES
  ('30000000-0000-4000-8000-000000000001', 'PILOT-TRUCK-01', 2500),
  ('30000000-0000-4000-8000-000000000002', 'PILOT-TRUCK-02', 1800);

INSERT INTO swachh_route_runs (id, vehicle_id, service_date, status)
VALUES
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', CURRENT_DATE - 1, 'completed'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', CURRENT_DATE - 1, 'completed');

INSERT INTO swachh_route_stops (id, route_run_id, street_id, sequence_number, planned_at, recorded_at, status, gps_latitude, gps_longitude, skip_reason)
VALUES
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '90 minutes', 'collected', 18.5204, 73.8567, NULL),
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 2, NOW() - INTERVAL '90 minutes', NOW() - INTERVAL '75 minutes', 'skipped', 18.5231, 73.8581, 'Vehicle breakdown reported'),
  ('50000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', 1, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '45 minutes', 'collected', 18.5158, 73.8642, NULL),
  ('50000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000004', 2, NOW() + INTERVAL '30 minutes', NULL, 'scheduled', NULL, NULL, NULL);

INSERT INTO swachh_health_signals (ward_id, observed_on, fever_cases, dengue_cases, malaria_cases, source)
VALUES
  ('10000000-0000-4000-8000-000000000001', CURRENT_DATE - 2, 8, 1, 0, 'demo-clinic'),
  ('10000000-0000-4000-8000-000000000001', CURRENT_DATE - 1, 13, 2, 0, 'demo-clinic'),
  ('10000000-0000-4000-8000-000000000001', CURRENT_DATE, 19, 3, 1, 'demo-clinic'),
  ('10000000-0000-4000-8000-000000000002', CURRENT_DATE - 2, 5, 0, 1, 'demo-clinic'),
  ('10000000-0000-4000-8000-000000000002', CURRENT_DATE - 1, 5, 0, 1, 'demo-clinic'),
  ('10000000-0000-4000-8000-000000000002', CURRENT_DATE, 6, 0, 1, 'demo-clinic');

INSERT INTO swachh_weather_observations (ward_id, rainfall_mm, humidity_percent, source)
VALUES
  ('10000000-0000-4000-8000-000000000001', 42, 86, 'demo-weather'),
  ('10000000-0000-4000-8000-000000000002', 18, 72, 'demo-weather');

INSERT INTO swachh_risk_assessments (id, ward_id, street_id, route_stop_id, risk_score, severity, correlation_confidence, factors)
VALUES
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', 78, 'critical', 0.8, '{"missedCollection":23,"rainfall":4.2,"humidity":4.3,"population":1.8,"feverTrend":25}'::JSONB);

INSERT INTO swachh_preventive_actions (risk_assessment_id, action_type, scheduled_at, idempotency_key, details)
VALUES
  ('60000000-0000-4000-8000-000000000001', 'waste_collection', NOW() + INTERVAL '4 hours', '50000000-0000-4000-8000-000000000002:waste_collection', '{"demo":true}'::JSONB),
  ('60000000-0000-4000-8000-000000000001', 'fogging', NOW() + INTERVAL '8 hours', '50000000-0000-4000-8000-000000000002:fogging', '{"demo":true}'::JSONB),
  ('60000000-0000-4000-8000-000000000001', 'supervisor_notification', NOW(), '50000000-0000-4000-8000-000000000002:supervisor_notification', '{"demo":true}'::JSONB);
