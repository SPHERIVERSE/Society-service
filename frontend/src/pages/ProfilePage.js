// frontend/src/pages/ProfilePage.js
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function ProfilePage() {
    const [userProfile, setUserProfile] = useState(null); // For resident profile
    const [editFormData, setEditFormData] = useState({ // State for editing form
        phone_number: '',
        // Add other editable fields here if needed
    });
    const [isEditing, setIsEditing] = useState(false); // State to toggle edit mode

    const [initiatedRequests, setInitiatedRequests] = useState([]); // For initiated requests (both roles)
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState(''); // For success messages
    const navigate = useNavigate();

    const userRole = localStorage.getItem('userRole'); // Get user role from local storage

    // --- Fetch Data based on Role ---
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        setMessage(''); // Clear messages on new fetch

        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            setError('Authentication token not found. Please login.');
            // Redirect to login, potentially with the role
            navigate(`/login?role=${userRole}`);
            setLoading(false);
            return;
        }

        const headers = {
            Authorization: `Token ${authToken}`,
        };

        try {
            if (userRole === 'resident') {
                console.log("ProfilePage: Fetching resident profile...");
                // Fetch Resident Profile
                const profileResponse = await axios.get('http://127.0.0.1:8000/api/user-profile/', { headers });
                console.log("ProfilePage: Resident Profile fetched:", profileResponse.data);
                setUserProfile(profileResponse.data);
                // Initialize edit form data with current profile data
                setEditFormData({
                    phone_number: profileResponse.data.phone_number || '',
                    // Initialize other editable fields here
                });


                // For residents, initiated requests are join requests
                console.log("ProfilePage: Fetching initiated requests for resident...");
                const requestsResponse = await axios.get('http://172.17.0.1:8000/api/my-initiated-voting-requests/', { headers });
                 // Filter for resident_join requests if needed, though backend might already filter by initiated_by
                 const residentJoinRequests = requestsResponse.data.filter(req => req.request_type === 'resident_join');
                 console.log("ProfilePage: Initiated resident join requests fetched:", residentJoinRequests);
                 setInitiatedRequests(residentJoinRequests);


            } else if (userRole === 'provider') {
                 // This page is now specifically for Resident Profile.
                 // Provider profile is handled by ProviderProfilePage.js
                 // If a provider somehow lands here, redirect them to their correct profile page.
                 console.warn("ProfilePage: Provider user attempted to access Resident Profile Page. Redirecting.");
                 navigate('/provider-profile');
                 setLoading(false);
                 return;

            } else {
                setError('Unknown user role.');
            }

        } catch (err) {
            console.error("ProfilePage: Error fetching data:", err.response ? err.response.data : err.message);
            let errorMessage = 'Failed to fetch profile data.';
            if (err.response && err.response.data && err.response.data.detail) {
                errorMessage = `Error: ${err.response.data.detail}`;
            }
            setError(errorMessage);
             if (err.response && err.response.status === 401) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('userId');
                localStorage.removeItem('username');
                localStorage.removeItem('userRole');
                navigate('/login'); // Redirect to generic login on error
            }
        } finally {
            setLoading(false);
        }
    }, [navigate, userRole]); // Depend on navigate and userRole


    useEffect(() => {
        // Only fetch data if the user is a resident
        if (userRole === 'resident') {
            fetchData(); // Fetch data when the component mounts or userRole changes
        }
    }, [fetchData, userRole]); // Depend on fetchData and userRole


    // --- Handle Input Change for Edit Form ---
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditFormData({
            ...editFormData,
            [name]: value,
        });
    };

    // --- Handle Profile Update Submit ---
    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setMessage('');

        const authToken = localStorage.getItem('authToken');
         if (!authToken) {
            setError('Authentication token not found. Please login.');
            setLoading(false);
            navigate('/login?role=resident');
            return;
        }

        const headers = {
            Authorization: `Token ${authToken}`,
            'Content-Type': 'application/json',
        };

        try {
            console.log("ProfilePage: Attempting to update resident profile...");
            // Send PUT or PATCH request to update the profile
            // Using PATCH for partial updates
            const response = await axios.patch('http://127.0.0.1:8000/api/user-profile/', editFormData, { headers });
            console.log("ProfilePage: Profile updated successfully:", response.data);
            setUserProfile(response.data); // Update the displayed profile data
            setMessage('Profile updated successfully!');
            setIsEditing(false); // Exit edit mode

        } catch (err) {
            console.error("ProfilePage: Error updating profile:", err.response ? err.response.data : err.message);
            let errorMessage = 'Failed to update profile.';
             if (err.response && err.response.data) {
                 const backendErrors = err.response.data;
                 if (backendErrors.detail) {
                      errorMessage = `Error: ${backendErrors.detail}`;
                 } else {
                    errorMessage = 'Backend Error: ' + JSON.stringify(backendErrors);
                 }
             } else if (err.request) {
                errorMessage = 'Network Error: Could not connect to the server.';
             } else {
                 errorMessage = 'Request Error: ' + err.message;
             }
            setError(errorMessage);
             setMessage(''); // Clear success message on error
        } finally {
            setLoading(false);
        }
    };


     // --- Handle Logout ---
    const handleLogout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        localStorage.removeItem('userRole');
        console.log("ProfilePage: User logged out. Clearing local storage.");
        navigate('/'); // Redirect to homepage
    };


    // If user is not a resident, don't render this page content
    if (userRole !== 'resident') {
        return null; // Or render a message indicating incorrect role
    }


    if (loading && !userProfile && !initiatedRequests.length) {
        return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading Resident Profile...</div>;
    }

    if (error) {
        return <div style={{ textAlign: 'center', marginTop: '50px', color: 'red' }}>Error: {error}</div>;
    }

    return (
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
            <h2>Resident Profile</h2>

            {message && <div style={{ color: 'green', marginBottom: '15px' }}>{message}</div>}
            {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}


            {/* Display Resident Profile Info or Edit Form */}
            {userProfile && (
                <div style={{ marginBottom: '30px', border: '1px solid #ccc', padding: '15px', borderRadius: '8px', display: 'inline-block', textAlign: 'left', minWidth: '300px' }}>
                    <h3>Your Details</h3>
                     {!isEditing ? (
                         <>
                            <p><strong>Username:</strong> {userProfile.user ? userProfile.user.username : 'N/A'}</p>
                            <p><strong>Email:</strong> {userProfile.user ? userProfile.user.email : 'N/A'}</p>
                            <p><strong>Phone Number:</strong> {userProfile.phone_number || 'N/A'}</p>
                             {/* Add other display fields here */}
                            <button onClick={() => setIsEditing(true)} style={{ marginTop: '10px' }}>Edit Profile</button>
                         </>
                     ) : (
                         <form onSubmit={handleUpdateProfile}>
                             {/* Display non-editable fields */}
                             <p><strong>Username:</strong> {userProfile.user ? userProfile.user.username : 'N/A'}</p>
                             <p><strong>Email:</strong> {userProfile.user ? userProfile.user.email : 'N/A'}</p>

                             {/* Editable fields */}
                             <div style={{ marginTop: '10px' }}>
                                 <label htmlFor="phone_number">Phone Number:</label>
                                 <input
                                     type="text"
                                     id="phone_number"
                                     name="phone_number"
                                     value={editFormData.phone_number}
                                     onChange={handleInputChange}
                                 />
                             </div>
                             {/* Add other editable input fields here */}

                             <button type="submit" disabled={loading} style={{ marginTop: '15px', marginRight: '10px' }}>
                                 {loading ? 'Saving...' : 'Save Changes'}
                             </button>
                             <button type="button" onClick={() => setIsEditing(false)} disabled={loading}>
                                 Cancel
                             </button>
                         </form>
                     )}
                </div>
            )}


            {/* --- My Initiated Voting Requests Section (for residents - join requests) --- */}
             <div style={{ marginTop: '20px', border: '1px solid #ccc', padding: '15px', borderRadius: '8px', display: 'inline-block', textAlign: 'left', minWidth: '300px' }}>
                 <h3>My Initiated Join Requests</h3>
                  {loading && !initiatedRequests.length > 0 ? (
                     <p>Loading initiated requests...</p>
                 ) : initiatedRequests.length > 0 ? (
                     <ul style={{ listStyle: 'none', padding: 0 }}>
                         {initiatedRequests.map(request => (
                             <li key={request.id} style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '10px' }}>
                                 <p><strong>Request Type:</strong> {request.request_type_display}</p>
                                  {/* Display details based on request type */}
                                 {request.request_type === 'resident_join' && request.resident_user && (
                                      <p>Joining Resident: {request.resident_user.username}</p>
                                 )}
                                  {/* Display society name from the nested society object */}
                                 {request.society && request.society.name && (
                                     <p>For Society: {request.society.name}</p>
                                 )}
                                  {/* Display status using the status_display field */}
                                 {request.status_display && (
                                       <p><strong>Status:</strong> {request.status_display}</p>
                                  )}
                                 <p>Expires: {new Date(request.expiry_time).toLocaleString()}</p>
                                 {request.approved_votes_count !== undefined && request.rejected_votes_count !== undefined && (
                                     <p>Votes: {request.approved_votes_count} Approved, {request.rejected_votes_count} Rejected</p>
                                 )}
                                 {/* You can add more details or actions here */}
                             </li>
                         ))}
                     </ul>
                 ) : (
                     !loading && <p>You have not initiated any join requests.</p>
                 )}
             </div>


            {/* Back to Dashboard Button */}
             <button onClick={() => navigate('/dashboard')} style={{ marginTop: '20px', marginRight: '10px', padding: '10px 20px', cursor: 'pointer' }}>
                Back to Dashboard
            </button>

            {/* Logout */}
             <button onClick={handleLogout} style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '5px' }}>
                Logout
            </button>
        </div>
    );
}

export default ProfilePage;

