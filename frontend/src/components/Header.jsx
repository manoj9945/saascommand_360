function Header({ activePage, onRefresh }) {
  const pageTitles = {
    overview: {
      title: "Executive Overview",
      description: "Business performance and customer intelligence",
    },
    customers: {
      title: "Customer Intelligence",
      description: "Customer health, engagement and churn risk",
    },
    product: {
      title: "Product Analytics",
      description: "Feature usage and live product activity",
    },
    revenue: {
      title: "Revenue Intelligence",
      description: "Revenue performance and forecasting",
    },
    risk: {
      title: "Risk & ML",
      description: "Churn risk and predictive customer insights",
    },
    alerts: {
      title: "Alert Center",
      description: "Customer-success and billing actions",
    },
    quality: {
      title: "Data Quality",
      description: "Pipeline quality and validation monitoring",
    },
  };

  const page = pageTitles[activePage] || pageTitles.overview;

  return (
    <header className="dashboard-header">
      <div>
        <div className="breadcrumb">SaaSCommand 360 / {page.title}</div>

        <h1>{page.title}</h1>

        <p>{page.description}</p>
      </div>

      <div className="header-actions">
        <div className="header-live">
          <span></span>
          System Healthy
        </div>

        <button className="header-refresh" onClick={onRefresh}>
          ↻ Refresh
        </button>
      </div>
    </header>
  );
}

export default Header;