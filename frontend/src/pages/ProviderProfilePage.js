// frontend/src/pages/ProviderProfilePage.js
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function ProviderProfilePage() {
    const [providerProfile, setProviderProfile] = useState(null); // For provider profile
     const [editFormData, setEditFormData] = useState({ // State for editing form
        name: '',
        contact_info: '',
        brief_note: '',
        service_ids: [], // Assuming services are edited by ID list
        // Add other editable fields here if needed
    });
    const [allServices, setAllServices] = useState([]); // To display available services for selection
    const [isEditing, setIsEditing] = useState(false); // State to toggle edit mode

    const [initiatedRequests, setInitiatedRequests] = useState([]); // For initiated requests (provider listing requests)
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState(''); // For success messages
    const navigate = useNavigate();

     const userRole = localStorage.getItem('userRole'); // Get user role from local storage


    // --- Fetch Data (Profile, Initiated Requests, All Services) ---
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        setMessage(''); // Clear messages on new fetch

        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            setError('Authentication token not found. Please login.');
            navigate('/provider-login'); // Redirect to provider login if no token
            setLoading(false);
            return;
        }

        const headers = {
            Authorization: `Token ${authToken}`,
        };

        try {
             if (userRole === 'provider') {
                console.log("ProviderProfilePage: Fetching provider profile...");
                // Fetch Service Provider Profile
                const providerProfileResponse = await axios.get('http://127.0.0.1:8000/api/service-provider-profile/', { headers });
                console.log("ProviderProfilePage: Provider Profile fetched:", providerProfileResponse.data);
                setProviderProfile(providerProfileResponse.data);
                 // Initialize edit form data with current profile data
                 setEditFormData({
                    name: providerProfileResponse.data.name || '',
                    contact_info: providerProfileResponse.data.contact_info || '',
                    brief_note: providerProfileResponse.data.brief_note || '',
                     // Map current services to an array of IDs for the form
                    service_ids: providerProfileResponse.data.services ? providerProfileResponse.data.services.map(service => service.id) : [],
                     // Initialize other editable fields here
                 });


                console.log("ProviderProfilePage: Fetching initiated requests for provider...");
                // Fetch initiated voting requests (filtered for provider listing requests)
                const requestsResponse = await axios.get('http://127.0.0.1:8000/api/my-initiated-voting-requests/', { headers });
                // Filter for provider_list requests if needed (backend should handle this based on initiated_by)
                const providerListingRequests = requestsResponse.data.filter(req => req.request_type === 'provider_list');
                console.log("ProviderProfilePage: Initiated provider listing requests fetched:", providerListingRequests);
                setInitiatedRequests(providerListingRequests);

                 console.log("ProviderProfilePage: Fetching all services...");
                 // Fetch all services to populate the service selection for editing
                 const servicesResponse = await axios.get('http://127.0.0.1:8000/api/services/', { headers }); // Assuming services endpoint is protected
                 console.log("ProviderProfilePage: All services fetched:", servicesResponse.data);
                 setAllServices(servicesResponse.data);


             } else if (userRole === 'resident') {
                 // This page is now specifically for Provider Profile.
                 // Resident profile is handled by ProfilePage.js
                 // If a resident somehow lands here, redirect them to their correct profile page.
                 console.warn("ProviderProfilePage: Resident user attempted to access Provider Profile Page. Redirecting.");
                 navigate('/profile');
                 setLoading(false);
                 return;

             } else {
                 setError('Unknown user role.');
             }


        } catch (err) {
            console.error("ProviderProfilePage: Error fetching data:", err.response ? err.response.data : err.message);
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
                navigate('/provider-login'); // Redirect to provider login on error
            }
        } finally {
            setLoading(false);
        }
    }, [navigate, userRole]);


    useEffect(() => {
         // Only fetch data if the user is a provider
        if (userRole === 'provider') {
            fetchData(); // Fetch data when the component mounts or userRole changes
        }
    }, [fetchData, userRole]);


    // --- Handle Input Change for Edit Form ---
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setEditFormData({
            ...editFormData,
            [name]: value,
        });
    };

    // --- Handle Service Selection Change ---
    const handleServiceChange = (e) => {
        const selectedOptions = Array.from(e.target.selectedOptions).map(option => parseInt(option.value));
        setEditFormData({
            ...editFormData,
            service_ids: selectedOptions,
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
            navigate('/provider-login');
            return;
        }

        const headers = {
            Authorization: `Token ${authToken}`,
            'Content-Type': 'application/json',
        };

        // Prepare data to send - use the structure expected by ServiceProviderSelfManageSerializer
        const dataToSend = {
            name: editFormData.name,
            contact_info: editFormData.contact_info,
            brief_note: editFormData.brief_note,
            services: editFormData.service_ids, // Send array of service IDs
            // Include other editable fields here
        };


        try {
            console.log("ProviderProfilePage: Attempting to update provider profile...");
            // Send PATCH request to update the provider profile
            const response = await axios.patch('http://127.0.0.1:8000/api/service-provider-profile/', dataToSend, { headers });
            console.log("ProviderProfilePage: Profile updated successfully:", response.data);
            setProviderProfile(response.data); // Update the displayed profile data
            setMessage('Profile updated successfully!');
            setIsEditing(false); // Exit edit mode

        } catch (err) {
            console.error("ProviderProfilePage: Error updating profile:", err.response ? err.response.data : err.message);
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
        console.log("ProviderProfilePage: User logged out. Clearing local storage.");
        navigate('/'); // Redirect to homepage
    };


     // If user is not a provider, don't render this page content
    if (userRole !== 'provider') {
        return null; // Or render a message indicating incorrect role
    }


    if (loading && !providerProfile && !initiatedRequests.length) {
        return <div style={{ textAlign: 'center', marginTop: '50px' }}>Loading Provider Profile...</div>;
    }

    if (error) {
        return <div style={{ textAlign: 'center', marginTop: '50px', color: 'red' }}>Error: {error}</div>;
    }

    return (
        <div style={{ textAlign: 'center', marginTop: '50px' }}>
            <h2>Service Provider Profile</h2>

            {message && <div style={{ color: 'green', marginBottom: '15px' }}>{message}</div>}
            {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}


             {/* Display Service Provider Profile Info or Edit Form */}
            {providerProfile && (
                <div style={{ marginBottom: '30px', border: '1px solid #ccc', padding: '15px', borderRadius: '8px', display: 'inline-block', textAlign: 'left', minWidth: '300px' }}>
                    <h3>Your Details</h3>
                     {!isEditing ? (
                         <>
                            <p><strong>Username:</strong> {providerProfile.user ? providerProfile.user.username : 'N/A'}</p>
                            <p><strong>Email:</strong> {providerProfile.user ? providerProfile.user.email : 'N/A'}</p>
                            <p><strong>Provider Name:</strong> {providerProfile.name || 'N/A'}</p>
                            <p><strong>Contact Info:</strong> {providerProfile.contact_info || 'N/A'}</p>
                            <p><strong>Brief Note:</strong> {providerProfile.brief_note || 'N/A'}</p>
                            <p>
                                <strong>Associated Societies:</strong>{' '}
                                {providerProfile.societies && providerProfile.societies.length > 0 ? (
                                    providerProfile.societies.map((society, index) => (
                                        <span key={society.id}>
                                            {society.name}{index < providerProfile.societies.length - 1 ? ', ' : ''}
                                        </span>
                                    ))
                                ) : (
                                    'Not associated with any society yet.'
                                )}
                            </p>
                            <p>
                                <strong>Services Offered:</strong>{' '}
                                {providerProfile.services && providerProfile.services.length > 0 ? (
                                    providerProfile.services.map((service, index) => (
                                        <span key={service.id}>
                                            {service.name}{index < providerProfile.services.length - 1 ? ', ' : ''}
                                        </span>
                                    ))
                                ) : (
                                    'No services listed.'
                                )}
                            </p>
                            {providerProfile.is_approved !== undefined && (
                                <p><strong>Overall Approval Status:</strong> {providerProfile.is_approved ? 'Approved' : 'Pending Approval'}</p>
                            )}
                            <button onClick={() => setIsEditing(true)} style={{ marginTop: '10px' }}>Edit Profile</button>
                         </>
                     ) : (
                         <form onSubmit={handleUpdateProfile}>
                             {/* Display non-editable fields */}
                              <p><strong>Username:</strong> {providerProfile.user ? providerProfile.user.username : 'N/A'}</p>
                              <p><strong>Email:</strong> {providerProfile.user ? providerProfile.user.email : 'N/A'}</p>

                             {/* Editable fields */}
                             <div style={{ marginTop: '10px' }}>
                                 <label htmlFor="name">Provider Name:</label>
                                 <input
                                     type="text"
                                     id="name"
                                     name="name"
                                     value={editFormData.name}
                                     onChange={handleInputChange}
                                     required
                                 />
                             </div>
                             <div style={{ marginTop: '10px' }}>
                                 <label htmlFor="contact_info">Contact Info:</label>
                                 <input
                                     type="text"
                                     id="contact_info"
                                     name="contact_info"
                                     value={editFormData.contact_info}
                                     onChange={handleInputChange}
                                 />
                             </div>
                             <div style={{ marginTop: '10px' }}>
                                 <label htmlFor="brief_note">Brief Note:</label>
                                 <textarea
                                     id="brief_note"
                                     name="brief_note"
                                     value={editFormData.brief_note}
                                     onChange={handleInputChange}
                                     rows="4" // Adjust rows as needed
                                     style={{ width: '100%', marginTop: '5px' }}
                                 />
                             </div>

                             {/* Services Selection */}
                             <div style={{ marginTop: '10px' }}>
                                 <label htmlFor="services">Services Offered:</label>
                                  {/* Use a select with multiple attribute for selecting services */}
                                 <select
                                     id="services"
                                     name="services"
                                     multiple // Allow multiple selections
                                     value={editFormData.service_ids}
                                     onChange={handleServiceChange}
                                     style={{ width: '100%', marginTop: '5px', minHeight: '100px' }} // Adjust height as needed
                                 >
                                     {allServices.map(service => (
                                         <option key={service.id} value={service.id}>{service.name}</option>
                                     ))}
                                 </select>
                             </div>


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


            {/* --- My Initiated Voting Requests Section (Provider Listing Requests) --- */}
             <div style={{ marginTop: '20px', border: '1px solid #ccc', padding: '15px', borderRadius: '8px', display: 'inline-block', textAlign: 'left', minWidth: '300px' }}>
                 <h3>My Service Listing Requests</h3>
                  {loading && !initiatedRequests.length > 0 ? (
                     <p>Loading initiated requests...</p>
                 ) : initiatedRequests.length > 0 ? (
                     <ul style={{ listStyle: 'none', padding: 0 }}>
                         {initiatedRequests.map(request => (
                             <li key={request.id} style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '10px' }}>
                                 <p><strong>Request Type:</strong> {request.request_type_display}</p>
                                  {/* Display details based on request type */}
                                  {/* Ensure service_provider and its properties are accessed safely */}
                                 {request.request_type === 'provider_list' && request.service_provider && (
                                     <>
                                        <p>Listing Provider: {request.service_provider.name || 'N/A'}</p>
                                         {/* Display services offered by the provider in the request */}
                                         {request.service_provider.services && request.service_provider.services.length > 0 && (
                                             <p>
                                                 Services Offered:{' '}
                                                 {request.service_provider.services.map((service, index) => (
                                                     <span key={service.id}>
                                                         {service.name}{index < request.service_provider.services.length - 1 ? ', ' : ''}
                                                     </span>
                                                 ))}
                                             </p>
                                         )}
                                     </>
                                 )}
                                  {request.society && request.society.name && (
                                     <p>For Society: {request.society.name}</p>
                                 )}
                                  {request.status_display && (
                                       <p><strong>Status:</strong> {request.status_display}</p>
                                  )}
                                 <p>Expires: {new Date(request.expiry_time).toLocaleString()}</p>
                                 {request.approved_votes_count !== undefined && request.rejected_votes_count !== undefined && (
                                     <p>Votes: {request.approved_votes_count} Approved, {request.rejected_votes_count} Rejected</p>
                                 )}
                             </li>
                         ))}
                     </ul>
                 ) : (
                     !loading && <p>You have not initiated any service listing requests.</p>
                 )}
             </div>


            {/* Back to Dashboard Button */}
             <button onClick={() => navigate('/provider-dashboard')} style={{ marginTop: '20px', marginRight: '10px', padding: '10px 20px', cursor: 'pointer' }}>
                Back to Dashboard
            </button>

            {/* Logout */}
             <button onClick={handleLogout} style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '5px' }}>
                Logout
            </button>
        </div>
    );
}

export default ProviderProfilePage;

