// frontend/src/pages/ResidentRegisterPage.js
import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext'; // Import useTheme
import '../App.css'; // Import the central CSS file


function ResidentRegisterPage() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password2: '', // Assuming password confirmation field is needed
    phone_number: ''
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const { theme } = useTheme(); // Use the theme context


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

    // Basic validation (can be enhanced with a validation library)
    if (formData.password !== formData.password2) {
      setError('Passwords do not match.');
      return;
    }

     console.log("Attempting Resident Registration:", formData); // Debug log

    try {
      // API endpoint for resident registration
      const backendIp = '127.0.0.1'; // <-- Update this for your testing/deployment environment
      const backendPort = '8000';
      const registerEndpoint = `http://${backendIp}:${backendPort}/api/resident-register/`;


      const response = await axios.post(registerEndpoint, {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          password2: formData.password2,
          profile: { // Include profile data in the request body
              phone_number: formData.phone_number
          }
      });
       console.log("Registration successful:", response.data); // Debug log

      setMessage('Registration successful! Please log in.');
      // Optionally redirect to login page after a short delay
      setTimeout(() => {
           navigate('/login?role=resident'); // Redirect to resident login
      }, 2000);


    } catch (err) {
      console.error("Registration error:", err.response ? err.response.data : err.message); // Debug log error details
      let errorMessage = 'An error occurred during registration.';
       if (err.response && err.response.data) {
           // Attempt to extract specific error messages from backend validation
           if (err.response.data.username) {
               errorMessage = `Username error: ${err.response.data.username.join(', ')}`;
           } else if (err.response.data.email) {
               errorMessage = `Email error: ${err.response.data.email.join(', ')}`;
           } else if (err.response.data.password) {
                errorMessage = `Password error: ${err.response.data.password.join(', ')}`;
           } else if (err.response.data.password2) {
                errorMessage = `Password confirmation error: ${err.response.data.password2.join(', ')}`;
           } else if (err.response.data.profile && err.response.data.profile.phone_number) {
                errorMessage = `Phone number error: ${err.response.data.profile.phone_number.join(', ')}`;
           }
            else if (err.response.data.detail) {
               errorMessage = `Error: ${err.response.data.detail}`;
           }
            else {
               errorMessage = `Error: ${JSON.stringify(err.response.data)}`;
           }
       }
      setError(errorMessage);
    }
  };

  return (
    <div className={`page-container page-resident-register ${theme === 'dark' ? 'dark' : 'light'}`}> {/* Use page-container, page-resident-register, and theme class */}
      <div className="card"> {/* Use card class */}
        <h2 className="heading-medium">Resident Registration</h2> {/* Use heading-medium class */}

        {message && <div className="message message-success">{message}</div>}
        {error && <div className="message message-error">{error}</div>}

        <form onSubmit={handleSubmit} className="form-container"> {/* Use form-container class */}
          <div className="form-group"> {/* Use form-group class */}
            <label htmlFor="username" className="label">Username:</label> {/* Use label class */}
            <input type="text" id="username" name="username" value={formData.username} onChange={handleInputChange} required className="input-field" /> {/* Use input-field class */}
          </div>
          <div className="form-group"> {/* Use form-group class */}
            <label htmlFor="email" className="label">Email:</label> {/* Use label class */}
            <input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange} required className="input-field" /> {/* Use input-field class */}
          </div>
          <div className="form-group"> {/* Use form-group class */}
            <label htmlFor="password" className="label">Password:</label> {/* Use label class */}
            <input type="password" id="password" name="password" value={formData.password} onChange={handleInputChange} required className="input-field" /> {/* Use input-field class */}
          </div>
           <div className="form-group"> {/* Use form-group class */}
            <label htmlFor="password2" className="label">Confirm Password:</label> {/* Use label class */}
            <input type="password" id="password2" name="password2" value={formData.password2} onChange={handleInputChange} required className="input-field" /> {/* Use input-field class */}
          </div>
           <div className="form-group"> {/* Use form-group class */}
            <label htmlFor="phone_number" className="label">Phone Number:</label> {/* Use label class */}
            <input type="text" id="phone_number" name="phone_number" value={formData.phone_number} onChange={handleInputChange} className="input-field" /> {/* Use input-field class */}
          </div>

          <button type="submit" className="btn btn-primary"> {/* Use btn and btn-primary classes */}
            <span>Register</span> {/* Wrap text in span */}
          </button>
        </form>

        <p style={{ marginTop: '1.5rem' }}> {/* Keep inline style for top margin */}
          Already have an account? <Link to="/login?role=resident" className="app-link">Login here</Link> {/* Use app-link class */}
        </p>
         <p><Link to="/" className="app-link">Back to Role Selection</Link></p> {/* Use app-link class */}
      </div>
    </div>
  );
}

export default ResidentRegisterPage;

