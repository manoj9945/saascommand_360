import { useEffect, useMemo, useState } from "react";
import "./App.css";
import DashboardLayout from "./components/DashboardLayout";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const safeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(safeNumber(value));

const formatCompactCurrency = (value) => {
  const number = safeNumber(value);
  if (Math.abs(number) >= 10000000) return `₹${(number / 10000000).toFixed(2)}Cr`;
  if (Math.abs(number) >= 100000) return `₹${(number / 100000).toFixed(2)}L`;
  if (Math.abs(number) >= 1000) return `₹${(number / 1000).toFixed(1)}K`;
  return formatCurrency(number);
};

const formatNumber = (value) => safeNumber(value).toLocaleString("en-IN");

const formatPercent = (value) => `${safeNumber(value).toFixed(1)}%`;

const getStatusClass = (status) =>
  status ? String(status).toLowerCase().replace(/\s+/g, "-") : "";

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="section-header">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function MetricCard({ label, value, subtitle, icon, tone = "blue", trend }) {
  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <strong className="metric-value">{value}</strong>
      <div className="metric-bottom">
        <span>{subtitle}</span>
        {trend && <span className={`metric-trend ${trend.type || "neutral"}`}>{trend.text}</span>}
      </div>
    </article>
  );
}

function MiniProgress({ value, max = 100, tone = "blue" }) {
  const percentage = Math.max(0, Math.min(100, (safeNumber(value) / safeNumber(max, 100)) * 100));
  return (
    <div className="mini-progress">
      <div className={`mini-progress-fill ${tone}`} style={{ width: `${percentage}%` }} />
    </div>
  );
}

