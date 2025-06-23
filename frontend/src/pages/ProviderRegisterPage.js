// frontend/src/pages/ProviderRegisterPage.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import '../App.css';

function ProviderRegisterPage() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password2: '',
    name: '',
    contact_info: '',
    brief_note: '',
    service_ids: []
  });
  const [services, setServices] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { theme } = useTheme();

  // Fetch available services on component mount
  useEffect(() => {
    const fetchServices = async () => {
      try {
        const backendIp = '127.0.0.1';
        const backendPort = '8000';
        const response = await axios.get(`http://${backendIp}:${backendPort}/api/services/`);
        console.log("Services fetched:", response.data);
        setServices(response.data);
      } catch (err) {
        console.error("Error fetching services:", err);
        setError('Failed to load services. Please refresh the page.');
      }
    };

    fetchServices();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleServiceChange = (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map(option => parseInt(option.value));
    setFormData({
      ...formData,
      service_ids: selectedOptions,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    // Basic validation
    if (formData.password !== formData.password2) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (formData.service_ids.length === 0) {
      setError('Please select at least one service.');
      setLoading(false);
      return;
    }

    console.log("Attempting Provider Registration:", formData);

    try {
      const backendIp = '127.0.0.1';
      const backendPort = '8000';
      const registerEndpoint = `http://${backendIp}:${backendPort}/api/provider-register/`;

      const response = await axios.post(registerEndpoint, {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          name: formData.name,
          contact_info: formData.contact_info,
          brief_note: formData.brief_note,
          service_ids: formData.service_ids
      });
       console.log("Registration successful:", response.data);

      setMessage('Registration successful! Your account is pending approval.');
      setTimeout(() => {
           navigate('/login?role=provider');
      }, 2000);

    } catch (err) {
      console.error("Registration error:", err.response ? err.response.data : err.message);
       let errorMessage = 'An error occurred during registration.';
       if (err.response && err.response.data) {
           if (err.response.data.username) {
               errorMessage = `Username error: ${err.response.data.username.join(', ')}`;
           } else if (err.response.data.email) {
               errorMessage = `Email error: ${err.response.data.email.join(', ')}`;
           } else if (err.response.data.password) {
                errorMessage = `Password error: ${err.response.data.password.join(', ')}`;
           } else if (err.response.data.name) {
                errorMessage = `Provider Name error: ${err.response.data.name.join(', ')}`;
           } else if (err.response.data.service_ids) {
                errorMessage = `Service selection error: ${err.response.data.service_ids.join(', ')}`;
           } else if (err.response.data.detail) {
               errorMessage = `Error: ${err.response.data.detail}`;
           } else {
               errorMessage = `Error: ${JSON.stringify(err.response.data)}`;
           }
       }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`page-container page-provider-register ${theme === 'dark' ? 'dark' : 'light'}`}>
      <div className="card">
        <h2 className="heading-medium">Service Provider Registration</h2>

        {message && <div className="message message-success">{message}</div>}
        }
        {error && <div className="message message-error">{error}</div>}
        }

        <form onSubmit={handleSubmit} className="form-container">
          <div className="form-group">
            <label htmlFor="username" className="label">Username:</label>
            <input 
              type="text" 
              id="username" 
              name="username" 
              value={formData.username} 
              onChange={handleInputChange} 
              required 
              className="input-field"
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="email" className="label">Email:</label>
            <input 
              type="email" 
              id="email" 
              name="email" 
              value={formData.email} 
              onChange={handleInputChange} 
              required 
              className="input-field"
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password" className="label">Password:</label>
            <input 
              type="password" 
              id="password" 
              name="password" 
              value={formData.password} 
              onChange={handleInputChange} 
              required 
              className="input-field"
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password2" className="label">Confirm Password:</label>
            <input 
              type="password" 
              id="password2" 
              name="password2" 
              value={formData.password2} 
              onChange={handleInputChange} 
              required 
              className="input-field"
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="name" className="label">Service Provider Name:</label>
            <input 
              type="text" 
              id="name" 
              name="name" 
              value={formData.name} 
              onChange={handleInputChange} 
              required 
              className="input-field"
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="contact_info" className="label">Contact Info:</label>
            <input 
              type="text" 
              id="contact_info" 
              name="contact_info" 
              value={formData.contact_info} 
              onChange={handleInputChange} 
              className="input-field"
              disabled={loading}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="brief_note" className="label">Brief Note:</label>
            <textarea 
              id="brief_note" 
              name="brief_note" 
              value={formData.brief_note} 
              onChange={handleInputChange} 
              className="input-field"
              rows="3"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="services" className="label">Services Offered (select multiple):</label>
            <select
              id="services"
              name="services"
              multiple
              value={formData.service_ids}
              onChange={handleServiceChange}
              className="input-field"
              style={{ minHeight: '120px' }}
              required
              disabled={loading}
            >
              {services.map(service => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
            <small style={{ color: 'var(--secondary-text-color)', fontSize: '0.875rem' }}>
              Hold Ctrl (Cmd on Mac) to select multiple services
            </small>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            <span>{loading ? 'Registering...' : 'Register'}</span>
          </button>
        </form>

        <p style={{ marginTop: '1.5rem' }}>
          Already have an account? <Link to="/login?role=provider" className="app-link">Login here</Link>
        </p>
        <p><Link to="/" className="app-link">Back to Role Selection</Link></p>
      </div>
    </div>
  );
}

export default ProviderRegisterPage;