import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TenantProvider, useTenant } from './utils/TenantContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import VendorMenu from './pages/VendorMenu';
import SalesMenu from './pages/SalesMenu';
import SalesmanMenu from './pages/SalesmanMenu';
import SalesEntry from './pages/SalesEntry';
import Buyer from './pages/Buyer';
import OutsideShop from './pages/OutsideShop';
import Flowers from './pages/Flowers';
import DailyReport from './pages/DailyReport';
import SalesmanLedger from './pages/SalesmanLedger';
import SalesmanMaster from './pages/SalesmanMaster';
import Reports from './pages/Reports';
import DashboardSettings from './pages/DashboardSettings';
import BusinessSettings from './pages/BusinessSettings';
import DailyStatement from './pages/DailyStatement';
import FlowerWiseReport from './pages/FlowerWiseReport';
import SalesmanCreditExpenses from './pages/SalesmanCreditExpenses';
import InvoiceView from './pages/InvoiceView';
import Payments from './pages/Payments';
import DailyFlowerPrices from './pages/DailyFlowerPrices';
import SalesmanReports from './pages/SalesmanReports';
import QuickEntry from './pages/QuickEntry';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useTenant();
  
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
  return user ? children : <Navigate to="/" replace />;
};

function App() {
  return (
    <TenantProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </TenantProvider>
  );
}

const AppRoutes = () => {
  const { user } = useTenant();
  
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/app" replace /> : <Login />} />
      <Route path="/invoice/:tenantId/:buyerId" element={<InvoiceView />} />
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="vendor-menu" element={<VendorMenu />} />
          <Route path="sales-menu" element={<SalesMenu />} />
          <Route path="salesman-menu" element={<SalesmanMenu />} />
          <Route path="sales-entry" element={<SalesEntry />} />
          <Route path="buyer" element={<Buyer />} />
          <Route path="outside-shop" element={<OutsideShop />} />
          <Route path="flowers" element={<Flowers />} />
          <Route path="daily-report" element={<DailyReport />} />
          <Route path="daily-statement" element={<DailyStatement />} />
          <Route path="salesman-ledger" element={<SalesmanLedger />} />
          <Route path="salesman-master" element={<SalesmanMaster />} />
          <Route path="salesman-credit-expenses" element={<SalesmanCreditExpenses />} />
          <Route path="salesman-reports" element={<SalesmanReports />} />
          <Route path="payments" element={<Payments />} />
          <Route path="daily-flower-prices" element={<DailyFlowerPrices />} />
          <Route path="reports" element={<Reports />} />
          <Route path="flower-wise-report" element={<FlowerWiseReport />} />
          <Route path="quick-entry" element={<QuickEntry />} />
          <Route path="settings" element={<DashboardSettings />} />
          <Route path="business-info" element={<BusinessSettings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
