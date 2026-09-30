import { useEffect, useState } from "react";
import "./App.css";
import DashboardLayout from "./components/DashboardLayout";

const API_BASE_URL = "http://127.0.0.1:8000";

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

  const [authToken, setAuthToken] = useState(
    () => sessionStorage.getItem("saas_access_token") || ""
  );
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = sessionStorage.getItem("saas_user");
    return savedUser ? JSON.parse(savedUser) : null;
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

    const response = await fetch(url, {
      ...options,
      headers,
    });

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Login failed.");
      }

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
        forecastsResponse,
      ] = await Promise.all([
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
      const customerHealthListData =
        await customerHealthListResponse.json();
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
    if (!authToken) {
      setLoading(false);
      return undefined;
    }

    fetchDashboardData();

    const interval = setInterval(() => {
      authFetch(`${API_BASE_URL}/api/events/live?limit=8`)
        .then((response) => response.json())
        .then((data) => setLiveEvents(data))
        .catch((err) => console.error(err));
    }, 5000);

    return () => clearInterval(interval);
  }, [authToken]);

  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);

  const getStatusClass = (status) => {
    if (!status) return "";

    return status
      .toLowerCase()
      .replace(/\s+/g, "-");
  };

  /*
   * ============================
   * OVERVIEW
   * ============================
   */

  const renderOverview = () => (
    <>
      <div className="page-intro">
        <div>
          <h2>Business Overview</h2>
          <p>
            A consolidated view of revenue, customers, risk and live activity.
          </p>
        </div>
      </div>

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
          <strong>
            {dashboard.active_customers.toLocaleString()}
          </strong>
          <small>Customers with active subscriptions</small>
        </div>

        <div className="kpi-card">
          <span>Active Subscriptions</span>
          <strong>
            {dashboard.active_subscriptions.toLocaleString()}
          </strong>
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

        <div className="panel">
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
                className={`health-status ${getStatusClass(
                  customerHealth.health_status
                )}`}
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

      {riskSummary && (
        <section className="section-card">
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
        </section>
      )}

      <section className="content-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Product Activity</h2>
              <p>Recent product usage</p>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Events</th>
                  <th>Daily Users</th>
                  <th>Monthly Users</th>
                </tr>
              </thead>

              <tbody>
                {usage.slice(0, 5).map((item, index) => (
                  <tr
                    key={`${item.usage_date}-${item.feature}-${index}`}
                  >
                    <td>
                      <strong>{item.feature}</strong>
                    </td>
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
              <h2>Live Activity</h2>
              <p>Kafka → PostgreSQL → FastAPI</p>
            </div>

            <span className="live-indicator">
              <span></span>
              LIVE
            </span>
          </div>

          <div className="event-list">
            {liveEvents.slice(0, 5).map((event) => (
              <div className="event-item" key={event.event_id}>
                <div>
                  <strong>
                    {event.feature || event.event_type}
                  </strong>

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
  );

  /*
   * ============================
   * CUSTOMERS
   * ============================
   */

  const renderCustomers = () => (
    <>
      <div className="page-intro">
        <div>
          <h2>Customer Intelligence</h2>
          <p>
            Monitor customer health and identify customers requiring
            attention.
          </p>
        </div>
      </div>

      <section className="section-card">
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
                  <td>
                    <strong>{customer.customer_id}</strong>
                  </td>
                  <td>{customer.usage_score}</td>
                  <td>{customer.support_score}</td>
                  <td>{customer.billing_score}</td>
                  <td>{customer.health_score}</td>
                  <td>
                    <span
                      className={`health-status ${getStatusClass(
                        customer.health_status
                      )}`}
                    >
                      {customer.health_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-card">
        <div className="section-header">
          <div>
            <h2>Churn Risk</h2>
            <p>
              Customers with the highest predicted churn probability
            </p>
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
                  <td>
                    <strong>{customer.customer_id}</strong>
                  </td>

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
      </section>
    </>
  );

  /*
   * ============================
   * PRODUCT
   * ============================
   */

  const renderProduct = () => (
    <>
      <div className="page-intro">
        <div>
          <h2>Product Analytics</h2>
          <p>
            Understand feature adoption and observe live product activity.
          </p>
        </div>
      </div>

      <section className="section-card">
        <div className="section-header">
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
                <tr
                  key={`${item.usage_date}-${item.feature}-${index}`}
                >
                  <td>{item.usage_date}</td>
                  <td>
                    <strong>{item.feature}</strong>
                  </td>
                  <td>{item.total_events}</td>
                  <td>{item.daily_active_users}</td>
                  <td>{item.monthly_active_users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-card">
        <div className="section-header">
          <div>
            <h2>Live Product Events</h2>
            <p>Real-time Kafka event activity</p>
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
                <strong>
                  {event.feature || event.event_type}
                </strong>

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
      </section>
    </>
  );

  /*
   * ============================
   * REVENUE
   * ============================
   */

  const renderRevenue = () => (
    <>
      <div className="page-intro">
        <div>
          <h2>Revenue Intelligence</h2>
          <p>
            Monitor recurring revenue and forward-looking revenue forecasts.
          </p>
        </div>
      </div>

      <section className="kpi-grid">
        <div className="kpi-card">
          <span>Active MRR</span>
          <strong>{formatCurrency(dashboard.active_mrr)}</strong>
          <small>Current monthly recurring revenue</small>
        </div>

        <div className="kpi-card">
          <span>Active ARR</span>
          <strong>{formatCurrency(dashboard.active_arr)}</strong>
          <small>Current annual recurring revenue</small>
        </div>
      </section>

      <section className="section-card">
        <div className="section-header">
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
      </section>

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

              <p>Model: {forecast.model_name}</p>

              <p>
                Validation MAE:{" "}
                {formatCurrency(forecast.validation_mae)}
              </p>
            </div>
          ))}
        </div>
      </section>
    </>
  );

  /*
   * ============================
   * RISK & ML
   * ============================
   */

  const renderRisk = () => (
    <>
      <div className="page-intro">
        <div>
          <h2>Risk & Machine Learning</h2>
          <p>
            Predictive customer churn intelligence and risk distribution.
          </p>
        </div>
      </div>

      {riskSummary && (
        <section className="section-card">
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
        </section>
      )}

      <section className="section-card">
        <div className="section-header">
          <div>
            <h2>Churn Risk</h2>
            <p>
              Customers with the highest predicted churn probability
            </p>
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
                  <td>
                    <strong>{customer.customer_id}</strong>
                  </td>

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
      </section>
    </>
  );

  /*
   * ============================
   * ALERTS
   * ============================
   */

  const renderAlerts = () => (
    <>
      <div className="page-intro">
        <div>
          <h2>Alert Center</h2>
          <p>
            Customer-success and billing alerts requiring attention.
          </p>
        </div>
      </div>

      <section className="dashboard-section">
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
                              const response = await authFetch(
                                `${API_BASE_URL}/api/alerts/${alert.alert_id}/acknowledge`,
                                {
                                  method: "POST",
                                }
                              );

                              if (!response.ok) {
                                throw new Error(
                                  "Failed to acknowledge alert"
                                );
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
                              let actionType =
                                "Customer Success Outreach";

                              if (
                                alert.alert_type ===
                                "Expansion Opportunity"
                              ) {
                                actionType = "Expansion Outreach";
                              } else if (
                                alert.alert_type ===
                                "Payment Failure"
                              ) {
                                actionType = "Billing Follow-up";
                              }

                              const params = new URLSearchParams({
                                customer_id: String(alert.customer_id),
                                action_type: actionType,
                                owner: alert.owner || "CSM",
                                notes: alert.reason || "",
                              });

                              const response = await authFetch(
                                `${API_BASE_URL}/api/customer-action?${params.toString()}`,
                                {
                                  method: "POST",
                                }
                              );

                              if (!response.ok) {
                                throw new Error(
                                  "Failed to create customer action"
                                );
                              }

                              const result = await response.json();

                              window.alert(
                                `Customer action created successfully.\nAction ID: ${result.action_id}`
                              );
                            } catch (error) {
                              console.error(error);
                              window.alert(
                                "Failed to create customer action."
                              );
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
    </>
  );

  /*
   * ============================
   * DATA QUALITY
   * ============================
   */

  const renderDataQuality = () => (
    <>
      <div className="page-intro">
        <div>
          <h2>Data Quality</h2>
          <p>
            Pipeline quality checks and data validation results.
          </p>
        </div>
      </div>

      <section className="section-card">
        <div className="section-header">
          <div>
            <h2>Quality Checks</h2>
            <p>Latest automated data-quality results</p>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Check</th>
                <th>Table</th>
                <th>Type</th>
                <th>Status</th>
                <th>Actual</th>
                <th>Expected</th>
                <th>Message</th>
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
    </>
  );

  /*
   * ============================
   * CURRENT PAGE
   * ============================
   */

  const renderPage = () => {
    switch (activePage) {
      case "customers":
        return renderCustomers();

      case "product":
        return renderProduct();

      case "revenue":
        return renderRevenue();

      case "risk":
        return renderRisk();

      case "alerts":
        return renderAlerts();

      case "quality":
        return renderDataQuality();

      case "overview":
      default:
        return renderOverview();
    }
  };

  if (!authToken || !currentUser) {
    return (
      <div className="login-page">
        <div className="login-background-grid" />

        <div className="login-orbit orbit-one" />
        <div className="login-orbit orbit-two" />

        <div className="login-card">
          <div className="login-brand">
            <div className="login-brand-mark">S</div>
            <div>
              <strong>SaaSCommand</strong>
              <span>360 Analytics Command Center</span>
            </div>
          </div>

          <div className="login-heading">
            <p className="login-eyebrow">SECURE ACCESS</p>
            <h1>Welcome back</h1>
            <p>Sign in to access your customer, revenue and risk intelligence.</p>
          </div>

          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Email address
              <input
                type="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                placeholder="you@company.com"
                autoComplete="username"
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
            </label>

            {loginError && (
              <div className="login-error">{loginError}</div>
            )}

            <button
              className="login-button"
              type="submit"
              disabled={loginLoading}
            >
              {loginLoading ? "Signing in..." : "Sign in to Command Center"}
            </button>
          </form>

          <div className="login-security">
            <span>●</span> Protected with JWT authentication
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout
      activePage={activePage}
      setActivePage={setActivePage}
      onRefresh={fetchDashboardData}
    >
      <div className="session-bar">
        <div>
          <strong>{currentUser.full_name}</strong>
          <span>{currentUser.role}</span>
        </div>
        <button type="button" onClick={logout}>
          Sign out
        </button>
      </div>

      {loading && (
        <div className="status">
          Loading dashboard...
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {!loading && !error && dashboard && renderPage()}

      {!loading && !error && !dashboard && (
        <div className="status">Preparing dashboard...</div>
      )}
    </DashboardLayout>
  );
}

export default App;