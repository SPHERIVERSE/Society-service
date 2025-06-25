// frontend/src/pages/ProviderDashboardPage.js
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import '../App.css';

function ProviderDashboardPage() {
    const [serviceProviderProfile, setServiceProviderProfile] = useState(null);
    const [initiatedRequests, setInitiatedRequests] = useState([]);
    const [availableSocietiesForProvider, setAvailableSocietiesForProvider] = useState([]);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { theme } = useTheme();

    const authToken = localStorage.getItem('authToken');
    const userRole = localStorage.getItem('userRole');

    // --- Fetch Service Provider Profile and Initiated Requests ---
    const fetchProviderData = useCallback(async () => {
        setLoading(true);
        setError('');
        setMessage('');

        if (!authToken || userRole !== 'provider') {
            setError('Authentication token not found or not authorized as service provider. Please login.');
            console.error("ProviderDashboardPage: Authentication token missing or user not a provider.");
            navigate('/login?role=provider');
            setLoading(false);
            return;
        }

        const headers = {
            Authorization: `Token ${authToken}`,
        };

        const backendIp = '127.0.0.1';
        const backendPort = '8000';

        try {
            console.log("ProviderDashboardPage: Attempting to fetch service provider profile...");
            // Fetch Service Provider Profile
            const profileResponse = await axios.get(`http://${backendIp}:${backendPort}/api/service-provider-profile/`, { headers });
            console.log("ProviderDashboardPage: Service provider profile fetched:", profileResponse.data);
            setServiceProviderProfile(profileResponse.data);

            console.log("ProviderDashboardPage: Attempting to fetch initiated voting requests...");
            // Fetch voting requests initiated by this provider
            const initiatedRequestsResponse = await axios.get(`http://${backendIp}:${backendPort}/api/my-initiated-voting-requests/`, { headers });
            console.log("ProviderDashboardPage: Initiated voting requests fetched:", initiatedRequestsResponse.data);
            setInitiatedRequests(initiatedRequestsResponse.data);

            console.log("ProviderDashboardPage: Attempting to fetch societies available for listing...");
            // Fetch societies available for the provider to list services in (now filtered by location)
            const availableSocietiesResponse = await axios.get(`http://${backendIp}:${backendPort}/api/societies/available-for-provider/`, { headers });
            console.log("ProviderDashboardPage: Available societies for provider fetched:", availableSocietiesResponse.data);
            setAvailableSocietiesForProvider(availableSocietiesResponse.data);

        } catch (err) {
            console.error("ProviderDashboardPage: Error fetching provider data:", err.response ? err.response.data : err.message);
            let errorMessage = 'Failed to fetch provider data.';
            if (err.response && err.response.data && err.response.data.detail) {
                errorMessage = `Error: ${err.response.data.detail}`;
            } else if (err.response && err.response.status === 401) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('userId');
                localStorage.removeItem('username');
                localStorage.removeItem('userRole');
                navigate('/login?role=provider');
            } else {
                errorMessage = `Error: ${JSON.stringify(err.response.data)}`;
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [authToken, userRole, navigate]);

    useEffect(() => {
        fetchProviderData();
    }, [fetchProviderData]);

    // --- Handle Logout ---
    const handleLogout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        localStorage.removeItem('userRole');
        console.log("ProviderDashboardPage: User logged out. Clearing local storage.");
        navigate('/');
    };

    // --- Handle Initiate Listing Request ---
    const handleInitiateListingRequest = async (societyId) => {
        setLoading(true);
        setError('');
        setMessage('');

        const backendIp = '127.0.0.1';
        const backendPort = '8000';

        const headers = {
            Authorization: `Token ${authToken}`,
        };

        try {
            console.log(`ProviderDashboardPage: Attempting to initiate listing request for society ID: ${societyId}`);
            const response = await axios.post(`http://${backendIp}:${backendPort}/api/votingrequests/initiate-provider-listing/`, { society_id: societyId }, { headers });
            console.log("ProviderDashboardPage: Listing request initiated successfully:", response.data);
            setMessage('Listing request initiated successfully! It is pending approval.');
            // Refresh initiated requests and available societies lists
            fetchProviderData();

        } catch (err) {
            console.error("ProviderDashboardPage: Error initiating listing request:", err.response ? err.response.data : err.message);
            let errorMessage = 'Failed to initiate listing request.';
            if (err.response && err.response.data && err.response.data.detail) {
                errorMessage = `Error: ${err.response.data.detail}`;
            } else if (err.response && err.response.data) {
                errorMessage = `Error: ${JSON.stringify(err.response.data)}`;
            }
            setError(errorMessage);
            if (err.response && err.response.status === 401) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('userId');
                localStorage.removeItem('username');
                localStorage.removeItem('userRole');
                navigate('/login?role=provider');
            }
        } finally {
            setLoading(false);
        }
    };

    if (loading && !serviceProviderProfile) {
        return <div className={`page-container page-provider-dashboard ${theme === 'dark' ? 'dark' : 'light'}`}>Loading Service Provider Dashboard...</div>;
    }

    if (error && !serviceProviderProfile) {
        return <div className={`page-container page-provider-dashboard ${theme === 'dark' ? 'dark' : 'light'}`} style={{ color: 'red' }}>Error: {error}</div>;
    }

    if (!serviceProviderProfile) {
        return <div className={`page-container page-provider-dashboard ${theme === 'dark' ? 'dark' : 'light'}`}>Service provider profile not loaded.</div>;
    }

    return (
        <div className={`page-container page-provider-dashboard ${theme === 'dark' ? 'dark' : 'light'}`}>
            <div className="card" style={{ maxWidth: '800px' }}>
                <h2 className="heading-medium">Service Provider Dashboard</h2>

                {message && <div className="message message-success">{message}</div>}
                {error && <div className="message message-error">{error}</div>}

                <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
                    {serviceProviderProfile && (
                        <>
                            <h3 className="heading-small" style={{ marginBottom: '1rem' }}>Welcome, {serviceProviderProfile.name}!</h3>
                            <p><strong>Username:</strong> {serviceProviderProfile.user.username}</p>
                            <p><strong>Email:</strong> {serviceProviderProfile.user.email}</p>
                            <p><strong>Contact Info:</strong> {serviceProviderProfile.contact_info || 'N/A'}</p>
                            <p><strong>Brief Note:</strong> {serviceProviderProfile.brief_note || 'N/A'}</p>
                            <p><strong>Approved:</strong> {serviceProviderProfile.is_approved ? 'Yes' : 'No'}</p>

                            {/* Display location information */}
                            {serviceProviderProfile.country && (
                                <div style={{ marginTop: '1rem' }}>
                                    <p><strong>Service Area:</strong></p>
                                    <p style={{ marginLeft: '1rem' }}>
                                        {serviceProviderProfile.country.name}, {serviceProviderProfile.state.name}, {serviceProviderProfile.district.name}, {serviceProviderProfile.circle.name}
                                    </p>
                                </div>
                            )}

                            {/* Display associated societies */}
                            <div style={{ marginTop: '1rem' }}>
                                <p><strong>Associated Societies:</strong>{' '}
                                    {serviceProviderProfile.societies && serviceProviderProfile.societies.length > 0 ? (
                                        serviceProviderProfile.societies.map((society, index) => (
                                            <span key={society.id}>
                                                {society.name}{index < serviceProviderProfile.societies.length - 1 ? ', ' : ''}
                                            </span>
                                        ))
                                    ) : (
                                        'None'
                                    )}
                                </p>
                            </div>

                            {/* Display services offered */}
                            <div style={{ marginTop: '1rem' }}>
                                <p><strong>Services Offered:</strong>{' '}
                                    {serviceProviderProfile.services && serviceProviderProfile.services.length > 0 ? (
                                        serviceProviderProfile.services.map((service, index) => (
                                            <span key={service.id}>
                                                {service.name}{index < serviceProviderProfile.services.length - 1 ? ', ' : ''}
                                            </span>
                                        ))
                                    ) : (
                                        'No services listed.'
                                    )}
                                </p>
                            </div>
                        </>
                    )}
                </div>

                {/* --- Available Societies for Listing Section --- */}
                <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
                    <h3 className="heading-small" style={{ marginBottom: '1rem' }}>Societies Available for Listing in Your Area</h3>
                    {loading ? (
                        <p>Loading available societies...</p>
                    ) : availableSocietiesForProvider.length > 0 ? (
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {availableSocietiesForProvider.map(society => (
                                <li key={society.id} style={{ borderBottom: '1px solid var(--border-color)', padding: '10px 0', marginBottom: '5px' }}>
                                    <p><strong>{society.name}</strong> - {society.address}</p>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--secondary-text-color)' }}>
                                        Residents: {society.resident_count}
                                    </p>
                                    <button
                                        onClick={() => handleInitiateListingRequest(society.id)}
                                        className="btn btn-primary btn-small"
                                        style={{ marginTop: '10px' }}
                                        disabled={loading}
                                    >
                                        <span>Initiate Listing Request</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        !loading && <p>No societies available for you to list services in your area at this time.</p>
                    )}
                </div>

                {/* --- Initiated Voting Requests Section (for Provider Listing) --- */}
                <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
                    <h3 className="heading-small" style={{ marginBottom: '1rem' }}>Your Listing Requests</h3>
                    {loading ? (
                        <p>Loading initiated requests...</p>
                    ) : initiatedRequests.length > 0 ? (
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {initiatedRequests.map(request => (
                                <li key={request.id} style={{ borderBottom: '1px solid var(--border-color)', padding: '10px 0', marginBottom: '5px' }}>
                                    <p><strong>Request Type:</strong> {request.request_type}</p>
                                    <p><strong>Society:</strong> {request.society.name}</p>
                                    <p><strong>Status:</strong> {request.status}</p>
                                    {request.request_type === 'provider_list' && request.service_provider && (
                                        <p><strong>Target Provider:</strong> {request.service_provider.name}</p>
                                    )}
                                    <p><strong>Expires At:</strong> {new Date(request.expiry_time).toLocaleString()}</p>
                                    <p><strong>Votes:</strong> {request.approved_votes_count} Approve, {request.rejected_votes_count} Reject</p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        !loading && <p>You have not initiated any listing requests.</p>
                    )}
                </div>

                {/* Logout Button */}
                <button onClick={handleLogout} className="btn btn-primary" style={{ marginTop: '2rem', backgroundColor: '#f44336' }}>
                    <span>Logout</span>
                </button>
            </div>
        </div>
    );
}

export default ProviderDashboardPage;