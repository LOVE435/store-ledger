import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import RecordsPage from './pages/RecordsPage';
import RecordFormPage from './pages/RecordFormPage';
import RankingsPage from './pages/RankingsPage';
import ClientsPage from './pages/ClientsPage';
import ClientFormPage from './pages/ClientFormPage';
import ClientDetailPage from './pages/ClientDetailPage';
import SettingsPage from './pages/SettingsPage';
import RecycleBinPage from './pages/RecycleBinPage';
import LoginPage from './pages/LoginPage';
import { useAuth } from './lib/auth';
import SyncGate from './components/SyncGate';

export default function App() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <SyncGate>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<RecordsPage />} />
          <Route path="/records/new" element={<RecordFormPage />} />
          <Route path="/records/:id" element={<RecordFormPage />} />
          <Route path="/rankings" element={<RankingsPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/new" element={<ClientFormPage />} />
          <Route path="/clients/:id" element={<ClientDetailPage />} />
          <Route path="/clients/:id/edit" element={<ClientFormPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/recycle-bin" element={<RecycleBinPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </SyncGate>
  );
}
