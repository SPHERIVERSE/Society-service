// frontend/src/pages/DashboardPage.js
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext'; // Import useTheme
import '../App.css'; // Import the central CSS file


function DashboardPage() {
    const [userProfile, setUserProfile] = useState(null);
    const [societies, setSocieties] = useState([]);
    const [availableSocieties, setAvailableSocieties] = useState([]); // Societies available to join
    const [initiatedRequests, setInitiatedRequests] = useState([]); // Voting requests initiated by the resident
    const [error, setError] = useState('');
    const [message, setMessage] = useState(''); // <-- Ensure message state is declared
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { theme } = useTheme(); // Use the theme context


    const authToken = localStorage.getItem('authToken');
    const userRole = localStorage.getItem('userRole');

    // --- Fetch User Profile and Societies ---
    const fetchUserData = useCallback(async () => {
        setLoading(true);
        setError('');
        setMessage(''); // Clear messages on new fetch

        if (!authToken || userRole !== 'resident') {
            setError('Authentication token not found or not authorized as resident. Please login.');
             console.error("DashboardPage: Authentication token missing or user not a resident.");
            navigate('/login?role=resident');
            setLoading(false);
            return;
        }

        const headers = {
            Authorization: `Token ${authToken}`,
        };

         const backendIp = '127.0.0.1'; // <-- Update this for your testing/deployment environment
         const backendPort = '8000';

        try {
            console.log("DashboardPage: Attempting to fetch user profile...");
            // Fetch User Profile (includes associated societies)
            const profileResponse = await axios.get(`http://${backendIp}:${backendPort}/api/user-profile/`, { headers });
            console.log("DashboardPage: User profile fetched:", profileResponse.data);
            setUserProfile(profileResponse.data);
            setSocieties(profileResponse.data.societies || []); // Set associated societies

            console.log("DashboardPage: Attempting to fetch available societies...");
            // Fetch Societies available to join
            const availableSocietiesResponse = await axios.get(`http://${backendIp}:${backendPort}/api/societies/available-for-resident/`, { headers });
             console.log("DashboardPage: Available societies fetched:", availableSocietiesResponse.data);
            setAvailableSocieties(availableSocietiesResponse.data);


            console.log("DashboardPage: Attempting to fetch initiated voting requests...");
            // Fetch voting requests initiated by this resident
             const initiatedRequestsResponse = await axios.get(`http://${backendIp}:${backendPort}/api/my-initiated-voting-requests/`, { headers });
             console.log("DashboardPage: Initiated voting requests fetched:", initiatedRequestsResponse.data);
            setInitiatedRequests(initiatedRequestsResponse.data);


        } catch (err) {
            console.error("DashboardPage: Error fetching user data:", err.response ? err.response.data : err.message);
            let errorMessage = 'Failed to fetch user data.';
            if (err.response && err.response.data && err.response.data.detail) {
                errorMessage = `Error: ${err.response.data.detail}`;
            }
             else if (err.response && err.response.status === 401) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('userId');
                localStorage.removeItem('username');
                localStorage.removeItem('userRole');
                navigate('/login?role=resident'); // Redirect to resident login on error
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
        fetchUserData(); // Fetch data on component mount
    }, [fetchUserData]); // Depend on fetchUserData


    // --- Handle Logout ---
    const handleLogout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        localStorage.removeItem('userRole');
        console.log("DashboardPage: User logged out. Clearing local storage.");
        navigate('/'); // Redirect to homepage
    };

     // --- Handle Initiate Join Request ---
    const handleInitiateJoinRequest = async (societyId) => {
        setLoading(true);
        setError('');
        setMessage(''); // Clear previous messages

         const backendIp = '127.0.0.1'; // <-- Update this for your testing/deployment environment
         const backendPort = '8000';

        const headers = {
            Authorization: `Token ${authToken}`,
        };

        try {
            console.log(`DashboardPage: Attempting to initiate join request for society ID: ${societyId}`);
            const response = await axios.post(`http://${backendIp}:${backendPort}/api/votingrequests/initiate-resident-join/`, { society_id: societyId }, { headers });
            console.log("DashboardPage: Join request initiated successfully:", response.data);
            setMessage('Join request initiated successfully! It is pending approval.');
            // Refresh initiated requests list after initiating a new one
            fetchUserData(); // Re-fetch all data to update lists

        } catch (err) {
            console.error("DashboardPage: Error initiating join request:", err.response ? err.response.data : err.message);
            let errorMessage = 'Failed to initiate join request.';
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
                navigate('/login?role=resident'); // Redirect to resident login on error
            }
        } finally {
            setLoading(false);
        }
    };


    if (loading && !userProfile) {
        return <div className={`page-container page-dashboard ${theme === 'dark' ? 'dark' : 'light'}`}>Loading Dashboard...</div>;
    }

    if (error && !userProfile) {
        return <div className={`page-container page-dashboard ${theme === 'dark' ? 'dark' : 'light'}`} style={{ color: 'red' }}>Error: {error}</div>;
    }

     if (!userProfile) {
         // This case should theoretically be covered by the initial loading/error states,
         // but as a fallback, show a message if profile is unexpectedly null.
         return <div className={`page-container page-dashboard ${theme === 'dark' ? 'dark' : 'light'}`}>User profile not loaded.</div>;
     }


    return (
        <div className={`page-container page-dashboard ${theme === 'dark' ? 'dark' : 'light'}`}> {/* Use page-container, page-dashboard, and theme class */}
            <div className="card" style={{ maxWidth: '600px' }}> {/* Use card class, increase max-width for dashboard */}
                <h2 className="heading-medium">Resident Dashboard</h2> {/* Use heading-medium class */}

                 {/* Use message state and apply message classes */}
                 {message && <div className="message message-success">{message}</div>}
                {error && <div className="message message-error">{error}</div>}

                <div style={{ marginBottom: '2rem', textAlign: 'left' }}> {/* Added margin and left align */}
                    <h3 className="heading-small" style={{ marginBottom: '1rem' }}>Welcome, {userProfile.user.username}!</h3> {/* Use heading-small (define in App.css) */}
                    <p><strong>Email:</strong> {userProfile.user.email}</p>
                    <p><strong>Phone:</strong> {userProfile.phone_number || 'N/A'}</p>
                    {/* Add other profile details here */}
                </div>

                {/* --- Associated Societies Section --- */}
                <div style={{ marginBottom: '2rem', textAlign: 'left' }}> {/* Added margin and left align */}
                    <h3 className="heading-small" style={{ marginBottom: '1rem' }}>Your Societies</h3> {/* Use heading-small */}
                    {societies.length > 0 ? (
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {societies.map(society => (
                                <li key={society.id} style={{ borderBottom: '1px solid var(--border-color)', padding: '10px 0', marginBottom: '5px' }}> {/* Use var(--border-color) */}
                                    <p><strong>{society.name}</strong> - {society.address}</p>
                                     {/* Link to Society Detail Page */}
                                    <Link to={`/society/${society.id}`} className="app-link">View Details</Link> {/* Use app-link class */}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>You are not currently a member of any societies.</p>
                    )}
                </div>

                 {/* --- Available Societies to Join Section --- */}
                 <div style={{ marginBottom: '2rem', textAlign: 'left' }}> {/* Added margin and left align */}
                     <h3 className="heading-small" style={{ marginBottom: '1rem' }}>Societies Available to Join</h3> {/* Use heading-small */}
                     {loading ? (
                         <p>Loading available societies...</p>
                     ) : availableSocieties.length > 0 ? (
                         <ul style={{ listStyle: 'none', padding: 0 }}>
                             {availableSocieties.map(society => (
                                 <li key={society.id} style={{ borderBottom: '1px solid var(--border-color)', padding: '10px 0', marginBottom: '5px' }}> {/* Use var(--border-color) */}
                                     <p><strong>{society.name}</strong> - {society.address}</p>
                                     <button
                                         onClick={() => handleInitiateJoinRequest(society.id)}
                                         className="btn btn-primary btn-small" // Use btn, btn-primary, and btn-small (define in App.css)
                                         style={{ marginTop: '10px' }} // Add margin top
                                     >
                                         <span>Initiate Join Request</span> {/* Wrap text in span */}
                                     </button>
                                 </li>
                             ))}
                         </ul>
                     ) : (
                         !loading && <p>No societies available for you to join at this time.</p>
                     )}
                 </div>

                 {/* --- Initiated Voting Requests Section --- */}
                 <div style={{ marginBottom: '2rem', textAlign: 'left' }}> {/* Added margin and left align */}
                     <h3 className="heading-small" style={{ marginBottom: '1rem' }}>Your Initiated Requests</h3> {/* Use heading-small */}
                     {loading ? (
                         <p>Loading initiated requests...</p>
                     ) : initiatedRequests.length > 0 ? (
                         <ul style={{ listStyle: 'none', padding: 0 }}>
                             {initiatedRequests.map(request => (
                                 <li key={request.id} style={{ borderBottom: '1px solid var(--border-color)', padding: '10px 0', marginBottom: '5px' }}> {/* Use var(--border-color) */}
                                     <p><strong>Request Type:</strong> {request.request_type}</p>
                                     <p><strong>Society:</strong> {request.society.name}</p>
                                     <p><strong>Status:</strong> {request.status}</p>
                                     {/* Display target based on request type */}
                                     {request.request_type === 'resident_join' && request.resident_user && (
                                         <p><strong>Target User:</strong> {request.resident_user.username}</p>
                                     )}
                                      {request.request_type === 'provider_list' && request.service_provider && (
                                         <p><strong>Target Provider:</strong> {request.service_provider.name}</p>
                                     )}
                                     <p><strong>Expires At:</strong> {new Date(request.expiry_time).toLocaleString()}</p>
                                     {/* Add more request details */}
                                 </li>
                             ))}
                         </ul>
                     ) : (
                         !loading && <p>You have not initiated any voting requests.</p>
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

export default DashboardPage;

