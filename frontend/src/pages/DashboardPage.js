// frontend/src/pages/DashboardPage.js
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import '../App.css';

function DashboardPage() {
    const [userProfile, setUserProfile] = useState(null);
    const [societies, setSocieties] = useState([]);
    const [availableSocieties, setAvailableSocieties] = useState([]);
    const [initiatedRequests, setInitiatedRequests] = useState([]);
    const [votingRequests, setVotingRequests] = useState([]); // New state for voting requests
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { theme } = useTheme();

    const authToken = localStorage.getItem('authToken');
    const userRole = localStorage.getItem('userRole');

    // --- Fetch User Profile and Societies ---
    const fetchUserData = useCallback(async () => {
        setLoading(true);
        setError('');
        setMessage('');

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

        const backendIp = '127.0.0.1';
        const backendPort = '8000';

        try {
            console.log("DashboardPage: Attempting to fetch user profile...");
            // Fetch User Profile
            const profileResponse = await axios.get(`http://${backendIp}:${backendPort}/api/user-profile/`, { headers });
            console.log("DashboardPage: User profile fetched:", profileResponse.data);
            setUserProfile(profileResponse.data);
            setSocieties(profileResponse.data.societies || []);

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

            console.log("DashboardPage: Attempting to fetch voting requests for voting...");
            // Fetch voting requests that this resident can vote on
            const votingRequestsResponse = await axios.get(`http://${backendIp}:${backendPort}/api/votingrequests/`, { headers });
            console.log("DashboardPage: Voting requests fetched:", votingRequestsResponse.data);
            setVotingRequests(votingRequestsResponse.data);

        } catch (err) {
            console.error("DashboardPage: Error fetching user data:", err.response ? err.response.data : err.message);
            let errorMessage = 'Failed to fetch user data.';
            if (err.response && err.response.data && err.response.data.detail) {
                errorMessage = `Error: ${err.response.data.detail}`;
            } else if (err.response && err.response.status === 401) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('userId');
                localStorage.removeItem('username');
                localStorage.removeItem('userRole');
                navigate('/login?role=resident');
            } else {
                errorMessage = `Error: ${JSON.stringify(err.response.data)}`;
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [authToken, userRole, navigate]);

    useEffect(() => {
        fetchUserData();
    }, [fetchUserData]);

    // --- Handle Logout ---
    const handleLogout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        localStorage.removeItem('userRole');
        console.log("DashboardPage: User logged out. Clearing local storage.");
        navigate('/');
    };

    // --- Handle Initiate Join Request ---
    const handleInitiateJoinRequest = async (societyId) => {
        setLoading(true);
        setError('');
        setMessage('');

        const backendIp = '127.0.0.1';
        const backendPort = '8000';

        const headers = {
            Authorization: `Token ${authToken}`,
        };

        try {
            console.log(`DashboardPage: Attempting to initiate join request for society ID: ${societyId}`);
            const response = await axios.post(`http://${backendIp}:${backendPort}/api/votingrequests/initiate-resident-join/`, { society_id: societyId }, { headers });
            console.log("DashboardPage: Join request initiated successfully:", response.data);
            setMessage('Join request initiated successfully! It is pending approval.');
            fetchUserData();

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
                navigate('/login?role=resident');
            }
        } finally {
            setLoading(false);
        }
    };

    // --- Handle Vote ---
    const handleVote = async (requestId, voteType) => {
        setLoading(true);
        setError('');
        setMessage('');

        const backendIp = '127.0.0.1';
        const backendPort = '8000';

        const headers = {
            Authorization: `Token ${authToken}`,
        };

        try {
            console.log(`DashboardPage: Attempting to vote ${voteType} on request ID: ${requestId}`);
            const response = await axios.post(`http://${backendIp}:${backendPort}/api/votingrequests/${requestId}/vote/`, { vote_type: voteType }, { headers });
            console.log("DashboardPage: Vote cast successfully:", response.data);
            setMessage(`Vote cast successfully! You voted to ${voteType}.`);
            fetchUserData(); // Refresh data to update vote counts and has_voted status

        } catch (err) {
            console.error("DashboardPage: Error casting vote:", err.response ? err.response.data : err.message);
            let errorMessage = 'Failed to cast vote.';
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
                navigate('/login?role=resident');
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
        return <div className={`page-container page-dashboard ${theme === 'dark' ? 'dark' : 'light'}`}>User profile not loaded.</div>;
    }

    return (
        <div className={`page-container page-dashboard ${theme === 'dark' ? 'dark' : 'light'}`}>
            <div className="card" style={{ maxWidth: '800px' }}>
                <h2 className="heading-medium">Resident Dashboard</h2>

                {message && <div className="message message-success">{message}</div>}
                {error && <div className="message message-error">{error}</div>}

                <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
                    <h3 className="heading-small" style={{ marginBottom: '1rem' }}>Welcome, {userProfile.user.username}!</h3>
                    <p><strong>Email:</strong> {userProfile.user.email}</p>
                    <p><strong>Phone:</strong> {userProfile.phone_number || 'N/A'}</p>
                </div>

                {/* --- Associated Societies Section --- */}
                <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
                    <h3 className="heading-small" style={{ marginBottom: '1rem' }}>Your Societies</h3>
                    {societies.length > 0 ? (
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {societies.map(society => (
                                <li key={society.id} style={{ borderBottom: '1px solid var(--border-color)', padding: '10px 0', marginBottom: '5px' }}>
                                    <p><strong>{society.name}</strong> - {society.address}</p>
                                    <Link to={`/society/${society.id}`} className="app-link">View Details</Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>You are not currently a member of any societies.</p>
                    )}
                </div>

                {/* --- Voting Requests Section --- */}
                <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
                    <h3 className="heading-small" style={{ marginBottom: '1rem' }}>Pending Voting Requests</h3>
                    {loading ? (
                        <p>Loading voting requests...</p>
                    ) : votingRequests.length > 0 ? (
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {votingRequests.map(request => (
                                <li key={request.id} style={{ borderBottom: '1px solid var(--border-color)', padding: '15px 0', marginBottom: '10px' }}>
                                    <div style={{ marginBottom: '10px' }}>
                                        <p><strong>Request Type:</strong> {request.request_type === 'resident_join' ? 'Resident Join Request' : 'Service Provider Listing Request'}</p>
                                        <p><strong>Society:</strong> {request.society.name}</p>
                                        <p><strong>Status:</strong> {request.status}</p>
                                        
                                        {request.request_type === 'resident_join' && request.resident_user && (
                                            <p><strong>Requesting User:</strong> {request.resident_user.username}</p>
                                        )}
                                        
                                        {request.request_type === 'provider_list' && request.service_provider && (
                                            <div>
                                                <p><strong>Service Provider:</strong> {request.service_provider.name}</p>
                                                {request.service_provider.services && request.service_provider.services.length > 0 && (
                                                    <p><strong>Services:</strong> {request.service_provider.services.map(s => s.name).join(', ')}</p>
                                                )}
                                            </div>
                                        )}
                                        
                                        <p><strong>Expires:</strong> {new Date(request.expiry_time).toLocaleString()}</p>
                                        <p><strong>Votes:</strong> {request.approved_votes_count} Approve, {request.rejected_votes_count} Reject</p>
                                    </div>
                                    
                                    {!request.has_voted ? (
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button
                                                onClick={() => handleVote(request.id, 'approve')}
                                                className="btn btn-secondary btn-small"
                                                disabled={loading}
                                            >
                                                <span>Approve</span>
                                            </button>
                                            <button
                                                onClick={() => handleVote(request.id, 'reject')}
                                                className="btn btn-primary btn-small"
                                                style={{ backgroundColor: '#f44336' }}
                                                disabled={loading}
                                            >
                                                <span>Reject</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <p style={{ color: 'green', fontWeight: 'bold' }}>✓ You have already voted on this request</p>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        !loading && <p>No pending voting requests at this time.</p>
                    )}
                </div>

                {/* --- Available Societies to Join Section --- */}
                <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
                    <h3 className="heading-small" style={{ marginBottom: '1rem' }}>Societies Available to Join</h3>
                    {loading ? (
                        <p>Loading available societies...</p>
                    ) : availableSocieties.length > 0 ? (
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {availableSocieties.map(society => (
                                <li key={society.id} style={{ borderBottom: '1px solid var(--border-color)', padding: '10px 0', marginBottom: '5px' }}>
                                    <p><strong>{society.name}</strong> - {society.address}</p>
                                    <button
                                        onClick={() => handleInitiateJoinRequest(society.id)}
                                        className="btn btn-primary btn-small"
                                        style={{ marginTop: '10px' }}
                                        disabled={loading}
                                    >
                                        <span>Initiate Join Request</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        !loading && <p>No societies available for you to join at this time.</p>
                    )}
                </div>

                {/* --- Initiated Voting Requests Section --- */}
                <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
                    <h3 className="heading-small" style={{ marginBottom: '1rem' }}>Your Initiated Requests</h3>
                    {loading ? (
                        <p>Loading initiated requests...</p>
                    ) : initiatedRequests.length > 0 ? (
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {initiatedRequests.map(request => (
                                <li key={request.id} style={{ borderBottom: '1px solid var(--border-color)', padding: '10px 0', marginBottom: '5px' }}>
                                    <p><strong>Request Type:</strong> {request.request_type}</p>
                                    <p><strong>Society:</strong> {request.society.name}</p>
                                    <p><strong>Status:</strong> {request.status}</p>
                                    {request.request_type === 'resident_join' && request.resident_user && (
                                        <p><strong>Target User:</strong> {request.resident_user.username}</p>
                                    )}
                                    {request.request_type === 'provider_list' && request.service_provider && (
                                        <p><strong>Target Provider:</strong> {request.service_provider.name}</p>
                                    )}
                                    <p><strong>Expires At:</strong> {new Date(request.expiry_time).toLocaleString()}</p>
                                    <p><strong>Votes:</strong> {request.approved_votes_count} Approve, {request.rejected_votes_count} Reject</p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        !loading && <p>You have not initiated any voting requests.</p>
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

export default DashboardPage;