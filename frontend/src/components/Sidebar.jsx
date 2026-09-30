function Sidebar({ activePage, setActivePage }) {
  const menuItems = [
    { id: "overview", label: "Overview", icon: "⌂" },
    { id: "customers", label: "Customers", icon: "◉" },
    { id: "product", label: "Product", icon: "◆" },
    { id: "revenue", label: "Revenue", icon: "▣" },
    { id: "risk", label: "Risk & ML", icon: "△" },
    { id: "alerts", label: "Alerts", icon: "!" },
    { id: "quality", label: "Data Quality", icon: "✓" },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">S</div>

        <div>
          <strong>SaaSCommand</strong>
          <span>360 Analytics</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <p className="nav-label">MAIN MENU</p>

        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${
              activePage === item.id ? "active" : ""
            }`}
            onClick={() => setActivePage(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="system-status">
          <span className="status-dot"></span>

          <div>
            <strong>System Healthy</strong>
            <small>All services operational</small>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;