import { useEffect, useState } from "react";
import "./App.css";

const API_BASE_URL = "http://127.0.0.1:8000";

function App() {
  const [revenue, setRevenue] = useState([]);
  const [usage, setUsage] = useState([]);
  const [liveEvents, setLiveEvents] = useState([]);
  const [customerHealth, setCustomerHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        revenueResponse,
        usageResponse,
        eventsResponse,
        healthResponse,
      ] = await Promise.all([
        fetch(`${API_BASE_URL}/api/revenue`),
        fetch(`${API_BASE_URL}/api/product/usage?limit=8`),
        fetch(`${API_BASE_URL}/api/events/live?limit=8`),
        fetch(`${API_BASE_URL}/api/customers/100003/health`),
      ]);

      if (
        !revenueResponse.ok ||
        !usageResponse.ok ||
        !eventsResponse.ok ||
        !healthResponse.ok
      ) {
        throw new Error("One or more API requests failed.");
      }

      const revenueData = await revenueResponse.json();
      const usageData = await usageResponse.json();
      const eventsData = await eventsResponse.json();
      const healthData = await healthResponse.json();

      setRevenue(revenueData);
      setUsage(usageData);
      setLiveEvents(eventsData);
      setCustomerHealth(healthData);
    } catch (err) {
      console.error(err);
      setError(
        "Unable to load dashboard data. Make sure the FastAPI server is running."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    const interval = setInterval(() => {
      fetch(`${API_BASE_URL}/api/events/live?limit=8`)
        .then((response) => response.json())
        .then((data) => setLiveEvents(data))
        .catch((err) => console.error(err));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const totalMRR = revenue.reduce(
    (total, item) => total + Number(item.active_mrr || 0),
    0
  );

  const totalARR = revenue.reduce(
    (total, item) => total + Number(item.active_arr || 0),
    0
  );

  const totalCustomers = revenue.reduce(
    (total, item) => total + Number(item.active_customers || 0),
    0
  );

  const totalSubscriptions = revenue.reduce(
    (total, item) => total + Number(item.active_subscriptions || 0),
    0
  );

  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>SaaSCommand 360</h1>
          <p>Customer, revenue, product and live-event intelligence</p>
        </div>

        <button className="refresh-button" onClick={fetchDashboardData}>
          Refresh
        </button>
      </header>

      <main className="dashboard">
        {loading && <div className="status">Loading dashboard...</div>}

        {error && <div className="error">{error}</div>}

        {!loading && !error && (
          <>
            <section className="kpi-grid">
              <div className="kpi-card">
                <span>Active MRR</span>
                <strong>{formatCurrency(totalMRR)}</strong>
                <small>Monthly recurring revenue</small>
              </div>

              <div className="kpi-card">
                <span>Active ARR</span>
                <strong>{formatCurrency(totalARR)}</strong>
                <small>Annual recurring revenue</small>
              </div>

              <div className="kpi-card">
                <span>Active Customers</span>
                <strong>{totalCustomers.toLocaleString()}</strong>
                <small>Customers with active subscriptions</small>
              </div>

              <div className="kpi-card">
                <span>Active Subscriptions</span>
                <strong>{totalSubscriptions.toLocaleString()}</strong>
                <small>Current active subscriptions</small>
              </div>
            </section>

            <section className="content-grid">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Revenue by Plan</h2>
                    <p>Current subscription revenue</p>
                  </div>
                </div>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Plan</th>
                        <th>Customers</th>
                        <th>Subscriptions</th>
                        <th>MRR</th>
                        <th>ARR</th>
                      </tr>
                    </thead>

                    <tbody>
                      {revenue.map((item) => (
                        <tr key={item.plan}>
                          <td>
                            <strong>{item.plan}</strong>
                          </td>
                          <td>{item.active_customers}</td>
                          <td>{item.active_subscriptions}</td>
                          <td>{formatCurrency(item.active_mrr)}</td>
                          <td>{formatCurrency(item.active_arr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel health-panel">
                <div className="panel-header">
                  <div>
                    <h2>Customer Health</h2>
                    <p>Example customer: 100003</p>
                  </div>
                </div>

                {customerHealth && (
                  <div className="health-content">
                    <div className="health-score">
                      <strong>{customerHealth.health_score}</strong>
                      <span>/ 100</span>
                    </div>

                    <div
                      className={`health-status ${customerHealth.health_status
                        .toLowerCase()
                        .replace(" ", "-")}`}
                    >
                      {customerHealth.health_status}
                    </div>

                    <div className="score-row">
                      <span>Usage</span>
                      <strong>{customerHealth.usage_score}</strong>
                    </div>

                    <div className="score-row">
                      <span>Support</span>
                      <strong>{customerHealth.support_score}</strong>
                    </div>

                    <div className="score-row">
                      <span>Billing</span>
                      <strong>{customerHealth.billing_score}</strong>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="content-grid">
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Product Usage</h2>
                    <p>Recent feature activity</p>
                  </div>
                </div>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Feature</th>
                        <th>Events</th>
                        <th>Daily Users</th>
                        <th>Monthly Users</th>
                      </tr>
                    </thead>

                    <tbody>
                      {usage.map((item, index) => (
                        <tr key={`${item.usage_date}-${item.feature}-${index}`}>
                          <td>{item.usage_date}</td>
                          <td>{item.feature}</td>
                          <td>{item.total_events}</td>
                          <td>{item.daily_active_users}</td>
                          <td>{item.monthly_active_users}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Live Events</h2>
                    <p>Kafka → PostgreSQL → FastAPI</p>
                  </div>

                  <span className="live-indicator">
                    <span></span>
                    LIVE
                  </span>
                </div>

                <div className="event-list">
                  {liveEvents.map((event) => (
                    <div className="event-item" key={event.event_id}>
                      <div>
                        <strong>{event.feature || event.event_type}</strong>
                        <small>
                          Customer {event.customer_id} · User {event.user_id}
                        </small>
                      </div>

                      <span>
                        {new Date(event.received_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;