// frontend/src/pages/SocietyDetailPage.js
import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom'; // Import Link
import { useTheme } from '../contexts/ThemeContext'; // Import useTheme
import '../App.css'; // Import the central CSS file


function SocietyDetailPage() {
    const { societyId } = useParams(); // Get the society ID from the URL
    const [society, setSociety] = useState(null);
    const [serviceCategories, setServiceCategories] = useState([]); // State for service categories with counts
    const [selectedCategoryId, setSelectedCategoryId] = useState(null); // State for the currently selected category ID
    const [serviceProviders, setServiceProviders] = useState([]); // State for service providers in the selected category

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { theme } = useTheme(); // Use the theme context


    // --- Fetch Society Details and Service Categories ---
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');

        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            setError('Authentication token not found. Please login.');
            // Redirect to resident login as this page is primarily for residents
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
            console.log(`SocietyDetailPage: Attempting to fetch details for society ID: ${societyId}`);
            // Fetch Society Details
            const societyResponse = await axios.get(`http://${backendIp}:${backendPort}/api/societies/${societyId}/`, { headers });
            console.log("SocietyDetailPage: Society details fetched:", societyResponse.data);
            setSociety(societyResponse.data);

            console.log(`SocietyDetailPage: Attempting to fetch service categories with counts for society ID: ${societyId}`);
            // Fetch Service Categories with counts for this society using the new endpoint
            const categoriesResponse = await axios.get(`http://${backendIp}:${backendPort}/api/societies/${societyId}/service-categories-with-counts/`, { headers });
            console.log("SocietyDetailPage: Service categories with counts fetched:", categoriesResponse.data);
            setServiceCategories(categoriesResponse.data);


        } catch (err) {
            console.error("SocietyDetailPage: Error fetching data:", err.response ? err.response.data : err.message);
            let errorMessage = 'Failed to fetch society details or service categories.';
            if (err.response && err.response.data && err.response.data.detail) {
                errorMessage = `Error: ${err.response.data.detail}`;
            } else if (err.response && err.response.status === 404) {
                 errorMessage = "Society not found.";
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
    }, [societyId, navigate]); // Depend on societyId and navigate


    // --- Fetch Service Providers for a Selected Category ---
    const fetchServiceProvidersForCategory = useCallback(async (categoryId) => {
        setLoading(true);
        setError('');
        setServiceProviders([]); // Clear previous providers

        const authToken = localStorage.getItem('authToken');
         if (!authToken) {
            setError('Authentication token not found. Please login.');
            setLoading(false);
            navigate('/login?role=resident');
            return;
        }

        const headers = {
            Authorization: `Token ${authToken}`,
        };

         const backendIp = '127.0.0.1'; // <-- Update this for your testing/deployment environment
         const backendPort = '8000';
        const apiUrl = `http://${backendIp}:${backendPort}/api/societies/${societyId}/service-providers/?service_id=${categoryId}`; // Corrected IP address

        try {
            console.log(`SocietyDetailPage: Attempting to fetch service providers from URL: ${apiUrl}`); // Log the full URL
            const providersResponse = await axios.get(apiUrl, { headers });
            console.log("SocietyDetailPage: Service providers for category fetched successfully:", providersResponse.data); // Log successful response
            setServiceProviders(providersResponse.data);

        } catch (err) {
            console.error("SocietyDetailPage: Error fetching service providers:", err.response ? err.response.data : err.message);
            let errorMessage = 'Failed to fetch service providers for this category.';
            if (err.response && err.response.data && err.response.data.detail) {
                errorMessage = `Error: ${err.response.data.detail}`;
            } else if (err.response && err.response.status === 404) {
                 errorMessage = "Service providers not found for this category/society combination."; // More specific message
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
    }, [societyId, navigate]); // Depend on societyId and navigate


    useEffect(() => {
        fetchData(); // Fetch initial data (society details and categories)
    }, [fetchData]); // Depend on fetchData


    // --- Handle Category Click ---
    const handleCategoryClick = (categoryId) => {
        setSelectedCategoryId(categoryId); // Set the selected category
        fetchServiceProvidersForCategory(categoryId); // Fetch providers for this category
    };


     // --- Handle Logout ---
    const handleLogout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        localStorage.removeItem('userRole');
        console.log("SocietyDetailPage: User logged out. Clearing local storage.");
        navigate('/'); // Redirect to homepage
    };

    // --- Function to render clickable phone number ---
    const renderClickablePhoneNumber = (phoneNumber) => {
        if (!phoneNumber) {
            return 'N/A';
        }
        // Basic check for a phone number format (you might need a more robust regex)
        const isPhoneNumber = /^\+?(\d.*){3,}$/.test(phoneNumber); // Simple regex for at least 3 digits, optional +
        if (isPhoneNumber) {
            return <a href={`tel:${phoneNumber}`} className="app-link">{phoneNumber}</a>; // Use app-link class
        }
        return phoneNumber; // Return as plain text if not a phone number
    };


    if (loading && !society && !serviceCategories.length) {
        return <div className={`page-container page-society-detail ${theme === 'dark' ? 'dark' : 'light'}`}>Loading Society Details...</div>;
    }

    if (error && !society) { // Only show error if initial society data failed to load
        return <div className={`page-container page-society-detail ${theme === 'dark' ? 'dark' : 'light'}`} style={{ color: 'red' }}>Error: {error}</div>;
    }

    if (!society) {
        return <div className={`page-container page-society-detail ${theme === 'dark' ? 'dark' : 'light'}`}>Society not found.</div>;
    }

    return (
        <div className={`page-container page-society-detail ${theme === 'dark' ? 'dark' : 'light'}`}> {/* Use page-container, page-society-detail, and theme class */}
            <div className="card" style={{ maxWidth: '600px' }}> {/* Use card class, increase max-width */}
                <h2 className="heading-medium">Society Details: {society.name}</h2> {/* Use heading-medium class */}

                <div style={{ marginBottom: '2rem', textAlign: 'left' }}> {/* Added margin and left align */}
                    <h3 className="heading-small" style={{ marginBottom: '1rem' }}>Information</h3> {/* Use heading-small */}
                    <p><strong>Name:</strong> {society.name}</p>
                    <p><strong>Address:</strong> {society.address}</p>
                    <p><strong>Residents:</strong> {society.resident_count !== undefined ? society.resident_count : 'Loading...'}</p>
                    {/* Add other society details here if available in the serializer */}
                </div>

                {/* --- Service Categories Section --- */}
                 <div style={{ marginBottom: '2rem', textAlign: 'left' }}> {/* Added margin and left align */}
                     <h3 className="heading-small" style={{ marginBottom: '1rem' }}>Available Service Categories</h3> {/* Use heading-small */}
                      {loading && !serviceCategories.length > 0 ? (
                         <p>Loading service categories...</p>
                     ) : serviceCategories.length > 0 ? (
                         <ul style={{ listStyle: 'none', padding: 0 }}>
                             {serviceCategories.map(category => (
                                 <li
                                     key={category.id}
                                     onClick={() => handleCategoryClick(category.id)} // Add click handler
                                     className={`list-item ${selectedCategoryId === category.id ? 'list-item-selected' : ''}`} // Use list-item and list-item-selected classes
                                 >
                                     {/* You can add an icon/symbol here if you have them */}
                                     {/* <span className="service-icon">ICON</span> */}
                                     {category.name} ({category.approved_provider_count})
                                 </li>
                             ))}
                         </ul>
                     ) : (
                         !loading && <p>No service categories with approved providers found for this society.</p>
                     )}
                 </div>


                {/* --- Service Providers for Selected Category Section --- */}
                 {selectedCategoryId !== null && ( // Only show this section if a category is selected
                     <div style={{ textAlign: 'left' }}> {/* Left align */}
                         <h3 className="heading-small" style={{ marginBottom: '1rem' }}>Service Providers in Selected Category</h3> {/* Use heading-small */}
                          {loading && !serviceProviders.length > 0 ? (
                             <p>Loading service providers...</p>
                         ) : serviceProviders.length > 0 ? (
                             <ul style={{ listStyle: 'none', padding: 0 }}>
                                 {serviceProviders.map(provider => (
                                     <li key={provider.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '10px' }}> {/* Use var(--border-color) */}
                                         <p><strong>Provider Name:</strong> {provider.name}</p>
                                          <p><strong>Contact Info:</strong> {renderClickablePhoneNumber(provider.contact_info)}</p> {/* Use the render function */}
                                           <p><strong>Brief Note:</strong> {provider.brief_note || 'N/A'}</p>
                                          {/* Display services offered by this provider (optional, as they are already filtered by category) */}
                                          {/* <p>
                                              <strong>Services Offered:</strong>{' '}
                                              {provider.services && provider.services.length > 0 ? (
                                                  provider.services.map((service, index) => (
                                                      <span key={service.id}>
                                                          {service.name}{index < provider.services.length - 1 ? ', ' : ''}
                                                      </span>
                                                  ))
                                              ) : (
                                                  'No services listed.'
                                              )}
                                          </p> */}
                                         {/* Add other provider details here */}
                                     </li>
                                 ))}
                             </ul>
                         ) : (
                             !loading && <p>No approved service providers found in this category for this society.</p>
                         )}
                     </div>
                 )}


                {/* Back Button */}
                <Link to="/dashboard" className="btn btn-primary" style={{ marginTop: '2rem', marginRight: '10px' }}> {/* Use btn and btn-primary, add margin */}
                    <span>Back to Dashboard</span> {/* Wrap text in span */}
                </Link>

                {/* Logout Button */}
                 <button onClick={handleLogout} className="btn btn-primary" style={{ marginTop: '2rem', backgroundColor: '#f44336' }}> {/* Use btn and btn-primary, override color */}
                    <span>Logout</span> {/* Wrap text in span */}
                </button>
            </div>
        </div>
    );
}

export default SocietyDetailPage;

