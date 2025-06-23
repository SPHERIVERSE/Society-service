// frontend/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import RoleSelectionPage from './pages/RoleSelectionPage';
import LoginPage from './pages/LoginPage';
import ResidentRegisterPage from './pages/ResidentRegisterPage';
import ProviderRegisterPage from './pages/ProviderRegisterPage';
import DashboardPage from './pages/DashboardPage';
import SocietyDetailPage from './pages/SocietyDetailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
// import ResetPasswordConfirmPage from './pages/ResetPasswordConfirmPage'; // Commented out: This page does not exist yet
import ProviderDashboardPage from './pages/ProviderDashboardPage'; // Assuming you have this page
import { useTheme } from './contexts/ThemeContext'; // Import useTheme (ThemeProvider is used in index.js)
import './App.css'; // Import the central CSS file

// Component for the theme toggle button
const ThemeToggleButton = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <button className="theme-toggle" onClick={toggleTheme}>
      Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
    </button>
  );
};


function App() {
  // The theme class is applied to the body via the ThemeProvider effect in index.js
  // We don't need to apply it to a container here anymore as the body handles the background.
  return (
    <Router>
      {/* The page-container class is now applied within individual page components */}
        <Routes>
          <Route path="/" element={<RoleSelectionPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/resident-register" element={<ResidentRegisterPage />} />
          <Route path="/provider-register" element={<ProviderRegisterPage />} />
          <Route path="/dashboard" element={<DashboardPage />} /> {/* Resident Dashboard */}
          <Route path="/society/:societyId" element={<SocietyDetailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          {/* <Route path="/reset-password-confirm/:uidb64/:token" element={<ResetPasswordConfirmPage />} /> */} {/* Commented out: Route for non-existent page */}
           <Route path="/provider-dashboard" element={<ProviderDashboardPage />} /> {/* Service Provider Dashboard */}

          {/* Add other routes here */}
        </Routes>
         <ThemeToggleButton /> {/* Add the theme toggle button */}
    </Router>
  );
}

export default App;

