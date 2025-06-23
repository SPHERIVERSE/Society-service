// frontend/src/pages/ProviderDashboardPage.js
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom'; // Removed unused Link import
import { useTheme } from '../contexts/ThemeContext'; // Import useTheme
import '../App.css'; // Import the central CSS file


function ProviderDashboardPage() {
    const [serviceProviderProfile, setServiceProviderProfile] = useState(null);
    const [initiatedRequests, setInitiatedRequests] = useState([]); // Voting requests initiated by the provider
    const [availableSocietiesForProvider, setAvailableSocietiesForProvider] = useState([]); // <-- New state for available societies
    const [error, setError] = useState('');
    const [message, setMessage] = useState(''); // For success messages
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { theme } = useTheme(); // Use the theme context


    const authToken = localStorage.getItem('authToken');
    const userRole = localStorage.getItem('userRole');

    // --- Fetch Service Provider Profile and Initiated Requests ---
    const fetchProviderData = useCallback(async () => {
        setLoading(true);
        setError('');
        setMessage(''); // Clear messages on new fetch

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

         const backendIp = '127.0.0.1'; // <-- Update this for your testing/deployment environment
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
            // Fetch societies available for the provider to list services in
            const availableSocietiesResponse = await axios.get(`http://${backendIp}:${backendPort}/api/societies/available-for-service-provider/`, { headers });
            console.log("ProviderDashboardPage: Available societies for provider fetched:", availableSocietiesResponse.data);
            setAvailableSocietiesForProvider(availableSocietiesResponse.data);


        } catch (err) {
            console.error("ProviderDashboardPage: Error fetching provider data:", err.response ? err.response.data : err.message);
            let errorMessage = 'Failed to fetch provider data.';
            if (err.response && err.response.data && err.response.data.detail) {
                errorMessage = `Error: ${err.response.data.detail}`;
            }
             else if (err.response && err.response.status === 401) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('userId');
                localStorage.removeItem('username');
                localStorage.removeItem('userRole');
                navigate('/login?role=provider'); // Redirect to provider login on error
            }
            else {
                 errorMessage = `Error: ${JSON.stringify(err.response.data)}`;
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [authToken, userRole, navigate]); // Depend on authToken, userRole, and navigate


    useEffect(() => {
        fetchProviderData(); // Fetch data on component mount
    }, [fetchProviderData]); // Depend on fetchProviderData


    // --- Handle Logout ---
    const handleLogout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        localStorage.removeItem('userRole');
        console.log("ProviderDashboardPage: User logged out. Clearing local storage.");
        navigate('/'); // Redirect to homepage
    };

    // --- Handle Initiate Listing Request ---
    const handleInitiateListingRequest = async (societyId) => {
        setLoading(true);
        setError('');
        setMessage(''); // Clear previous messages

        const backendIp = '127.0.0.1'; // <-- Update this for your testing/deployment environment
        const backendPort = '8000';

        const headers = {
            Authorization: `Token ${authToken}`,
        };

        try {
            console.log(`ProviderDashboardPage: Attempting to initiate listing request for society ID: ${societyId}`);
            const response = await axios.post(`http://${backendIp}:${backendPort}/api/votingrequests/initiate-service-provider-listing/`, { society_id: societyId }, { headers });
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
                navigate('/login?role=provider'); // Redirect to provider login on error
            }
        } finally {
            setLoading(false);
        }
    };


    if (loading && !serviceProviderProfile) {
        // Display loading message while fetching, or if profile is null initially
        return <div className={`page-container page-provider-dashboard ${theme === 'dark' ? 'dark' : 'light'}`}>Loading Service Provider Dashboard...</div>;
    }

    if (error && !serviceProviderProfile) {
        // Display error message if fetching failed and profile is null
        return <div className={`page-container page-provider-dashboard ${theme === 'dark' ? 'dark' : 'light'}`} style={{ color: 'red' }}>Error: {error}</div>;
    }

     if (!serviceProviderProfile) {
         // Fallback message if profile is unexpectedly null after loading
         return <div className={`page-container page-provider-dashboard ${theme === 'dark' ? 'dark' : 'light'}`}>Service provider profile not loaded.</div>;
     }


    return (
        <div className={`page-container page-provider-dashboard ${theme === 'dark' ? 'dark' : 'light'}`}> {/* Use page-container, page-provider-dashboard, and theme class */}
            <div className="card" style={{ maxWidth: '600px' }}> {/* Use card class, increase max-width */}
                <h2 className="heading-medium">Service Provider Dashboard</h2> {/* Use heading-medium class */}

                 {message && <div className="message message-success">{message}</div>}
                {error && <div className="message message-error">{error}</div>}

                <div style={{ marginBottom: '2rem', textAlign: 'left' }}> {/* Added margin and left align */}
                    {/* Conditional rendering: Only access properties if serviceProviderProfile is not null */}
                    {serviceProviderProfile && (
                         <>
                            <h3 className="heading-small" style={{ marginBottom: '1rem' }}>Welcome, {serviceProviderProfile.name}!</h3> {/* Use heading-small */}
                            <p><strong>Username:</strong> {serviceProviderProfile.user.username}</p>
                            <p><strong>Email:</strong> {serviceProviderProfile.user.email}</p>
                            <p><strong>Contact Info:</strong> {serviceProviderProfile.contact_info || 'N/A'}</p>
                             <p><strong>Brief Note:</strong> {serviceProviderProfile.brief_note || 'N/A'}</p>
                             <p><strong>Approved:</strong> {serviceProviderProfile.is_approved ? 'Yes' : 'No'}</p>

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
                     <h3 className="heading-small" style={{ marginBottom: '1rem' }}>Societies Available for Listing</h3>
                     {loading ? (
                         <p>Loading available societies...</p>
                     ) : availableSocietiesForProvider.length > 0 ? (
                         <ul style={{ listStyle: 'none', padding: 0 }}>
                             {availableSocietiesForProvider.map(society => (
                                 <li key={society.id} style={{ borderBottom: '1px solid var(--border-color)', padding: '10px 0', marginBottom: '5px' }}>
                                     <p><strong>{society.name}</strong> - {society.address}</p>
                                     <button
                                         onClick={() => handleInitiateListingRequest(society.id)}
                                         className="btn btn-primary btn-small"
                                         style={{ marginTop: '10px' }}
                                     >
                                         <span>Initiate Listing Request</span>
                                     </button>
                                 </li>
                             ))}
                         </ul>
                     ) : (
                         !loading && <p>No societies available for you to list services in at this time.</p>
                     )}
                 </div>


                 {/* --- Initiated Voting Requests Section (for Provider Listing) --- */}
                 <div style={{ marginBottom: '2rem', textAlign: 'left' }}> {/* Added margin and left align */}
                     <h3 className="heading-small" style={{ marginBottom: '1rem' }}>Your Listing Requests</h3> {/* Use heading-small */}
                     {loading ? (
                         <p>Loading initiated requests...</p>
                     ) : initiatedRequests.length > 0 ? (
                         <ul style={{ listStyle: 'none', padding: 0 }}>
                             {initiatedRequests.map(request => (
                                 <li key={request.id} style={{ borderBottom: '1px solid var(--border-color)', padding: '10px 0', marginBottom: '5px' }}> {/* Use var(--border-color) */}
                                     <p><strong>Request Type:</strong> {request.request_type}</p>
                                     <p><strong>Society:</strong> {request.society.name}</p>
                                     <p><strong>Status:</strong> {request.status}</p>
                                     {/* Display target (should be the provider themselves for listing requests) */}
                                      {request.request_type === 'provider_list' && request.service_provider && (
                                         <p><strong>Target Provider:</strong> {request.service_provider.name}</p>
                                     )}
                                     <p><strong>Expires At:</strong> {new Date(request.expiry_time).toLocaleString()}</p>
                                     {/* Add more request details */}
                                 </li>
                             ))}
                         </ul>
                     ) : (
                         !loading && <p>You have not initiated any listing requests.</p>
                     )}
                 </div>


                {/* Logout Button */}
                <button onClick={handleLogout} className="btn btn-primary" style={{ marginTop: '2rem', backgroundColor: '#f44336' }}> {/* Use btn and btn-primary, override color */}
                    <span>Logout</span> {/* Wrap text in span */}
                </button>
            </div>
        </div>
    );
}

export default ProviderDashboardPage;