function DonutChart({ items, centerValue, centerLabel }) {
  const total = items.reduce((sum, item) => sum + safeNumber(item.value), 0);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const colors = ["#4f6df5", "#f0a21b", "#dc3d4b", "#16a36a", "#7c5cff"];

  return (
    <div className="donut-wrap">
      <div className="donut-chart">
        <svg viewBox="0 0 120 120" role="img" aria-label="Distribution chart">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#eef1f6" strokeWidth="15" />
          {total > 0 && items.map((item, index) => {
            const length = (safeNumber(item.value) / total) * circumference;
            const currentOffset = offset;
            offset += length;
            return (
              <circle
                key={`${item.label}-${index}`}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={colors[index % colors.length]}
                strokeWidth="15"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-currentOffset}
                transform="rotate(-90 60 60)"
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        <div className="donut-center">
          <strong>{centerValue}</strong>
          <span>{centerLabel}</span>
        </div>
      </div>
      <div className="donut-legend">
        {items.map((item, index) => (
          <div className="legend-row" key={item.label}>
            <span className="legend-name">
              <i style={{ background: colors[index % colors.length] }} />
              {item.label}
            </span>
            <strong>{formatNumber(item.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ items, valueKey = "value", labelKey = "label", formatter = formatNumber, tone = "blue" }) {
  const max = Math.max(...items.map((item) => safeNumber(item[valueKey])), 1);
  return (
    <div className="bar-chart">
      {items.length === 0 ? (
        <div className="empty-state">No chart data available.</div>
      ) : (
        items.map((item, index) => {
          const value = safeNumber(item[valueKey]);
          const width = Math.max(4, (value / max) * 100);
          return (
            <div className="bar-row" key={`${item[labelKey]}-${index}`}>
              <div className="bar-label" title={item[labelKey]}>{item[labelKey]}</div>
              <div className="bar-track"><div className={`bar-fill ${tone}`} style={{ width: `${width}%` }} /></div>
              <strong className="bar-value">{formatter(value)}</strong>
            </div>
          );
        })
      )}
    </div>
  );
}

function LineChart({ items, valueKey = "value", labelKey = "label", formatter = formatCompactCurrency }) {
  if (!items.length) return <div className="empty-state">No trend data available.</div>;
  const width = 720;
  const height = 250;
  const padX = 42;
  const padY = 28;
  const values = items.map((item) => safeNumber(item[valueKey]));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const points = items.map((item, index) => {
    const x = padX + (index * (width - padX * 2)) / Math.max(items.length - 1, 1);
    const y = height - padY - ((safeNumber(item[valueKey]) - min) / range) * (height - padY * 2);
    return { x, y, value: safeNumber(item[valueKey]), label: item[labelKey] };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padX},${height - padY} ${polyline} ${width - padX},${height - padY}`;

  return (
    <div className="line-chart-wrap">
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {[0, 1, 2, 3].map((line) => {
          const y = padY + (line * (height - padY * 2)) / 3;
          return <line key={line} x1={padX} x2={width - padX} y1={y} y2={y} className="chart-grid-line" />;
        })}
        <polygon points={area} className="chart-area" />
        <polyline points={polyline} className="chart-line" fill="none" />
        {points.map((point, index) => (
          <circle key={index} cx={point.x} cy={point.y} r="4" className="chart-point">
            <title>{`${point.label}: ${formatter(point.value)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="chart-labels">
        {items.map((item, index) => <span key={index}>{item[labelKey]}</span>)}
      </div>
    </div>
  );
}

function HealthGauge({ score, status }) {
  const value = Math.max(0, Math.min(100, safeNumber(score)));
  const radius = 54;
  const circumference = Math.PI * radius;
  const dash = (value / 100) * circumference;
  return (
    <div className="health-gauge-wrap">
      <svg viewBox="0 0 140 90" className="health-gauge">
        <path d="M16 72 A54 54 0 0 1 124 72" className="gauge-bg" />
        <path d="M16 72 A54 54 0 0 1 124 72" className="gauge-value" strokeDasharray={`${dash} ${circumference}`} />
      </svg>
      <div className="health-gauge-value"><strong>{value}</strong><span>/ 100</span></div>
      <span className={`health-status ${getStatusClass(status)}`}>{status || "Unknown"}</span>
    </div>
  );
}

function App() {
  const [activePage, setActivePage] = useState("overview");
  const [revenue, setRevenue] = useState([]);
  const [usage, setUsage] = useState([]);
  const [liveEvents, setLiveEvents] = useState([]);
  const [customerHealth, setCustomerHealth] = useState(null);
  const [customerHealthList, setCustomerHealthList] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [churnRisk, setChurnRisk] = useState([]);
  const [dataQuality, setDataQuality] = useState([]);
  const [forecasts, setForecasts] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [riskSummary, setRiskSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Authentication state is intentionally kept independent from dashboard presentation.
  const [authToken, setAuthToken] = useState(() => sessionStorage.getItem("saas_access_token") || "");
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = sessionStorage.getItem("saas_user");
    try {
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const logout = () => {
    sessionStorage.removeItem("saas_access_token");
    sessionStorage.removeItem("saas_user");
    setAuthToken("");
    setCurrentUser(null);
    setDashboard(null);
    setError("");
    setLoading(false);
  };

  const authFetch = async (url, options = {}) => {
    const token = sessionStorage.getItem("saas_access_token");
    if (!token) {
      logout();
      throw new Error("Authentication required.");
    }
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
      logout();
      throw new Error("Your session has expired. Please log in again.");
    }
    return response;
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Login failed.");
      sessionStorage.setItem("saas_access_token", data.access_token);
      sessionStorage.setItem("saas_user", JSON.stringify(data.user));
      setAuthToken(data.access_token);
      setCurrentUser(data.user);
      setLoginPassword("");
    } catch (err) {
      console.error(err);
      setLoginError(err.message || "Unable to sign in.");
    } finally {
      setLoginLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError("");
      const [dashboardResponse, riskResponse, revenueResponse, usageResponse, eventsResponse, healthResponse, customerHealthListResponse, churnRiskResponse, alertsResponse, dataQualityResponse, forecastsResponse] = await Promise.all([
        authFetch(`${API_BASE_URL}/api/dashboard`),
        authFetch(`${API_BASE_URL}/api/risk`),
        authFetch(`${API_BASE_URL}/api/revenue`),
        authFetch(`${API_BASE_URL}/api/product/usage?limit=8`),
        authFetch(`${API_BASE_URL}/api/events/live?limit=8`),
        authFetch(`${API_BASE_URL}/api/customers/100003/health`),
        authFetch(`${API_BASE_URL}/api/customer-health?limit=10`),
        authFetch(`${API_BASE_URL}/api/churn-risk?limit=10`),
        authFetch(`${API_BASE_URL}/api/alerts?limit=20`),
        authFetch(`${API_BASE_URL}/api/data-quality`),
        authFetch(`${API_BASE_URL}/api/forecasts`),
      ]);
      const responses = [dashboardResponse, riskResponse, revenueResponse, usageResponse, eventsResponse, healthResponse, customerHealthListResponse, churnRiskResponse, alertsResponse, dataQualityResponse, forecastsResponse];
      if (responses.some((response) => !response.ok)) throw new Error("One or more API requests failed.");
      const [dashboardData, riskData, revenueData, usageData, eventsData, healthData, customerHealthListData, churnRiskData, alertsData, dataQualityData, forecastsData] = await Promise.all(responses.map((response) => response.json()));
      setDashboard(dashboardData);
      setRiskSummary(riskData);
      setRevenue(Array.isArray(revenueData) ? revenueData : []);
      setUsage(Array.isArray(usageData) ? usageData : []);
      setLiveEvents(Array.isArray(eventsData) ? eventsData : []);
      setCustomerHealth(healthData);
      setCustomerHealthList(Array.isArray(customerHealthListData) ? customerHealthListData : []);
      setChurnRisk(Array.isArray(churnRiskData) ? churnRiskData : []);
      setAlerts(Array.isArray(alertsData) ? alertsData : []);
      setDataQuality(Array.isArray(dataQualityData) ? dataQualityData : []);
      setForecasts(Array.isArray(forecastsData) ? forecastsData : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Unable to load dashboard data. Make sure the FastAPI server is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authToken) {
      setLoading(false);
      return undefined;
    }
    fetchDashboardData();
    const interval = setInterval(() => {
      authFetch(`${API_BASE_URL}/api/events/live?limit=8`)
        .then((response) => response.json())
        .then((data) => setLiveEvents(Array.isArray(data) ? data : []))
        .catch((err) => console.error(err));
    }, 5000);
    return () => clearInterval(interval);
  }, [authToken]);

  const usageByFeature = useMemo(() => {
    const map = new Map();
    usage.forEach((item) => {
      const key = item.feature || "Unknown";
      map.set(key, (map.get(key) || 0) + safeNumber(item.total_events));
    });
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [usage]);

  const usageTrend = useMemo(() => {
    const map = new Map();
    usage.forEach((item) => {
      const date = item.usage_date ? formatDate(item.usage_date).replace(/\s+\d{4}$/, "") : "Unknown";
      map.set(date, (map.get(date) || 0) + safeNumber(item.total_events));
    });
    return [...map.entries()].map(([label, value]) => ({ label, value })).slice(-8);
  }, [usage]);

  const revenuePlanChart = useMemo(() => revenue.map((item) => ({ label: item.plan || "Plan", value: safeNumber(item.active_mrr) })), [revenue]);

  const forecastChart = useMemo(() => forecasts.map((item) => ({
    label: item.forecast_month ? new Date(item.forecast_month).toLocaleDateString("en-US", { month: "short" }) : "Forecast",
    value: safeNumber(item.forecast_revenue),
  })), [forecasts]);

  const riskChart = useMemo(() => {
    if (!riskSummary) return [];
    return [
      { label: "High risk", value: safeNumber(riskSummary.high_risk_customers) },
      { label: "Medium risk", value: safeNumber(riskSummary.medium_risk_customers) },
      { label: "Low risk", value: safeNumber(riskSummary.low_risk_customers) },
    ];
  }, [riskSummary]);

  const healthChart = useMemo(() => {
    if (!dashboard) return [];
    return [
      { label: "Healthy", value: safeNumber(dashboard.healthy_customers) },
      { label: "Watch", value: safeNumber(dashboard.watch_customers) },
      { label: "At risk", value: safeNumber(dashboard.at_risk_customers) },
    ];
  }, [dashboard]);

  const openAlerts = useMemo(() => alerts.filter((alert) => String(alert.status).toLowerCase() === "open"), [alerts]);
  const recentHighAlerts = useMemo(() => alerts.filter((alert) => String(alert.severity).toLowerCase() === "high"), [alerts]);
  const dqPassCount = useMemo(() => dataQuality.filter((item) => String(item.status).toLowerCase() === "pass").length, [dataQuality]);
  const dqWarnCount = useMemo(() => dataQuality.filter((item) => String(item.status).toLowerCase() === "warn").length, [dataQuality]);

  const acknowledgeAlert = async (alert) => {
    try {
      const response = await authFetch(`${API_BASE_URL}/api/alerts/${alert.alert_id}/acknowledge`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to acknowledge alert");
      setAlerts((current) => current.map((item) => item.alert_id === alert.alert_id ? { ...item, status: "Acknowledged" } : item));
    } catch (err) {
      console.error(err);
      window.alert("Failed to acknowledge alert.");
    }
  };

  const createCustomerAction = async (alert) => {
    try {
      let actionType = "Customer Success Outreach";
      if (alert.alert_type === "Expansion Opportunity") actionType = "Expansion Outreach";
      else if (alert.alert_type === "Payment Failure") actionType = "Billing Follow-up";
      const params = new URLSearchParams({
        customer_id: String(alert.customer_id),
        action_type: actionType,
        owner: alert.owner || "CSM",
        notes: alert.reason || "",
      });
      const response = await authFetch(`${API_BASE_URL}/api/customer-action?${params.toString()}`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to create customer action");
      const result = await response.json();
      window.alert(`Customer action created successfully.\nAction ID: ${result.action_id}`);
    } catch (err) {
      console.error(err);
      window.alert("Failed to create customer action.");
    }
  };

  const renderOverview = () => (
    <div className="page-stack">
      <div className="hero-panel">
        <div>
          <span className="eyebrow">SAAS OPERATIONS COMMAND CENTER</span>
          <h2>Business performance at a glance.</h2>
          <p>Revenue, product adoption, customer health, predictive risk and live operational signals in one place.</p>
        </div>
        <div className="hero-badges">
          <span className="soft-badge blue">Live data</span>
          <span className="soft-badge green"><i /> Auto refresh 5s</span>
        </div>
      </div>

      <section className="metric-grid">
        <MetricCard label="Active MRR" value={formatCompactCurrency(dashboard?.active_mrr)} subtitle="Monthly recurring revenue" icon="₹" tone="blue" />
        <MetricCard label="Active ARR" value={formatCompactCurrency(dashboard?.active_arr)} subtitle="Annual recurring revenue" icon="↗" tone="purple" />
        <MetricCard label="Active customers" value={formatNumber(dashboard?.active_customers)} subtitle="Customers with active subscriptions" icon="◎" tone="green" />
        <MetricCard label="Active subscriptions" value={formatNumber(dashboard?.active_subscriptions)} subtitle="Current active subscriptions" icon="◇" tone="orange" />
      </section>

      <section className="dashboard-grid grid-main">
        <article className="panel chart-panel large-panel">
          <SectionHeader title="Revenue by plan" subtitle="Current recurring revenue across subscription tiers" action={<span className="panel-total">{formatCompactCurrency(dashboard?.active_mrr)} MRR</span>} />
          <BarChart items={revenuePlanChart} formatter={formatCompactCurrency} />
          <div className="chart-footnote">Enterprise, Professional and Starter subscription contribution.</div>
        </article>

        <article className="panel chart-panel">
          <SectionHeader title="Customer health" subtitle="Current health distribution" />
          <DonutChart items={healthChart} centerValue={formatNumber(dashboard?.active_customers)} centerLabel="customers" />
        </article>
      </section>

      <section className="dashboard-grid grid-main">
        <article className="panel chart-panel">
          <SectionHeader title="Churn risk distribution" subtitle="Current predictive risk population" />
          <DonutChart items={riskChart} centerValue={formatNumber(riskSummary?.total_customers)} centerLabel="risk scored" />
        </article>

        <article className="panel chart-panel large-panel">
          <SectionHeader title="Product activity trend" subtitle="Recent product events returned by the analytics API" />
          <LineChart items={usageTrend} formatter={formatNumber} />
        </article>
      </section>

      <section className="dashboard-grid grid-main">
        <article className="panel">
          <SectionHeader title="Operational snapshot" subtitle="What needs attention right now" />
          <div className="snapshot-grid">
            <div className="snapshot-card"><span>At-risk customers</span><strong>{formatNumber(dashboard?.at_risk_customers)}</strong><small>Health score below watch threshold</small></div>
            <div className="snapshot-card"><span>Open alerts</span><strong>{formatNumber(dashboard?.open_alerts ?? openAlerts.length)}</strong><small>Recent API alert feed</small></div>
            <div className="snapshot-card"><span>High-risk customers</span><strong>{formatNumber(riskSummary?.high_risk_customers)}</strong><small>Highest predicted churn segment</small></div>
            <div className="snapshot-card"><span>DQ warnings</span><strong>{formatNumber(dqWarnCount)}</strong><small>{dqPassCount} checks currently passing</small></div>
          </div>
        </article>

        <article className="panel">
          <SectionHeader title="Live product activity" subtitle="Kafka → PostgreSQL → FastAPI" action={<span className="live-pill"><i /> LIVE</span>} />
          <div className="event-feed compact">
            {liveEvents.slice(0, 5).map((event) => (
              <div className="event-row" key={event.event_id}>
                <span className="event-dot" />
                <div className="event-main"><strong>{event.feature || event.event_type || "Product event"}</strong><small>Customer {event.customer_id} · User {event.user_id}</small></div>
                <time>{formatTime(event.received_at)}</time>
              </div>
            ))}
            {!liveEvents.length && <div className="empty-state">Waiting for live events.</div>}
          </div>
        </article>
      </section>
    </div>
  );

  const renderCustomers = () => (
    <div className="page-stack">
      <div className="page-heading"><span className="eyebrow">CUSTOMER INTELLIGENCE</span><h2>Know which customers need attention.</h2><p>Combine health scoring and predictive churn signals to support customer-success decisions.</p></div>
      <section className="metric-grid three">
        <MetricCard label="Healthy" value={formatNumber(dashboard?.healthy_customers)} subtitle="Healthy customer population" icon="✓" tone="green" />
        <MetricCard label="Watch" value={formatNumber(dashboard?.watch_customers)} subtitle="Customers worth monitoring" icon="△" tone="orange" />
        <MetricCard label="At risk" value={formatNumber(dashboard?.at_risk_customers)} subtitle="Customers below health threshold" icon="!" tone="red" />
      </section>
      <section className="dashboard-grid grid-main">
        <article className="panel chart-panel"><SectionHeader title="Health distribution" subtitle="Current customer-health classification" /><DonutChart items={healthChart} centerValue={formatNumber(dashboard?.active_customers)} centerLabel="customers" /></article>
        <article className="panel chart-panel large-panel"><SectionHeader title="Churn probability" subtitle="Highest-risk customers returned by the model" /><BarChart items={churnRisk.slice(0, 8).map((item) => ({ label: `#${item.customer_id}`, value: safeNumber(item.churn_probability) * 100 }))} formatter={formatPercent} tone="red" /></article>
      </section>
      <section className="panel"><SectionHeader title="Customer health watchlist" subtitle="Customers with the lowest current health scores" /><div className="table-container"><table><thead><tr><th>Customer</th><th>Usage</th><th>Support</th><th>Billing</th><th>Health</th><th>Status</th></tr></thead><tbody>{customerHealthList.map((customer) => <tr key={customer.customer_id}><td><strong>{customer.customer_id}</strong></td><td>{customer.usage_score}</td><td>{customer.support_score}</td><td>{customer.billing_score}</td><td><div className="table-score"><span>{customer.health_score}</span><MiniProgress value={customer.health_score} /></div></td><td><span className={`health-status ${getStatusClass(customer.health_status)}`}>{customer.health_status}</span></td></tr>)}</tbody></table></div></section>
      <section className="panel"><SectionHeader title="Churn risk model output" subtitle="Top predicted churn probabilities" /><div className="table-container"><table><thead><tr><th>Customer</th><th>Probability</th><th>Risk level</th></tr></thead><tbody>{churnRisk.map((customer) => <tr key={customer.customer_id}><td><strong>{customer.customer_id}</strong></td><td><div className="table-score"><span>{formatPercent(safeNumber(customer.churn_probability) * 100)}</span><MiniProgress value={safeNumber(customer.churn_probability) * 100} tone="red" /></div></td><td><span className={`risk-badge ${getStatusClass(customer.risk_level)}`}>{customer.risk_level}</span></td></tr>)}</tbody></table></div></section>
    </div>
  );

  const renderProduct = () => (
    <div className="page-stack">
      <div className="page-heading"><span className="eyebrow">PRODUCT ANALYTICS</span><h2>See how customers use the product.</h2><p>Feature adoption, event volume and live product activity from the analytics platform.</p></div>
      <section className="metric-grid three">
        <MetricCard label="Features observed" value={formatNumber(usageByFeature.length)} subtitle="Features represented in recent API results" icon="◆" tone="blue" />
        <MetricCard label="Recent events" value={formatNumber(usage.reduce((sum, item) => sum + safeNumber(item.total_events), 0))} subtitle="Events in the current usage response" icon="↗" tone="purple" />
        <MetricCard label="Live events" value={formatNumber(liveEvents.length)} subtitle="Latest events stored in the platform" icon="●" tone="green" />
      </section>
      <section className="dashboard-grid grid-main">
        <article className="panel chart-panel large-panel"><SectionHeader title="Feature adoption volume" subtitle="Recent event volume by feature" /><BarChart items={usageByFeature} formatter={formatNumber} tone="purple" /></article>
        <article className="panel chart-panel"><SectionHeader title="Usage trend" subtitle="Recent event volume by date" /><LineChart items={usageTrend} formatter={formatNumber} /></article>
      </section>
      <section className="panel"><SectionHeader title="Product usage detail" subtitle="Usage records returned by the product analytics endpoint" /><div className="table-container"><table><thead><tr><th>Date</th><th>Feature</th><th>Events</th><th>Daily users</th><th>Monthly users</th><th>DAU / MAU</th></tr></thead><tbody>{usage.map((item, index) => <tr key={`${item.usage_date}-${item.feature}-${index}`}><td>{formatDate(item.usage_date)}</td><td><strong>{item.feature}</strong></td><td>{formatNumber(item.total_events)}</td><td>{formatNumber(item.daily_active_users)}</td><td>{formatNumber(item.monthly_active_users)}</td><td>{item.daily_to_monthly_active_pct != null ? formatPercent(item.daily_to_monthly_active_pct) : "—"}</td></tr>)}</tbody></table></div></section>
      <section className="panel"><SectionHeader title="Live product events" subtitle="Kafka → PostgreSQL → FastAPI" action={<span className="live-pill"><i /> LIVE</span>} /><div className="event-feed">{liveEvents.map((event) => <div className="event-row" key={event.event_id}><span className="event-dot" /><div className="event-main"><strong>{event.feature || event.event_type || "Product event"}</strong><small>Customer {event.customer_id} · User {event.user_id}</small></div><time>{formatTime(event.received_at)}</time></div>)}{!liveEvents.length && <div className="empty-state">No live events available.</div>}</div></section>
    </div>
  );

  const renderRevenue = () => (
    <div className="page-stack">
      <div className="page-heading"><span className="eyebrow">REVENUE INTELLIGENCE</span><h2>Understand recurring revenue and the outlook.</h2><p>Current subscription revenue, plan mix and the three-month forecast.</p></div>
      <section className="metric-grid four">
        <MetricCard label="Active MRR" value={formatCompactCurrency(dashboard?.active_mrr)} subtitle="Current monthly recurring revenue" icon="₹" tone="blue" />
        <MetricCard label="Active ARR" value={formatCompactCurrency(dashboard?.active_arr)} subtitle="Current annual recurring revenue" icon="↗" tone="purple" />
        <MetricCard label="Active customers" value={formatNumber(dashboard?.active_customers)} subtitle="Customers contributing to active revenue" icon="◎" tone="green" />
        <MetricCard label="Active subscriptions" value={formatNumber(dashboard?.active_subscriptions)} subtitle="Current active subscriptions" icon="◇" tone="orange" />
      </section>
      <section className="dashboard-grid grid-main">
        <article className="panel chart-panel large-panel"><SectionHeader title="MRR by plan" subtitle="Current recurring revenue contribution" /><BarChart items={revenuePlanChart} formatter={formatCompactCurrency} /></article>
        <article className="panel chart-panel"><SectionHeader title="Revenue mix" subtitle="Plan contribution to active MRR" /><DonutChart items={revenuePlanChart} centerValue={formatCompactCurrency(dashboard?.active_mrr)} centerLabel="active MRR" /></article>
      </section>
      <section className="panel"><SectionHeader title="Revenue by plan" subtitle="Current subscription revenue detail" /><div className="table-container"><table><thead><tr><th>Plan</th><th>Customers</th><th>Subscriptions</th><th>MRR</th><th>ARR</th></tr></thead><tbody>{revenue.map((item) => <tr key={item.plan}><td><strong>{item.plan}</strong></td><td>{formatNumber(item.active_customers)}</td><td>{formatNumber(item.active_subscriptions)}</td><td>{formatCurrency(item.active_mrr)}</td><td>{formatCurrency(item.active_arr)}</td></tr>)}</tbody></table></div></section>
      <section className="panel chart-panel"><SectionHeader title="Revenue forecast" subtitle="Next three months predicted revenue" /><LineChart items={forecastChart} formatter={formatCompactCurrency} /><div className="forecast-meta-grid">{forecasts.map((forecast) => <div className="forecast-meta" key={forecast.forecast_month}><span>{forecast.forecast_month ? new Date(forecast.forecast_month).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "Forecast"}</span><strong>{formatCurrency(forecast.forecast_revenue)}</strong><small>{forecast.model_name || "Forecast model"} · MAE {formatCurrency(forecast.validation_mae)}</small></div>)}</div></section>
    </div>
  );

  const renderRisk = () => (
    <div className="page-stack">
      <div className="page-heading"><span className="eyebrow">RISK & MACHINE LEARNING</span><h2>Turn predictive signals into customer action.</h2><p>Churn-risk distribution and model outputs available through the command center.</p></div>
      <section className="metric-grid three">
        <MetricCard label="Risk scored" value={formatNumber(riskSummary?.total_customers)} subtitle="Customers evaluated by the risk model" icon="Σ" tone="blue" />
        <MetricCard label="High risk" value={formatNumber(riskSummary?.high_risk_customers)} subtitle="Highest predicted churn segment" icon="!" tone="red" />
        <MetricCard label="Medium risk" value={formatNumber(riskSummary?.medium_risk_customers)} subtitle="Customers needing monitoring" icon="△" tone="orange" />
      </section>
      <section className="dashboard-grid grid-main">
        <article className="panel chart-panel"><SectionHeader title="Risk distribution" subtitle="Current model population" /><DonutChart items={riskChart} centerValue={formatNumber(riskSummary?.total_customers)} centerLabel="risk scored" /></article>
        <article className="panel chart-panel large-panel"><SectionHeader title="Top churn-risk customers" subtitle="Highest predicted probabilities" /><BarChart items={churnRisk.slice(0, 8).map((item) => ({ label: `Customer ${item.customer_id}`, value: safeNumber(item.churn_probability) * 100 }))} formatter={formatPercent} tone="red" /></article>
      </section>
      <section className="panel"><SectionHeader title="Model output" subtitle="Customer-level churn predictions" /><div className="table-container"><table><thead><tr><th>Customer</th><th>Probability</th><th>Risk</th></tr></thead><tbody>{churnRisk.map((customer) => <tr key={customer.customer_id}><td><strong>{customer.customer_id}</strong></td><td>{formatPercent(safeNumber(customer.churn_probability) * 100)}</td><td><span className={`risk-badge ${getStatusClass(customer.risk_level)}`}>{customer.risk_level}</span></td></tr>)}</tbody></table></div></section>
      <section className="model-note"><strong>Model context</strong><span>The current churn model is based on the available synthetic current-state data. Its score is a prioritization signal, not a guaranteed outcome.</span></section>
    </div>
  );

  const renderAlerts = () => (
    <div className="page-stack">
      <div className="page-heading"><span className="eyebrow">ALERT CENTER</span><h2>Move from signal to action.</h2><p>Customer-success, billing and live-product alerts generated by the platform.</p></div>
      <section className="metric-grid four">
        <MetricCard label="Recent alerts" value={formatNumber(alerts.length)} subtitle="Latest alert API response" icon="!" tone="blue" />
        <MetricCard label="Open in feed" value={formatNumber(openAlerts.length)} subtitle="Alerts available for action" icon="●" tone="orange" />
        <MetricCard label="High severity" value={formatNumber(recentHighAlerts.length)} subtitle="High-severity recent alerts" icon="↑" tone="red" />
        <MetricCard label="Expansion signals" value={formatNumber(alerts.filter((a) => a.alert_type === "Expansion Opportunity").length)} subtitle="Expansion opportunities in feed" icon="↗" tone="green" />
      </section>
      <section className="panel"><SectionHeader title="Active alert queue" subtitle="Acknowledge an alert or create a customer action" /><div className="alert-grid">{alerts.map((alert) => <article className={`alert-card severity-${getStatusClass(alert.severity)}`} key={alert.alert_id}><div className="alert-card-top"><span className={`severity-badge ${getStatusClass(alert.severity)}`}>{alert.severity}</span><span className="alert-status">{alert.status}</span></div><h3>{alert.alert_type}</h3><p>{alert.reason}</p><div className="alert-meta"><span>Customer <strong>{alert.customer_id}</strong></span><span>Owner <strong>{alert.owner}</strong></span></div>{alert.status === "Open" ? <div className="alert-actions"><button className="secondary-button" type="button" onClick={() => acknowledgeAlert(alert)}>Acknowledge</button><button className="primary-button" type="button" onClick={() => createCustomerAction(alert)}>Create Action</button></div> : <div className="alert-done">✓ Acknowledged</div>}</article>)}{!alerts.length && <div className="empty-state">No alerts available.</div>}</div></section>
    </div>
  );

  const renderDataQuality = () => (
    <div className="page-stack">
      <div className="page-heading"><span className="eyebrow">DATA QUALITY</span><h2>Trust the data behind the dashboard.</h2><p>Latest automated quality checks from the pipeline and analytics layer.</p></div>
      <section className="metric-grid three">
        <MetricCard label="Checks" value={formatNumber(dataQuality.length)} subtitle="Latest recorded checks" icon="✓" tone="blue" />
        <MetricCard label="Passing" value={formatNumber(dqPassCount)} subtitle="Checks currently passing" icon="✓" tone="green" />
        <MetricCard label="Warnings" value={formatNumber(dqWarnCount)} subtitle="Checks requiring documented attention" icon="△" tone="orange" />
      </section>
      <section className="dashboard-grid grid-main">
        <article className="panel chart-panel"><SectionHeader title="Quality status" subtitle="Pass versus warning results" /><DonutChart items={[{ label: "Pass", value: dqPassCount }, { label: "Warn", value: dqWarnCount }]} centerValue={formatNumber(dataQuality.length)} centerLabel="checks" /></article>
        <article className="panel"><SectionHeader title="Pipeline health" subtitle="Current quality posture" /><div className="quality-summary"><div className="quality-score"><strong>{dataQuality.length ? Math.round((dqPassCount / dataQuality.length) * 100) : 0}%</strong><span>passing</span></div><div className="quality-check"><span>Null / duplicate checks</span><b>Validated</b></div><div className="quality-check"><span>Referential integrity</span><b>Validated</b></div><div className="quality-check"><span>Business-rule warnings</span><b>{dqWarnCount}</b></div></div></article>
      </section>
      <section className="panel"><SectionHeader title="Quality check detail" subtitle="Latest automated data-quality results" /><div className="table-container"><table><thead><tr><th>Check</th><th>Table</th><th>Type</th><th>Status</th><th>Actual</th><th>Expected</th><th>Message</th></tr></thead><tbody>{dataQuality.map((check, index) => <tr key={`${check.check_name}-${index}`}><td><strong>{check.check_name}</strong></td><td>{check.table_name}</td><td>{check.check_type}</td><td><span className={`quality-badge ${getStatusClass(check.status)}`}>{check.status}</span></td><td>{check.actual_value ?? "—"}</td><td>{check.expected_value ?? "—"}</td><td className="message-cell">{check.message || "—"}</td></tr>)}</tbody></table></div></section>
    </div>
  );

  const renderPage = () => {
    switch (activePage) {
      case "customers": return renderCustomers();
      case "product": return renderProduct();
      case "revenue": return renderRevenue();
      case "risk": return renderRisk();
      case "alerts": return renderAlerts();
      case "quality": return renderDataQuality();
      case "overview":
      default: return renderOverview();
    }
  };

  // Do not change the authentication flow below when modifying dashboard visuals.
  if (!authToken || !currentUser) {
    return (
      <div className="login-page">
        <div className="login-background-grid" />
        <div className="login-orbit orbit-one" />
        <div className="login-orbit orbit-two" />
        <div className="login-card">
          <div className="login-brand">
            <div className="login-brand-mark">S</div>
            <div><strong>SaaSCommand</strong><span>360 Analytics Command Center</span></div>
          </div>
          <div className="login-heading">
            <p className="login-eyebrow">SECURE ACCESS</p>
            <h1>Welcome back</h1>
            <p>Sign in to access your customer, revenue and risk intelligence.</p>
          </div>
          <form className="login-form" onSubmit={handleLogin}>
            <label>Email address<input type="email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} placeholder="you@company.com" autoComplete="username" required /></label>
            <label>Password<input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required /></label>
            {loginError && <div className="login-error">{loginError}</div>}
            <button className="login-button" type="submit" disabled={loginLoading}>{loginLoading ? "Signing in..." : "Sign in to Command Center"}</button>
          </form>
          <div className="login-security"><span>●</span> Protected with JWT authentication</div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout activePage={activePage} setActivePage={setActivePage} onRefresh={fetchDashboardData}>
      <div className="session-bar">
        <div><strong>{currentUser.full_name}</strong><span>{currentUser.role}</span></div>
        <button type="button" onClick={logout}>Sign out</button>
      </div>
      {loading && <div className="status"><div className="loading-spinner" /> Loading dashboard...</div>}
      {error && <div className="error"><strong>Dashboard data could not be loaded.</strong><span>{error}</span><button type="button" onClick={fetchDashboardData}>Try again</button></div>}
      {!loading && !error && dashboard && renderPage()}
      {!loading && !error && !dashboard && <div className="status">Preparing dashboard...</div>}
    </DashboardLayout>
  );
}

export default App;
