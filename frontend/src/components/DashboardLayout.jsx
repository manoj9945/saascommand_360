import Sidebar from "./Sidebar";
import Header from "./Header";

function DashboardLayout({
  activePage,
  setActivePage,
  onRefresh,
  children,
}) {
  return (
    <div className="dashboard-layout">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
      />

      <div className="dashboard-main">
        <Header
          activePage={activePage}
          onRefresh={onRefresh}
        />

        <main className="dashboard-content">
          {children}
        </main>
      </div>
    </div>
  );
}

export default DashboardLayout;