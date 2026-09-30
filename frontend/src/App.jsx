import { useEffect, useState } from "react";
import "./App.css";

const API_BASE_URL = "http://127.0.0.1:8000";

function App() {
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

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        dashboardResponse,
        riskResponse,
        revenueResponse,
        usageResponse,
        eventsResponse,
        healthResponse,
        customerHealthListResponse,
        churnRiskResponse,
        alertsResponse,
        dataQualityResponse,
        forecastsResponse
      ] = await Promise.all([
        fetch(`${API_BASE_URL}/api/dashboard`),
        fetch(`${API_BASE_URL}/api/risk`),
        fetch(`${API_BASE_URL}/api/revenue`),
        fetch(`${API_BASE_URL}/api/product/usage?limit=8`),
        fetch(`${API_BASE_URL}/api/events/live?limit=8`),
        fetch(`${API_BASE_URL}/api/customers/100003/health`),
        fetch(`${API_BASE_URL}/api/customer-health?limit=10`),
        fetch(`${API_BASE_URL}/api/churn-risk?limit=10`),
        fetch(`${API_BASE_URL}/api/alerts?limit=20`),
        fetch(`${API_BASE_URL}/api/data-quality`),
        fetch(`${API_BASE_URL}/api/forecasts`)
      ]);

      if (
        !dashboardResponse.ok ||
        !riskResponse.ok ||
        !revenueResponse.ok ||
        !usageResponse.ok ||
        !eventsResponse.ok ||
        !healthResponse.ok ||
        !customerHealthListResponse.ok ||
        !alertsResponse.ok ||
        !churnRiskResponse.ok ||
        !dataQualityResponse.ok ||
        !forecastsResponse.ok
      ) {
        throw new Error("One or more API requests failed.");
      }

      const dashboardData = await dashboardResponse.json();
      const riskData = await riskResponse.json();
      const revenueData = await revenueResponse.json();
      const usageData = await usageResponse.json();
      const eventsData = await eventsResponse.json();
      const healthData = await healthResponse.json();
      const customerHealthListData = await customerHealthListResponse.json();
      const churnRiskData = await churnRiskResponse.json();
      const alertsData = await alertsResponse.json();
      const dataQualityData = await dataQualityResponse.json();
      const forecastsData = await forecastsResponse.json();

      setDashboard(dashboardData);
      setRiskSummary(riskData);
      setRevenue(revenueData);
      setUsage(usageData);
      setLiveEvents(eventsData);
      setCustomerHealth(healthData);
      setCustomerHealthList(customerHealthListData);
      setChurnRisk(churnRiskData);
      setAlerts(alertsData);
      setDataQuality(dataQualityData);
      setForecasts(forecastsData);
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
                <strong>{formatCurrency(dashboard.active_mrr)}</strong>
                <small>Monthly recurring revenue</small>
              </div>

              <div className="kpi-card">
                <span>Active ARR</span>
                <strong>{formatCurrency(dashboard.active_arr)}</strong>
                <small>Annual recurring revenue</small>
              </div>

              <div className="kpi-card">
                <span>Active Customers</span>
                <strong>{dashboard.active_customers.toLocaleString()}</strong>
                <small>Customers with active subscriptions</small>
              </div>

              <div className="kpi-card">
                <span>Active Subscriptions</span>
                <strong>{dashboard.active_subscriptions.toLocaleString()}</strong>
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
            <div className="section-card">

<section className="section-card">
  <div className="section-header">
    <div>
      <h2>Revenue Forecast</h2>
      <p>Next 3 months predicted revenue</p>
    </div>
  </div>

  <div className="forecast-grid">
    {forecasts.map((forecast) => (
      <div
        className="forecast-card"
        key={forecast.forecast_month}
      >
        <h3>
          {new Date(
            forecast.forecast_month
          ).toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          })}
        </h3>

        <div className="forecast-value">
          {formatCurrency(forecast.forecast_revenue)}
        </div>

        <p>
          Model: {forecast.model_name}
        </p>

        <p>
          Validation MAE:{" "}
          {formatCurrency(forecast.validation_mae)}
        </p>
      </div>
    ))}
  </div>
