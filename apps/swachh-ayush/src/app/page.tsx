"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { getBrowserSupabaseClient } from "@/lib/browser-supabase";

type Ward = {
  id: string;
  ward_code: string;
  name: string;
  population: number;
};

type Vehicle = {
  id: string;
  vehicle_code: string;
  capacity_kg: number;
};

type WardReference = { name: string; ward_code: string } | null;
type StreetReference = {
  name: string;
  ward: WardReference | WardReference[];
} | null;

type RouteStop = {
  id: string;
  status: string;
  planned_at: string;
  street: StreetReference | StreetReference[];
};

type RiskZone = {
  id: string;
  risk_score: number;
  severity: "low" | "medium" | "critical";
  correlation_confidence: number;
  assessed_at: string;
  street: StreetReference | StreetReference[];
};

type PreventiveAction = {
  id: string;
  action_type: string;
  status: string;
  scheduled_at: string;
  assessment: {
    street: StreetReference | StreetReference[];
  } | null;
};

type DashboardData = {
  ok: true;
  city: string;
  role: string;
  summary: {
    wards: number;
    routeStops: number;
    routeCompliancePercent: number;
    missedStreets: number;
    criticalZones: number;
    activeActions: number;
  };
  wards: Ward[];
  vehicles: Vehicle[];
  routeStops: RouteStop[];
  riskZones: RiskZone[];
  actions: PreventiveAction[];
  generatedAt: string;
};

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function streetLabel(value: StreetReference | StreetReference[]) {
  const street = first(value);
  const ward = first(street?.ward ?? null);
  return {
    street: street?.name ?? "Unknown street",
    ward: ward?.name ?? "Unknown ward",
  };
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function actionLabel(value: string) {
  return value.replaceAll("_", " ");
}

export default function DashboardPage() {
  const [authClient, setAuthClient] = useState<SupabaseClient | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [updatingAction, setUpdatingAction] = useState<string | null>(null);
  const [selectedWardId, setSelectedWardId] = useState("");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [serviceDate, setServiceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [isPlanningRoute, setIsPlanningRoute] = useState(false);
  const [routeMessage, setRouteMessage] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      setAuthError(
        "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in this app's .env.local.",
      );
      setAuthLoading(false);
      return;
    }

    const client = getBrowserSupabaseClient();
    setAuthClient(client);
    void client.auth
      .getSession()
      .then(({ data: sessionData, error: sessionError }) => {
        if (sessionError) setAuthError(sessionError.message);
        setAccessToken(sessionData.session?.access_token ?? null);
      })
      .catch((caught: unknown) => {
        setAuthError(
          caught instanceof Error
            ? caught.message
            : "Could not load your session.",
        );
      })
      .finally(() => setAuthLoading(false));
    const { data: authState } = client.auth.onAuthStateChange(
      (_event, session) => {
        setAccessToken(session?.access_token ?? null);
        setAuthError(null);
      },
    );

    return () => authState.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    if (!accessToken) return;

    try {
      const response = await fetch("/api/dashboard", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = (await response.json()) as
        DashboardData | { ok: false; error?: string };
      if (!response.ok || !result.ok) {
        throw new Error(
          "error" in result
            ? (result.error ?? "Dashboard data is unavailable.")
            : "Dashboard data is unavailable.",
        );
      }
      setData(result);
      setSelectedWardId((current) => current || result.wards[0]?.id || "");
      setSelectedVehicleId(
        (current) => current || result.vehicles[0]?.id || "",
      );
      setUpdatedAt(new Date().toLocaleTimeString());
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to refresh the dashboard.",
      );
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(timer);
  }, [accessToken, refresh]);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authClient) return;

    setIsSigningIn(true);
    setAuthError(null);
    try {
      const { error: signInError } = await authClient.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) setAuthError(signInError.message);
    } catch (caught) {
      setAuthError(
        caught instanceof Error ? caught.message : "Sign-in failed.",
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const signOut = async () => {
    if (!authClient) return;
    try {
      const { error: signOutError } = await authClient.auth.signOut();
      if (signOutError) setAuthError(signOutError.message);
      setData(null);
    } catch (caught) {
      setAuthError(
        caught instanceof Error ? caught.message : "Sign-out failed.",
      );
    }
  };

  const updateAction = async (
    actionId: string,
    status: "in_progress" | "completed",
  ) => {
    if (!accessToken) return;
    setUpdatingAction(actionId);
    try {
      const response = await fetch(`/api/actions/${actionId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "Could not update action.");
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not update action.",
      );
    } finally {
      setUpdatingAction(null);
    }
  };

  const planRoute = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accessToken) return;

    setIsPlanningRoute(true);
    setRouteMessage(null);
    try {
      const response = await fetch("/api/routes/optimize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wardId: selectedWardId,
          vehicleId: selectedVehicleId,
          serviceDate,
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        stops?: unknown[];
        totalDistanceKm?: number;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Could not plan the route.");
      }
      setRouteMessage(
        `Route saved with ${result.stops?.length ?? 0} stops · ${result.totalDistanceKm ?? 0} km estimated.`,
      );
      await refresh();
    } catch (caught) {
      setRouteMessage(
        caught instanceof Error ? caught.message : "Could not plan the route.",
      );
    } finally {
      setIsPlanningRoute(false);
    }
  };

  if (authLoading) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <span className="brand-mark">S</span>
          <p>Checking your municipal account…</p>
        </div>
      </main>
    );
  }

  if (!accessToken) {
    return (
      <main className="auth-shell">
        <form className="auth-card" onSubmit={signIn}>
          <a className="brand auth-brand" href="/">
            <span className="brand-mark">S</span>
            <span>
              Swachh<span className="brand-light">Ayush</span>
              <small>CITY INTELLIGENCE</small>
            </span>
          </a>
          <p className="eyebrow">SECURE MUNICIPAL ACCESS</p>
          <h1>Sign in to command center</h1>
          <p className="auth-description">
            Use your authorized municipal Supabase account to view operational
            and aggregate health data.
          </p>
          {authError ? (
            <div className="connection-alert" role="alert">
              {authError}
            </div>
          ) : null}
          <label htmlFor="email">Work email</label>
          <input
            autoComplete="username"
            id="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          <label htmlFor="password">Password</label>
          <input
            autoComplete="current-password"
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          <button
            className="refresh-button sign-in-button"
            disabled={isSigningIn || !authClient}
            type="submit"
          >
            {isSigningIn ? "Signing in…" : "Sign in"}
          </button>
          <p className="auth-note">
            Accounts must be provisioned in Supabase Auth and assigned an active
            Swachh-Ayush role by an administrator.
          </p>
        </form>
      </main>
    );
  }

  const summary = data?.summary;

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Swachh-Ayush home">
          <span className="brand-mark">S</span>
          <span>
            Swachh<span className="brand-light">Ayush</span>
            <small> CITY INTELLIGENCE</small>
          </span>
        </a>
        <div className="sidebar-label">OPERATIONS</div>
        <a className="nav-item active" href="#overview">
          <span>◈</span> Command center
        </a>
        <a className="nav-item" href="#zones">
          <span>⌖</span> Risk zones
        </a>
        <a className="nav-item" href="#routes">
          <span>↗</span> Route compliance
        </a>
        <a className="nav-item" href="#actions">
          <span>✓</span> Preventive actions
        </a>
        <div className="sidebar-bottom">
          <span className="online-dot" />
          <span>Operations overview</span>
          <small>Live data refreshes every 30s</small>
        </div>
      </aside>

      <section className="main-content" id="overview">
        <header className="topbar">
          <div>
            <p className="eyebrow">MUNICIPAL COMMAND &amp; CONTROL</p>
            <h1>Municipal command center</h1>
            <p className="subheading">
              Waste operations and early health signals in one view.
            </p>
          </div>
          <div className="topbar-right">
            <span className="live-pill">
              <span className="online-dot" /> LIVE MONITORING
            </span>
            <button
              className="refresh-button"
              onClick={() => void refresh()}
              type="button"
            >
              Refresh data
            </button>
            <button
              className="refresh-button sign-out-button"
              onClick={() => void signOut()}
              type="button"
            >
              Sign out
            </button>
          </div>
        </header>

        {error ? (
          <div className="connection-alert" role="alert">
            <strong>Dashboard data unavailable</strong>
            <span>
              {error.includes("municipal role")
                ? `${error} Ask your administrator to assign a role.`
                : `${error} Check Supabase connectivity and the app's environment configuration.`}
            </span>
          </div>
        ) : null}

        <div className="metrics-grid">
          <article className="metric-card">
            <span className="metric-icon green">⌖</span>
            <span className="metric-label">Route compliance</span>
            <strong>
              {summary?.routeCompliancePercent ?? "--"}
              <small>{summary ? "%" : ""}</small>
            </strong>
            <span className="metric-foot">
              {summary?.routeStops ?? 0} tracked stops
            </span>
          </article>
          <article className="metric-card">
            <span className="metric-icon red">!</span>
            <span className="metric-label">Missed streets</span>
            <strong>{summary?.missedStreets ?? "--"}</strong>
            <span className="metric-foot">Skipped or blocked</span>
          </article>
          <article className="metric-card">
            <span className="metric-icon amber">◉</span>
            <span className="metric-label">Critical risk zones</span>
            <strong>{summary?.criticalZones ?? "--"}</strong>
            <span className="metric-foot">Waste + health signals</span>
          </article>
          <article className="metric-card">
            <span className="metric-icon blue">✓</span>
            <span className="metric-label">Actions scheduled</span>
            <strong>{summary?.activeActions ?? "--"}</strong>
            <span className="metric-foot">Pending preventive response</span>
          </article>
        </div>

        <div className="section-grid">
          <section className="panel map-panel" id="zones">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">GEOGRAPHIC OVERVIEW</p>
                <h2>City risk zones</h2>
              </div>
              <span className="city-chip">
                {data?.city ?? "Pilot city"} · {summary?.wards ?? 0} wards
              </span>
            </div>
            <div className="map-canvas">
              <div className="map-road road-one" />
              <div className="map-road road-two" />
              <div className="map-road road-three" />
              <div className="map-road road-four" />
              {(data?.riskZones ?? []).slice(0, 8).map((zone, index) => {
                const label = streetLabel(zone.street);
                return (
                  <div
                    className={`map-marker ${zone.severity}`}
                    key={zone.id}
                    style={{
                      left: `${14 + ((index * 29) % 72)}%`,
                      top: `${19 + ((index * 37) % 63)}%`,
                    }}
                    title={`${label.street}: risk ${zone.risk_score}`}
                  >
                    <span>{zone.risk_score}</span>
                  </div>
                );
              })}
              {!data?.riskZones.length ? (
                <div className="map-empty">
                  Risk markers appear as verified reports arrive
                </div>
              ) : null}
              <div className="map-legend">
                <span>
                  <i className="legend-dot critical" /> Critical
                </span>
                <span>
                  <i className="legend-dot medium" /> Medium
                </span>
                <span>
                  <i className="legend-dot low" /> Low
                </span>
              </div>
            </div>
            <div className="ward-strip">
              {(data?.wards ?? []).slice(0, 4).map((ward) => (
                <div className="ward-chip" key={ward.id}>
                  <strong>{ward.ward_code}</strong>
                  <span>{ward.name}</span>
                  <small>
                    {ward.population.toLocaleString("en-IN")} residents
                  </small>
                </div>
              ))}
              {!data?.wards.length ? (
                <span className="muted">
                  Ward data will appear after database setup.
                </span>
              ) : null}
            </div>
          </section>

          <section className="panel risk-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">PRIORITY RESPONSE</p>
                <h2>Highest risk streets</h2>
              </div>
              <a href="#routes">
                View routes <span>↗</span>
              </a>
            </div>
            <div className="risk-list">
              {(data?.riskZones ?? []).slice(0, 5).map((zone) => {
                const label = streetLabel(zone.street);
                return (
                  <article className="risk-row" key={zone.id}>
                    <span className={`severity-mark ${zone.severity}`} />
                    <div className="risk-name">
                      <strong>{label.street}</strong>
                      <span>
                        {label.ward} · confidence{" "}
                        {Math.round(zone.correlation_confidence * 100)}%
                      </span>
                    </div>
                    <strong className={`risk-score ${zone.severity}`}>
                      {zone.risk_score}
                    </strong>
                  </article>
                );
              })}
              {!data?.riskZones.length ? (
                <p className="empty-copy">
                  No assessed risk zones yet. Skipped collection reports are
                  scored against aggregate health and weather data.
                </p>
              ) : null}
            </div>
          </section>
        </div>

        <div className="section-grid lower-grid">
          {["city_commissioner", "waste_manager", "supervisor"].includes(
            data?.role ?? "",
          ) ? (
            <section className="panel route-planner">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">DAILY ROUTE ASSIGNMENT</p>
                  <h2>Plan a ward route</h2>
                </div>
                <span className="count-chip">
                  {data?.vehicles.length ?? 0} active vehicles
                </span>
              </div>
              <form className="route-form" onSubmit={planRoute}>
                <label>
                  Ward
                  <select
                    onChange={(event) => setSelectedWardId(event.target.value)}
                    required
                    value={selectedWardId}
                  >
                    {(data?.wards ?? []).map((ward) => (
                      <option key={ward.id} value={ward.id}>
                        {ward.ward_code} · {ward.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Vehicle
                  <select
                    onChange={(event) =>
                      setSelectedVehicleId(event.target.value)
                    }
                    required
                    value={selectedVehicleId}
                  >
                    {(data?.vehicles ?? []).map((vehicle) => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicle.vehicle_code} · {vehicle.capacity_kg} kg
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Service date
                  <input
                    onChange={(event) => setServiceDate(event.target.value)}
                    required
                    type="date"
                    value={serviceDate}
                  />
                </label>
                <button
                  className="refresh-button"
                  disabled={
                    isPlanningRoute || !selectedWardId || !selectedVehicleId
                  }
                  type="submit"
                >
                  {isPlanningRoute ? "Planning…" : "Optimize & assign"}
                </button>
              </form>
              <p className="planner-note">
                Baseline nearest-neighbour order uses mapped street coordinates,
                estimated waste and vehicle capacity. Live traffic and
                road-block rerouting need a maps provider.
              </p>
              {routeMessage ? (
                <p className="route-message" role="status">
                  {routeMessage}
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="panel" id="routes">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">FIELD OPERATIONS</p>
                <h2>Recent collection stops</h2>
              </div>
              <span className="count-chip">
                {data?.routeStops.length ?? 0} stops
              </span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>STREET / WARD</th>
                    <th>PLANNED</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.routeStops ?? []).slice(0, 6).map((stop) => {
                    const label = streetLabel(stop.street);
                    return (
                      <tr key={stop.id}>
                        <td>
                          <strong>{label.street}</strong>
                          <small>{label.ward}</small>
                        </td>
                        <td>{formatTime(stop.planned_at)}</td>
                        <td>
                          <span className={`status-pill ${stop.status}`}>
                            {stop.status.replaceAll("_", " ")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!data?.routeStops.length ? (
                <p className="table-empty">
                  No route stops loaded. Seed a pilot route to begin tracking.
                </p>
              ) : null}
            </div>
          </section>

          <section className="panel" id="actions">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">AUTOMATED WORKFLOW</p>
                <h2>Preventive actions</h2>
              </div>
              <span className="count-chip">
                {data?.actions.length ?? 0} open
              </span>
            </div>
            <div className="action-list">
              {(data?.actions ?? []).slice(0, 5).map((action) => {
                const label = streetLabel(action.assessment?.street ?? null);
                return (
                  <article className="action-row" key={action.id}>
                    <span className="action-check">✓</span>
                    <div>
                      <strong>{actionLabel(action.action_type)}</strong>
                      <span>
                        {label.street} · due {formatTime(action.scheduled_at)}
                      </span>
                    </div>
                    <span className={`status-pill ${action.status}`}>
                      {action.status}
                    </span>
                    {[
                      "city_commissioner",
                      "waste_manager",
                      "supervisor",
                    ].includes(data?.role ?? "") ? (
                      <button
                        className="action-button"
                        disabled={updatingAction === action.id}
                        onClick={() =>
                          void updateAction(
                            action.id,
                            action.status === "scheduled"
                              ? "in_progress"
                              : "completed",
                          )
                        }
                        type="button"
                      >
                        {action.status === "scheduled" ? "Start" : "Complete"}
                      </button>
                    ) : null}
                  </article>
                );
              })}
              {!data?.actions.length ? (
                <p className="empty-copy">
                  Actions are scheduled automatically when risk is critical and
                  health correlation confidence is at least 60%.
                </p>
              ) : null}
            </div>
          </section>
        </div>

        <footer className="page-footer">
          <span>
            Swachh-Ayush AI <b>·</b> Predict. Prevent. Protect.
          </span>
          <span>
            {updatedAt ? `Last updated ${updatedAt}` : "Waiting for database"}{" "}
            <span className="online-dot" />
          </span>
        </footer>
      </section>
    </main>
  );
}
