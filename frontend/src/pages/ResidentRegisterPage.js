// frontend/src/pages/ResidentRegisterPage.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import LocationSelector from '../components/LocationSelector';
import '../App.css';

function ResidentRegisterPage() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password2: '',
    phone_number: '',
    country_id: '',
    state_id: '',
    district_id: '',
    circle_id: '',
    society_ids: []
  });
  const [availableSocieties, setAvailableSocieties] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { theme } = useTheme();

  const backendIp = '127.0.0.1';
  const backendPort = '8000';

  // Fetch societies when location is complete
  useEffect(() => {
    if (formData.country_id && formData.state_id && formData.district_id && formData.circle_id) {
      fetchAvailableSocieties();
    } else {
      setAvailableSocieties([]);
    }
  }, [formData.country_id, formData.state_id, formData.district_id, formData.circle_id]);

  const fetchAvailableSocieties = async () => {
    try {
      const response = await axios.get(
        `http://${backendIp}:${backendPort}/api/societies/?country_id=${formData.country_id}&state_id=${formData.state_id}&district_id=${formData.district_id}&circle_id=${formData.circle_id}`
      );
      setAvailableSocieties(response.data);
    } catch (error) {
      console.error('Error fetching societies:', error);
      setAvailableSocieties([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleLocationChange = (location) => {
    setFormData({
      ...formData,
      country_id: location.country,
      state_id: location.state,
      district_id: location.district,
      circle_id: location.circle,
      society_ids: [] // Reset society selection when location changes
    });
  };

  const handleSocietyChange = (e) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map(option => parseInt(option.value));
    setFormData({
      ...formData,
      society_ids: selectedOptions,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    if (formData.password !== formData.password2) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (!formData.country_id || !formData.state_id || !formData.district_id || !formData.circle_id) {
      setError('Please select your complete location (Country, State, District, Circle).');
      setLoading(false);
      return;
    }

    console.log("Attempting Resident Registration:", formData);

    try {
      const registerEndpoint = `http://${backendIp}:${backendPort}/api/resident-register/`;

      const response = await axios.post(registerEndpoint, {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        phone_number: formData.phone_number,
        country_id: parseInt(formData.country_id),
        state_id: parseInt(formData.state_id),
        district_id: parseInt(formData.district_id),
        circle_id: parseInt(formData.circle_id),
        society_ids: formData.society_ids
      });
      
      console.log("Registration successful:", response.data);

      setMessage('Registration successful! Please log in.');
      setTimeout(() => {
        navigate('/login?role=resident');
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
    <div className={`page-container page-resident-register ${theme === 'dark' ? 'dark' : 'light'}`}>
      <div className="card">
        <h2 className="heading-medium">Resident Registration</h2>

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
            <label htmlFor="phone_number" className="label">Phone Number:</label>
            <input 
              type="text" 
              id="phone_number" 
              name="phone_number" 
              value={formData.phone_number} 
              onChange={handleInputChange} 
              className="input-field"
              disabled={loading}
            />
          </div>

          <LocationSelector
            selectedCountry={formData.country_id}
            selectedState={formData.state_id}
            selectedDistrict={formData.district_id}
            selectedCircle={formData.circle_id}
            onLocationChange={handleLocationChange}
            disabled={loading}
          />

          {availableSocieties.length > 0 && (
            <div className="form-group">
              <label htmlFor="societies" className="label">Available Societies (optional):</label>
              <select
                id="societies"
                name="societies"
                multiple
                value={formData.society_ids}
                onChange={handleSocietyChange}
                className="input-field"
                style={{ minHeight: '120px' }}
                disabled={loading}
              >
                {availableSocieties.map(society => (
                  <option key={society.id} value={society.id}>
                    {society.name} - {society.address}
                  </option>
                ))}
              </select>
              <small style={{ color: 'var(--secondary-text-color)', fontSize: '0.875rem' }}>
                Hold Ctrl (Cmd on Mac) to select multiple societies. You can also join societies later.
              </small>
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            <span>{loading ? 'Registering...' : 'Register'}</span>
          </button>
        </form>

        <p style={{ marginTop: '1.5rem' }}>
          Already have an account? <Link to="/login?role=resident" className="app-link">Login here</Link>
        </p>
        <p><Link to="/" className="app-link">Back to Role Selection</Link></p>
      </div>
    </div>
  );
}

export default ResidentRegisterPage;