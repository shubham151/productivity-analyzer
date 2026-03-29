import { useConfig } from './hooks/useConfig';
import Dashboard from './components/Dashboard';
import './index.css';

export default function App() {
  const { config, loading, error, updateConfig } = useConfig();

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-text">Connecting to backend…</div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="app-error">
        <div className="app-error-title">Backend unavailable</div>
        <p className="app-error-msg">
          Could not connect to the API server. Make sure the FastAPI backend is running.
        </p>
        <code className="app-error-code">
          cd backend &amp;&amp; uvicorn main:app --reload
        </code>
        {error && <p className="app-error-detail">{error}</p>}
      </div>
    );
  }

  return <Dashboard config={config} onConfigUpdate={updateConfig} />;
}
