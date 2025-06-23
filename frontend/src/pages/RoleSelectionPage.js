// frontend/src/pages/RoleSelectionPage.js
import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import '../App.css';

function RoleSelectionPage() {
  const { theme } = useTheme();

  return (
    <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}> {/* Use page-container and theme class */}
      <div className="card">
        <h2 className="heading-large">Welcome to Society Circle</h2>
        <h2 className="heading-medium">Select Your Role</h2>

        <div className="button-container">
          <Link
            to="/login?role=resident"
            className="btn btn-primary"
          >
            <span>Resident</span> {/* Wrap text in span for pseudo-element stacking */}
          </Link>

          <Link
            to="/login?role=provider"
            className="btn btn-secondary"
          >
             <span>Service Provider</span> {/* Wrap text in span for pseudo-element stacking */}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default RoleSelectionPage;