</section>
  
  <div className="section-header">
    <div>
      <h2>Customer Health Watchlist</h2>
      <p>Customers with the lowest health scores</p>
    </div>
  </div>

  <div className="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Customer ID</th>
          <th>Usage</th>
          <th>Support</th>
          <th>Billing</th>
          <th>Health Score</th>
          <th>Status</th>
        </tr>
      </thead>

      <tbody>
        {customerHealthList.map((customer) => (
          <tr key={customer.customer_id}>
            <td>{customer.customer_id}</td>
            <td>{customer.usage_score}</td>
            <td>{customer.support_score}</td>
            <td>{customer.billing_score}</td>
            <td>{customer.health_score}</td>
            <td>
              <span className="status-badge">
                {customer.health_status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>

{riskSummary && (
  <div className="section-card">
    <div className="section-header">
      <div>
        <h2>Risk Summary</h2>
        <p>Overall customer churn-risk distribution</p>
      </div>
    </div>

    <div className="kpi-grid">
      <div className="kpi-card">
        <span>Total Customers</span>
        <strong>{riskSummary.total_customers}</strong>
      </div>

      <div className="kpi-card">
        <span>High Risk</span>
        <strong>{riskSummary.high_risk_customers}</strong>
      </div>

      <div className="kpi-card">
        <span>Medium Risk</span>
        <strong>{riskSummary.medium_risk_customers}</strong>
      </div>

      <div className="kpi-card">
        <span>Low Risk</span>
        <strong>{riskSummary.low_risk_customers}</strong>
      </div>
    </div>
  </div>
)}


<div className="section-card">
  <div className="section-header">
    <div>
      <h2>Churn Risk</h2>
      <p>Customers with the highest predicted churn probability</p>
    </div>
  </div>

  <div className="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Customer ID</th>
          <th>Churn Probability</th>
          <th>Risk Level</th>
        </tr>
      </thead>

      <tbody>
        {churnRisk.map((customer) => (
          <tr key={customer.customer_id}>
            <td>{customer.customer_id}</td>
            <td>
              {(customer.churn_probability * 100).toFixed(1)}%
            </td>
            <td>
              <span className="status-badge">
                {customer.risk_level}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>

<section className="dashboard-section">
    <h2>Alert Center</h2>

    <p>
        Customer-success and billing alerts requiring attention
    </p>

    <div className="table-container">
        <table>
            <thead>
                <tr>
                    <th>Customer ID</th>
                    <th>Alert Type</th>
                    <th>Severity</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th>Reason</th>
                    <th>Action</th>
                </tr>
            </thead>

            <tbody>
                {alerts.map((alert) => (
                    <tr key={alert.alert_id}>
                        <td>{alert.customer_id}</td>
                        <td>{alert.alert_type}</td>
                        <td>{alert.severity}</td>
                        <td>{alert.owner}</td>
                        <td>{alert.status}</td>
                        <td>{alert.reason}</td>
                        <td>
    {alert.status === "Open" ? (
        <>
            <button
                onClick={async () => {
                    try {
                        const response = await fetch(
                            `${API_BASE_URL}/api/alerts/${alert.alert_id}/acknowledge`,
                            {
                                method: "POST",
                            }
                        );

                        if (!response.ok) {
                            throw new Error("Failed to acknowledge alert");
                        }

                        setAlerts((currentAlerts) =>
                            currentAlerts.map((item) =>
                                item.alert_id === alert.alert_id
                                    ? {
                                          ...item,
                                          status: "Acknowledged",
                                      }
                                    : item
                            )
                        );
                    } catch (error) {
                        console.error(error);
                    }
                }}
            >
                Acknowledge
            </button>

            <button
                onClick={async () => {
                    try {
                        let actionType = "Customer Success Outreach";

                        if (alert.alert_type === "Expansion Opportunity") {
                            actionType = "Expansion Outreach";
                        } else if (alert.alert_type === "Payment Failure") {
                            actionType = "Billing Follow-up";
                        }

                        const params = new URLSearchParams({
                            customer_id: String(alert.customer_id),
                            action_type: actionType,
                            owner: alert.owner || "CSM",
                            notes: alert.reason || "",
                        });

                        const response = await fetch(
                            `${API_BASE_URL}/api/customer-action?${params.toString()}`,
                            {
                                method: "POST",
                            }
                        );

                        if (!response.ok) {
                            throw new Error("Failed to create customer action");
                        }

                        const result = await response.json();

                        window.alert(
                            `Customer action created successfully.\nAction ID: ${result.action_id}`
                        );
                    } catch (error) {
                        console.error(error);
                        window.alert("Failed to create customer action.");
                    }
                }}
            >
                Create Action
            </button>
        </>
    ) : (
        "Done"
    )}
</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
</section>

<section className="section">
    <h2>Data Quality</h2>
    <p>Pipeline quality checks and data validation results</p>

    <div className="table-container">
        <table>
            <thead>
                <tr>
                    <th>CHECK</th>
                    <th>TABLE</th>
                    <th>TYPE</th>
                    <th>STATUS</th>
                    <th>ACTUAL</th>
                    <th>EXPECTED</th>
                    <th>MESSAGE</th>
                </tr>
            </thead>

            <tbody>
                {dataQuality.map((check) => (
                    <tr key={check.check_name}>
                        <td>{check.check_name}</td>
                        <td>{check.table_name}</td>
                        <td>{check.check_type}</td>
                        <td>{check.status}</td>
                        <td>{check.actual_value}</td>
                        <td>{check.expected_value}</td>
                        <td>{check.message}</td>
                    </tr>
                ))}
            </tbody>
        </table>
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