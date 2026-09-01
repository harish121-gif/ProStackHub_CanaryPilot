import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./App.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [backendStatus, setBackendStatus] = useState("Checking...");
  const [applications, setApplications] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [history, setHistory] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState({ type: "", text: "" });

  // Modal States
  const [showAppModal, setShowAppModal] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [newAppForm, setNewAppForm] = useState({
    name: "",
    description: "",
    repository: "",
    current_version: "v1.0.0",
    stable_version: "v1.0.0",
  });
  const [newDeployForm, setNewDeployForm] = useState({
    application_id: "",
    version: "",
    canary_percentage: 25,
  });

  const showToast = (text, type = "success") => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage({ type: "", text: "" }), 4000);
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError("");

      const [health, apps, deploymentData, incidentData, historyData] = await Promise.all([
        axios.get(`${API_BASE_URL}/health`).catch(() => ({ data: { status: "offline" } })),
        axios.get(`${API_BASE_URL}/applications`).catch(() => ({ data: { applications: [] } })),
        axios.get(`${API_BASE_URL}/deployments`).catch(() => ({ data: { deployments: [] } })),
        axios.get(`${API_BASE_URL}/incidents`).catch(() => ({ data: { incidents: [] } })),
        axios.get(`${API_BASE_URL}/rollback-history`).catch(() => ({ data: { history: [] } })),
      ]);

      setBackendStatus(health.data.status === "healthy" ? "Healthy" : "Offline");
      setApplications(apps.data.applications || []);
      setDeployments(deploymentData.data.deployments || []);
      setIncidents(incidentData.data.incidents || []);
      setHistory(historyData.data.history || []);
    } catch (err) {
      console.error("Dashboard error:", err);
      setBackendStatus("Offline");
      setError(err.response?.data?.message || "Unable to connect to CanaryPilot backend service.");
    } finally {
      setLoading(false);
    }
  };

  const refreshMetrics = async (appId) => {
    if (!appId) return;
    try {
      const response = await axios.get(`${API_BASE_URL}/applications/${appId}/metrics`);
      setMetrics(response.data.current || null);
    } catch (err) {
      console.error("Metrics fetch error:", err);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const currentDeployment = deployments[0] || null;
  const currentApplication = currentDeployment
    ? applications.find((app) => app.id === currentDeployment.application_id)
    : applications[0] || null;

  useEffect(() => {
    refreshMetrics(currentApplication?.id);
    const timer = setInterval(() => refreshMetrics(currentApplication?.id), 8000);
    return () => clearInterval(timer);
  }, [currentApplication?.id]);

  const activeDeployments = useMemo(
    () => deployments.filter((dep) => ["RUNNING", "PENDING"].includes(dep.status)),
    [deployments],
  );

  const activeIncidents = incidents.filter((inc) => inc.status === "OPEN").length;
  const canaryPercentage = Number(currentDeployment?.canary_percentage || 0);

  const refreshDeployments = async () => {
    const [depRes, historyRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/deployments`),
      axios.get(`${API_BASE_URL}/rollback-history`),
    ]);
    setDeployments(depRes.data.deployments || []);
    setHistory(historyRes.data.history || []);
  };

  const promoteCanary = async (deployId = currentDeployment?.id) => {
    if (!deployId) return;
    try {
      setActionLoading(true);
      const res = await axios.post(`${API_BASE_URL}/deployments/${deployId}/promote`);
      showToast(res.data.message || "Canary promoted successfully!");
      await refreshDeployments();
    } catch (err) {
      showToast(err.response?.data?.message || "Promotion failed.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const rollbackCanary = async (deployId = currentDeployment?.id) => {
    if (!deployId) return;
    try {
      setActionLoading(true);
      const res = await axios.post(`${API_BASE_URL}/deployments/${deployId}/rollback`);
      showToast(res.data.message || "Deployment rolled back successfully!", "error");
      await refreshDeployments();
    } catch (err) {
      showToast(err.response?.data?.message || "Rollback failed.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateApplication = async (e) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      await axios.post(`${API_BASE_URL}/applications`, newAppForm);
      showToast(`Application '${newAppForm.name}' created successfully!`);
      setShowAppModal(false);
      setNewAppForm({
        name: "",
        description: "",
        repository: "",
        current_version: "v1.0.0",
        stable_version: "v1.0.0",
      });
      await loadDashboardData();
    } catch (err) {
      showToast(err.response?.data?.message || "Application creation failed.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateDeployment = async (e) => {
    e.preventDefault();
    if (!newDeployForm.application_id || !newDeployForm.version) {
      showToast("Please select an application and enter a version tag.", "error");
      return;
    }
    try {
      setActionLoading(true);
      await axios.post(`${API_BASE_URL}/deployments`, newDeployForm);
      showToast(`New deployment for ${newDeployForm.version} initiated!`);
      setShowDeployModal(false);
      setNewDeployForm({ application_id: "", version: "", canary_percentage: 25 });
      await loadDashboardData();
    } catch (err) {
      showToast(err.response?.data?.message || "Deployment initiation failed.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const formatCount = (num) => String(num).padStart(2, "0");

  const navItems = [
    { id: "dashboard", icon: "⌂", label: "Dashboard", badge: null },
    { id: "applications", icon: "▣", label: "Applications", badge: applications.length },
    { id: "deployments", icon: "⇧", label: "Deployments", badge: activeDeployments.length },
    { id: "monitoring", icon: "◉", label: "Monitoring", badge: "Live" },
    { id: "incidents", icon: "⚠", label: "Incidents", badge: activeIncidents },
    { id: "history", icon: "◷", label: "Rollback History", badge: history.length },
  ];

  return (
    <div className="app-shell">
      {/* Toast Notification */}
      {toastMessage.text && (
        <div className={`toast-notification ${toastMessage.type}`}>
          <span>{toastMessage.type === "error" ? "✖" : "✔"}</span>
          <div>{toastMessage.text}</div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <span>⚡</span>
          </div>
          <div>
            <h1>CanaryPilot</h1>
            <p>DevOps Release Hub</p>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? "active" : ""}`}
              onClick={() => setActiveTab(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
              {item.badge !== null && item.badge !== 0 && (
                <span className={`nav-badge ${item.id === "incidents" && activeIncidents > 0 ? "warning" : ""}`}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="system-chip">
            <span className={`status-dot ${backendStatus !== "Healthy" ? "offline" : ""}`} />
            <div>
              <strong>{backendStatus === "Healthy" ? "System Online" : "System Offline"}</strong>
              <small>{backendStatus === "Healthy" ? "All services operational" : "Check backend service"}</small>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Top Header */}
        <header className="topbar">
          <div>
            <div className="eyebrow">CanaryPilot / {activeTab.toUpperCase()}</div>
            <h2>
              {activeTab === "dashboard" && "DevOps Command Center"}
              {activeTab === "applications" && "Registered Microservices"}
              {activeTab === "deployments" && "Canary Release Pipeline"}
              {activeTab === "monitoring" && "Application Infrastructure Observability"}
              {activeTab === "incidents" && "Incident Management & Alerts"}
              {activeTab === "history" && "Automated Rollback Ledger"}
            </h2>
            <p>
              {activeTab === "dashboard" && "Real-time visibility into canary rollouts, traffic allocation, and cluster health."}
              {activeTab === "applications" && "Manage registered application services, stable releases, and repositories."}
              {activeTab === "deployments" && "Track progressive delivery states, promote traffic, or trigger instant rollbacks."}
              {activeTab === "monitoring" && "Live CPU utilization, memory consumption, API response time, and error metrics."}
              {activeTab === "incidents" && "Monitor platform alerts, anomaly reports, and resolution timestamps."}
              {activeTab === "history" && "Audit log of all manual and automated deployment rollbacks."}
            </p>
          </div>

          <div className="account-area">
            <button className="secondary-button icon-btn" title="Refresh Dashboard" onClick={loadDashboardData}>
              ↻ Refresh
            </button>
            {activeTab === "applications" && (
              <button className="primary-button" onClick={() => setShowAppModal(true)}>
                + Register App
              </button>
            )}
            {activeTab === "deployments" && (
              <button className="primary-button" onClick={() => setShowDeployModal(true)}>
                + New Deployment
              </button>
            )}
            <div className="avatar">CP</div>
          </div>
        </header>

        {error && <div className="error-banner">⚠️ {error}</div>}

        {/* Tab 1: Dashboard View */}
        {activeTab === "dashboard" && (
          <>
            <section className="stats-grid">
              <StatCard title="Applications" value={loading ? "--" : formatCount(applications.length)} note="Registered services" icon="▣" />
              <StatCard title="Active Deployments" value={loading ? "--" : formatCount(activeDeployments.length)} note="Running rollouts" icon="⇧" highlight />
              <StatCard title="Health Status" value={backendStatus} note="Core REST API & DB" icon="⚡" statusDot={backendStatus === "Healthy"} />
              <StatCard title="Active Incidents" value={loading ? "--" : formatCount(activeIncidents)} note={activeIncidents ? "Action Required" : "No active issues"} icon="⚠" warning={activeIncidents > 0} />
            </section>

            <section className="two-column">
              {/* Deployments Log */}
              <section className="card">
                <div className="section-header">
                  <div>
                    <h3>Recent Canary Releases</h3>
                    <p>Live release activity across environments</p>
                  </div>
                  <button className="link-button" onClick={() => setActiveTab("deployments")}>View All →</button>
                </div>

                <div className="deployment-list">
                  {loading ? (
                    <div className="empty-state">Loading deployment streams...</div>
                  ) : deployments.length === 0 ? (
                    <div className="empty-state">No active deployments. Start one from Deployments tab.</div>
                  ) : deployments.slice(0, 5).map((dep) => {
                    const pct = Number(dep.canary_percentage || 0);
                    return (
                      <div className="deployment-row" key={dep.id}>
                        <div className="service-cell">
                          <div className="service-mark">{dep.application_name?.charAt(0).toUpperCase() || "A"}</div>
                          <div>
                            <strong>{dep.application_name}</strong>
                            <span>Tag: {dep.version}</span>
                          </div>
                        </div>

                        <div className="mini-progress-wrap">
                          <div className="progress-label">
                            <span>{pct === 100 ? "Fully Promoted" : pct === 0 ? "Rolled Back" : "Canary Active"}</span>
                            <b>{pct}%</b>
                          </div>
                          <div className="progress-track">
                            <div
                              style={{ width: `${pct}%` }}
                              className={pct === 100 ? "success" : pct === 0 ? "rolled" : "active"}
                            />
                          </div>
                        </div>

                        <span className={`status-badge ${dep.status.toLowerCase()}`}>{dep.status}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Active Canary Control Card */}
              <section className="card highlight-card">
                <div className="section-header">
                  <div>
                    <h3>Active Canary Shifting</h3>
                    <p>{currentDeployment ? currentDeployment.application_name : "No active release"}</p>
                  </div>
                  {currentDeployment && <span className="live-badge">● LIVE TRAFFIC</span>}
                </div>

                {currentDeployment ? (
                  <div className="card-body">
                    <div className="version-row">
                      <div className="v-box">
                        <span>STABLE VERSION</span>
                        <strong>{currentApplication?.stable_version || "v1.0.0"}</strong>
                      </div>
                      <div className="version-arrow">➔</div>
                      <div className="v-box highlight">
                        <span>CANARY VERSION</span>
                        <strong>{currentDeployment.version}</strong>
                      </div>
                    </div>

                    <div className="traffic-block">
                      <div className="traffic-label">
                        <span>Canary Traffic Distribution</span>
                        <strong>{canaryPercentage}%</strong>
                      </div>
                      <div className="large-track">
                        <div style={{ width: `${canaryPercentage}%` }} />
                      </div>
                      <div className="traffic-legend">
                        <span>Stable: {100 - canaryPercentage}%</span>
                        <span>Canary: {canaryPercentage}%</span>
                      </div>
                    </div>

                    <div className="health-card">
                      <span className="health-icon">✔</span>
                      <div>
                        <strong>Deployment ID #{currentDeployment.id} ({currentDeployment.status})</strong>
                        <small>Metrics healthy. Proceed with incremental promotion.</small>
                      </div>
                    </div>

                    <div className="button-row">
                      <button
                        className="primary-button"
                        disabled={actionLoading || canaryPercentage >= 100}
                        onClick={() => promoteCanary(currentDeployment.id)}
                      >
                        {actionLoading ? "Processing..." : canaryPercentage >= 100 ? "100% Promoted" : "Promote Canary (+25%)"}
                      </button>
                      <button
                        className="danger-button"
                        disabled={actionLoading}
                        onClick={() => rollbackCanary(currentDeployment.id)}
                      >
                        Rollback Release
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state padded">
                    <p>No active deployment selected.</p>
                    <button className="primary-button" onClick={() => setActiveTab("deployments")}>
                      Start New Deployment
                    </button>
                  </div>
                )}
              </section>
            </section>

            {/* Infrastructure Metrics Overview */}
            <section className="card">
              <div className="section-header">
                <div>
                  <h3>Application Infrastructure Signals</h3>
                  <p>Real-time metrics polled from Prometheus exporter</p>
                </div>
                <span className="metric-source">Target: {currentApplication?.name || "System"}</span>
              </div>

              <div className="metrics-grid">
                <MetricCard label="CPU Usage" value={`${metrics?.cpu_usage ?? "12.4"}%`} pct={Number(metrics?.cpu_usage || 12.4)} color="#6366f1" />
                <MetricCard label="Memory Usage" value={`${metrics?.memory_usage ?? "42.8"}%`} pct={Number(metrics?.memory_usage || 42.8)} color="#10b981" />
                <MetricCard label="Error Rate" value={`${metrics?.error_rate ?? "0.04"}%`} pct={Math.min(Number(metrics?.error_rate || 0.04) * 20, 100)} color="#f43f5e" />
                <MetricCard label="API Latency" value={`${metrics?.response_time ?? "45"} ms`} pct={Math.min((Number(metrics?.response_time || 45) / 300) * 100, 100)} color="#06b6d4" />
              </div>
            </section>
          </>
        )}

        {/* Tab 2: Applications View */}
        {activeTab === "applications" && (
          <section className="card">
            <div className="section-header">
              <div>
                <h3>Registered Microservices ({applications.length})</h3>
                <p>Configured application services monitored by CanaryPilot</p>
              </div>
              <button className="primary-button" onClick={() => setShowAppModal(true)}>
                + Register New Application
              </button>
            </div>

            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Application Name</th>
                    <th>Description</th>
                    <th>Repository</th>
                    <th>Current Version</th>
                    <th>Stable Version</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center">No applications registered yet.</td>
                    </tr>
                  ) : (
                    applications.map((app) => (
                      <tr key={app.id}>
                        <td>
                          <div className="app-cell">
                            <span className="app-avatar">{app.name.charAt(0).toUpperCase()}</span>
                            <strong>{app.name}</strong>
                          </div>
                        </td>
                        <td>{app.description}</td>
                        <td><code className="repo-code">{app.repository}</code></td>
                        <td><span className="version-tag canary">{app.current_version}</span></td>
                        <td><span className="version-tag stable">{app.stable_version}</span></td>
                        <td>
                          <button className="small-button" onClick={() => { setNewDeployForm(p => ({ ...p, application_id: app.id })); setShowDeployModal(true); }}>
                            Deploy Canary
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Tab 3: Deployments View */}
        {activeTab === "deployments" && (
          <section className="card">
            <div className="section-header">
              <div>
                <h3>All Deployments ({deployments.length})</h3>
                <p>Manage progressive releases, shift traffic percentage, or trigger instant rollbacks</p>
              </div>
              <button className="primary-button" onClick={() => setShowDeployModal(true)}>
                + New Canary Release
              </button>
            </div>

            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Application</th>
                    <th>Target Version</th>
                    <th>Stable Version</th>
                    <th>Traffic %</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deployments.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center">No deployment history found.</td>
                    </tr>
                  ) : (
                    deployments.map((dep) => {
                      const pct = Number(dep.canary_percentage || 0);
                      return (
                        <tr key={dep.id}>
                          <td>#{dep.id}</td>
                          <td><strong>{dep.application_name}</strong></td>
                          <td><span className="version-tag canary">{dep.version}</span></td>
                          <td><span className="version-tag stable">{dep.stable_version || "v1.0.0"}</span></td>
                          <td>
                            <div className="progress-flex">
                              <span><b>{pct}%</b></span>
                              <div className="progress-track mini">
                                <div style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </td>
                          <td><span className={`status-badge ${dep.status.toLowerCase()}`}>{dep.status}</span></td>
                          <td>
                            <div className="action-button-group">
                              <button
                                className="small-button promote"
                                disabled={actionLoading || pct >= 100 || dep.status === "ROLLED_BACK"}
                                onClick={() => promoteCanary(dep.id)}
                              >
                                Promote +25%
                              </button>
                              <button
                                className="small-button rollback"
                                disabled={actionLoading || dep.status === "ROLLED_BACK"}
                                onClick={() => rollbackCanary(dep.id)}
                              >
                                Rollback
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Tab 4: Monitoring View */}
        {activeTab === "monitoring" && (
          <div className="monitoring-container">
            <section className="card">
              <div className="section-header">
                <div>
                  <h3>Prometheus Live Metrics</h3>
                  <p>Real-time telemetry gathered from backend endpoints</p>
                </div>
                <span className="live-badge">● LIVE POLLING</span>
              </div>

              <div className="metrics-grid">
                <MetricCard label="CPU Usage" value={`${metrics?.cpu_usage ?? "14.2"}%`} pct={Number(metrics?.cpu_usage || 14.2)} color="#6366f1" />
                <MetricCard label="Memory Usage" value={`${metrics?.memory_usage ?? "48.1"}%`} pct={Number(metrics?.memory_usage || 48.1)} color="#10b981" />
                <MetricCard label="Error Rate" value={`${metrics?.error_rate ?? "0.02"}%`} pct={Math.min(Number(metrics?.error_rate || 0.02) * 20, 100)} color="#f43f5e" />
                <MetricCard label="API Response Time" value={`${metrics?.response_time ?? "42"} ms`} pct={Math.min((Number(metrics?.response_time || 42) / 300) * 100, 100)} color="#06b6d4" />
              </div>
            </section>

            <section className="card margin-top">
              <div className="section-header">
                <div>
                  <h3>Cluster Target Telemetry</h3>
                  <p>Prometheus scraper target health and node state</p>
                </div>
              </div>
              <div className="padded-box">
                <div className="info-grid">
                  <div className="info-card">
                    <span>Prometheus Scraper</span>
                    <strong>UP (100% Health)</strong>
                    <small>Endpoint: /metrics</small>
                  </div>
                  <div className="info-card">
                    <span>Grafana Exporter</span>
                    <strong>CONNECTED</strong>
                    <small>Port: 30030</small>
                  </div>
                  <div className="info-card">
                    <span>Kubernetes HPA</span>
                    <strong>ACTIVE (Autoscaling)</strong>
                    <small>Min: 1 / Max: 5 Replicas</small>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Tab 5: Incidents View */}
        {activeTab === "incidents" && (
          <section className="card">
            <div className="section-header">
              <div>
                <h3>System Incidents & Alerts ({incidents.length})</h3>
                <p>Automated telemetry anomaly detection and alert history</p>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Application</th>
                    <th>Title & Issue Description</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center">No active or past incidents recorded. System is healthy!</td>
                    </tr>
                  ) : (
                    incidents.map((inc) => (
                      <tr key={inc.id}>
                        <td>#{inc.id}</td>
                        <td><strong>{inc.application_name}</strong></td>
                        <td>
                          <div>
                            <strong>{inc.title}</strong>
                            <div className="sub-text">{inc.description}</div>
                          </div>
                        </td>
                        <td><span className={`severity-tag ${inc.severity.toLowerCase()}`}>{inc.severity}</span></td>
                        <td><span className={`status-badge ${inc.status.toLowerCase()}`}>{inc.status}</span></td>
                        <td><span className="timestamp">{inc.created_at || "Just now"}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Tab 6: History View */}
        {activeTab === "history" && (
          <section className="card">
            <div className="section-header">
              <div>
                <h3>Rollback Ledger & Audit Trail ({history.length})</h3>
                <p>Historical record of manual and automated deployment rollbacks</p>
              </div>
            </div>

            <div className="table-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Rollback ID</th>
                    <th>Deployment ID</th>
                    <th>Attempted Version</th>
                    <th>Restored Version</th>
                    <th>Rollback Reason</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center">No rollbacks have been triggered.</td>
                    </tr>
                  ) : (
                    history.map((item) => (
                      <tr key={item.id}>
                        <td>#{item.id}</td>
                        <td>#{item.deployment_id}</td>
                        <td><span className="version-tag canary">{item.deployment_version}</span></td>
                        <td><span className="version-tag stable">{item.previous_version || "v1.0.0"}</span></td>
                        <td><span className="reason-box">{item.reason}</span></td>
                        <td><span className="timestamp">{item.rolled_back_at || "Recently"}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Footer Bar */}
        <footer className="footer-status">
          <span className={`status-dot ${backendStatus !== "Healthy" ? "offline" : ""}`} />
          CanaryPilot Cluster API: <strong>{backendStatus}</strong> &bull; NodePort: <strong>8085</strong>
        </footer>
      </main>

      {/* Modal: Register Application */}
      {showAppModal && (
        <div className="modal-backdrop" onClick={() => setShowAppModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Register New Microservice</h3>
              <button className="close-btn" onClick={() => setShowAppModal(false)}>✖</button>
            </div>
            <form onSubmit={handleCreateApplication}>
              <div className="form-group">
                <label>Application Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. payment-service"
                  value={newAppForm.name}
                  onChange={(e) => setNewAppForm({ ...newAppForm, name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Handles customer checkout & payments"
                  value={newAppForm.description}
                  onChange={(e) => setNewAppForm({ ...newAppForm, description: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Git Repository</label>
                <input
                  type="text"
                  required
                  placeholder="github.com/org/payment-service"
                  value={newAppForm.repository}
                  onChange={(e) => setNewAppForm({ ...newAppForm, repository: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Current Version</label>
                  <input
                    type="text"
                    required
                    value={newAppForm.current_version}
                    onChange={(e) => setNewAppForm({ ...newAppForm, current_version: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Stable Version</label>
                  <input
                    type="text"
                    required
                    value={newAppForm.stable_version}
                    onChange={(e) => setNewAppForm({ ...newAppForm, stable_version: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowAppModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={actionLoading}>
                  {actionLoading ? "Registering..." : "Register Microservice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Deployment */}
      {showDeployModal && (
        <div className="modal-backdrop" onClick={() => setShowDeployModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Initiate Canary Deployment</h3>
              <button className="close-btn" onClick={() => setShowDeployModal(false)}>✖</button>
            </div>
            <form onSubmit={handleCreateDeployment}>
              <div className="form-group">
                <label>Target Application</label>
                <select
                  required
                  value={newDeployForm.application_id}
                  onChange={(e) => setNewDeployForm({ ...newDeployForm, application_id: e.target.value })}
                >
                  <option value="">-- Select Microservice --</option>
                  {applications.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name} (Current: {app.current_version})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>New Version Tag</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. v2.0.0"
                  value={newDeployForm.version}
                  onChange={(e) => setNewDeployForm({ ...newDeployForm, version: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Initial Canary Traffic (%)</label>
                <select
                  value={newDeployForm.canary_percentage}
                  onChange={(e) => setNewDeployForm({ ...newDeployForm, canary_percentage: Number(e.target.value) })}
                >
                  <option value={10}>10% Traffic</option>
                  <option value={25}>25% Traffic</option>
                  <option value={50}>50% Traffic</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={() => setShowDeployModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={actionLoading}>
                  {actionLoading ? "Initiating..." : "Start Canary Release"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, note, icon, warning = false, highlight = false, statusDot = false }) {
  return (
    <div className={`stat-card ${highlight ? "highlight" : ""}`}>
      <div className="stat-header">
        <span>{title}</span>
        <div className="stat-icon">{icon}</div>
      </div>
      <div className="stat-value-wrap">
        {statusDot && <span className="status-dot healthy" />}
        <strong className="stat-value">{value}</strong>
      </div>
      <span className={warning ? "stat-note warning" : "stat-note"}>{note}</span>
    </div>
  );
}

function MetricCard({ label, value, pct, color }) {
  return (
    <div className="metric-item">
      <div className="metric-title">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="metric-track">
        <div style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default App;
