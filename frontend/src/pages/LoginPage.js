// frontend/src/pages/LoginPage.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import '../App.css';


function LoginPage() {
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role');
   const { theme } = useTheme();


  // Determine the API endpoint based on the role
  // *** ENSURE THIS IP ADDRESS MATCHES WHERE YOUR DJANGO SERVER IS RUNNING ***
  // For local testing, you might use '127.0.0.1' or your local network IP (e.g., '192.168.1.16')
  // For production, this should be your deployed backend URL
  const backendIp = '127.0.0.1'; // <-- Update this for your testing/deployment environment
  const backendPort = '8000';
  const loginEndpoint = role === 'provider' ? `http://${backendIp}:${backendPort}/api/provider-login/` : `http://${backendIp}:${backendPort}/api/resident-login/`;

  // Determine the registration link based on the role
  const registrationLink = role === 'provider' ? '/provider-register' : '/resident-register';
  const forgotPasswordLink = '/forgot-password';

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
      if (!role) {
          setMessage("Please select a role from the home page.");
          // Optional: navigate('/'); // Uncomment to force role selection if role is missing
      } else {
          setMessage(`Logging in as ${role.charAt(0).toUpperCase() + role.slice(1)}`);
      }
  }, [role]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // Clear previous errors
    setMessage(''); // Clear previous messages

    console.log(`Attempting to login as ${role} to: ${loginEndpoint}`); // Debug log

    try {
      const response = await axios.post(loginEndpoint, formData);
      console.log("Login successful:", response.data); // Debug log

      // Assuming your backend returns a token and user info on successful login
      const { token, user_id, username, user_role } = response.data;

      // Store authentication token and user info in local storage
      localStorage.setItem('authToken', token);
      localStorage.setItem('userId', user_id);
      localStorage.setItem('username', username);
      localStorage.setItem('userRole', user_role);

      // Redirect based on role
      if (user_role === 'resident') {
          navigate('/dashboard'); // Redirect resident to resident dashboard
      } else if (user_role === 'provider') {
          navigate('/provider-dashboard'); // Redirect provider to provider dashboard
      } else {
          // Handle unexpected role
          setError('Login successful, but user role is not recognized.');
          // Optionally clear token if role is invalid
          localStorage.removeItem('authToken');
          localStorage.removeItem('userId');
          localStorage.removeItem('username');
          localStorage.removeItem('userRole');
      }


    } catch (err) {
      console.error("Login error:", err.response ? err.response.data : err.message); // Debug log error details
      if (err.response && err.response.data && err.response.data.detail) {
        // Display specific error message from backend
        setError(`Login failed: ${err.response.data.detail}`);
      } else if (err.response && err.response.data) {
           // Display other error details from backend if available
           setError(`Login failed: ${JSON.stringify(err.response.data)}`);
      }
      else {
        setError('An error occurred during login.');
      }
    }
  };


  return (
    <div className={`page-container ${theme === 'dark' ? 'dark' : 'light'}`}> {/* Use page-container and theme class */}
      <div className="card"> {/* Use card class */}
        <h2 className="heading-medium">{role === 'provider' ? 'Service Provider Login' : 'Resident Login'}</h2> {/* Use heading-medium class */}
        {message && <div className={`message ${message.includes('successful') ? 'message-success' : (message.includes('Please select') ? 'message-warning' : 'message-error')}`}>{message}</div>}
        {error && <div className="message message-error">{error}</div>}

        <form onSubmit={handleSubmit} className="form-container"> {/* Use form-container class */}
          <div className="form-group"> {/* Use form-group class */}
            <label htmlFor="username" className="label">Username or Email:</label> {/* Use label class */}
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleInputChange}
              required
              className="input-field" // Use input-field class
            />
          </div>
          <div className="form-group"> {/* Use form-group class */}
            <label htmlFor="password" className="label">Password:</label> {/* Use label class */}
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              className="input-field" // Use input-field class
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary" // Use btn and btn-primary classes
          >
            <span>Login</span> {/* Wrap text in span for pseudo-element stacking */}
          </button>
        </form>

         <p style={{ marginTop: '1.5rem' }}> {/* Keep inline style for top margin for now */}
                Don't have an account? <Link to={registrationLink} className="app-link">Register here</Link> {/* Use app-link class */}
           </p>
           <p><Link to={forgotPasswordLink} className="app-link">Forgot Password?</Link></p> {/* Use app-link class */}
           <p><Link to="/" className="app-link">Back to Role Selection</Link></p> {/* Use app-link class */}
      </div>
    </div>
  );
}

export default LoginPage;

