// frontend/src/pages/ForgotPasswordPage.js
import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext'; // Import useTheme
import '../App.css'; // Import the central CSS file


function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
   const { theme } = useTheme(); // Use the theme context


  const handleInputChange = (e) => {
    setEmail(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    console.log("Attempting to request password reset for email:", email); // Debug log

    try {
      // API endpoint for requesting password reset
       const backendIp = '127.0.0.1'; // <-- Update this for your testing/deployment environment
       const backendPort = '8000';
      const requestResetEndpoint = `http://${backendIp}:${backendPort}/api/request-password-reset/`;


      const response = await axios.post(requestResetEndpoint, { email });
       console.log("Password reset request successful:", response.data); // Debug log

      setMessage('If your email is registered, you will receive a password reset OTP.');
      // Note: In a real application, you wouldn't confirm if the email exists for security reasons.
      // The message would be more generic like "If an account with that email exists, we've sent a reset link/code."

    } catch (err) {
      console.error("Password reset request error:", err.response ? err.response.data : err.message); // Debug log error details
       let errorMessage = 'An error occurred while requesting password reset.';
       if (err.response && err.response.data && err.response.data.detail) {
           errorMessage = `Error: ${err.response.data.detail}`;
       } else if (err.response && err.response.data) {
            errorMessage = `Error: ${JSON.stringify(err.response.data)}`;
       }
      setError(errorMessage);
    }
  };

  return (
    <div className={`page-container page-forgot-password ${theme === 'dark' ? 'dark' : 'light'}`}> {/* Use page-container, page-forgot-password, and theme class */}
      <div className="card"> {/* Use card class */}
        <h2 className="heading-medium">Forgot Password</h2> {/* Use heading-medium class */}

        {message && <div className="message message-success">{message}</div>}
        {error && <div className="message message-error">{error}</div>}

        <form onSubmit={handleSubmit} className="form-container"> {/* Use form-container class */}
          <div className="form-group"> {/* Use form-group class */}
            <label htmlFor="email" className="label">Enter your email address:</label> {/* Use label class */}
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={handleInputChange}
              required
              className="input-field" // Use input-field class
            />
          </div>

          <button type="submit" className="btn btn-primary"> {/* Use btn and btn-primary classes */}
            <span>Request Reset</span> {/* Wrap text in span */}
          </button>
        </form>

        <p style={{ marginTop: '1.5rem' }}> {/* Keep inline style for top margin */}
          Remember your password? <Link to="/login" className="app-link">Login</Link> {/* Use app-link class */}
        </p>
         <p><Link to="/" className="app-link">Back to Role Selection</Link></p> {/* Use app-link class */}
      </div>
    </div>
  );
}

export default ForgotPasswordPage;

