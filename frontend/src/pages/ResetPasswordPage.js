// frontend/src/pages/ResetPasswordPage.js
import React, { useState, useEffect } from 'react'; // Import useState and useEffect
import axios from 'axios';
// Import Link, useNavigate, and useSearchParams
import { Link, useNavigate, useSearchParams } from 'react-router-dom'; // <-- Import useSearchParams

function ResetPasswordPage() {
  // Get identifier and potentially OTP from URL params if you structure your flow this way
  // For this example, we'll ask the user to enter identifier and OTP again.
  // If your backend sends an email/SMS with a link like /reset/:identifier/:otp_code,
  // you would use useParams to get them directly.
  // const { identifier: identifierFromUrl, otp_code: otpFromUrl } = useParams();

  // Use useSearchParams to get query parameters like email=... or identifier=... and otp_secret=...
  const [searchParams] = useSearchParams(); // <-- Use useSearchParams hook
  const identifierFromUrl = searchParams.get('identifier');
  const otpFromUrl = searchParams.get('otp_secret');


  const [formData, setFormData] = useState({
    identifier: identifierFromUrl || '', // Phone number or email (pre-fill if in URL)
    otp_code: otpFromUrl || '', // OTP code (pre-fill if in URL)
    new_password: '',
    new_password2: '', // For confirm new password
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  // State for general error messages
  const [error, setError] = useState(''); // <-- Declare error state here


  const navigate = useNavigate();

   // Optional: If getting identifier/OTP from URL, populate state on mount
   // This is now handled during useState initialization using searchParams
   // useEffect(() => {
   //   if(identifierFromUrl && otpFromUrl) {
   //      setFormData(prevData => ({
   //          ...prevData,
   //          identifier: identifierFromUrl,
   //          otp_code: otpFromUrl,
   //      }));
   //   }
   // }, [identifierFromUrl, otpFromUrl]);


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
     // Clear errors and messages on input change
     setErrors({});
     setMessage('');
     setError(''); // Clear general error state
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({}); // Clear previous errors
    setMessage(''); // Clear previous messages
    setError(''); // Clear general error state


    if (formData.new_password !== formData.new_password2) {
      setError('New passwords do not match.'); // Use setError
      return;
    }

     // Basic validation for required fields before sending
     if (!formData.identifier || !formData.otp_code || !formData.new_password || !formData.new_password2) {
         setError('Please fill in all required fields.'); // Use setError
         return;
     }


    try {
      // Prepare data to send to the backend API
      const dataToSend = {
        identifier: formData.identifier, // Send identifier (email or phone)
        otp_secret: formData.otp_code, // Send the entered OTP code
        new_password: formData.new_password, // Send the new password
        // Note: The backend serializer should handle password confirmation
      };

      console.log("Reset Password: Sending data:", dataToSend);

      // Send the password reset confirmation data to the backend API
      // Assuming the endpoint is /api/password-reset/confirm/
      const response = await axios.post('http://127.0.0.1:8000/api/password-reset/confirm/', dataToSend);

      console.log("Reset Password: Password reset successful:", response.data);

      // Handle successful password reset response
      let successMessage = response.data.detail || 'Password reset successful. Please login.';
      setMessage(successMessage);

      // Optionally redirect to the login page after a short delay
       setTimeout(() => {
           // You might want to redirect to the general login page or a role-specific one
           navigate('/login'); // Redirect to the main login page
       }, 2000); // Redirect after 2 seconds


    } catch (err) {
      console.error("Reset Password: Error during password reset:", err.response ? err.response.data : err.message);
       let errorMessage = 'Password reset failed.';

       // Handle backend validation errors or other error responses
       if (err.response && err.response.data) {
           const backendErrors = err.response.data;
            // Check for specific field errors from the serializer
            if (backendErrors.identifier) {
                 setErrors(prevErrors => ({ ...prevErrors, identifier: backendErrors.identifier }));
             }
             if (backendErrors.otp_secret) {
                 setErrors(prevErrors => ({ ...prevErrors, otp_secret: backendErrors.otp_secret }));
             }
             if (backendErrors.new_password) {
                 setErrors(prevErrors => ({ ...prevErrors, new_password: backendErrors.new_password }));
             }
             // Handle non-field errors
             if (backendErrors.non_field_errors) {
                 setErrors(prevErrors => ({ ...prevErrors, non_field_errors: backendErrors.non_field_errors }));
             }
             // Handle general detail errors
             if (backendErrors.detail) {
                 setError(`Error: ${backendErrors.detail}`); // Use setError for general errors
             }
             // Fallback for other backend error structures
            if (Object.keys(backendErrors).length === 0 || (Object.keys(backendErrors).length === 1 && backendErrors.detail)) {
                 // If no specific field errors were set, use a generic message or the detail error
                 setError(backendErrors.detail || 'An unexpected error occurred on the backend.');
             } else {
                 // If field errors were set, the user will see them next to the fields.
                 // You might still want a general message indicating failure.
                 setMessage('Password reset failed. Please check the errors above.');
             }

       } else if (err.request) {
           // Handle network errors
           setError('Network Error: Could not connect to the server.'); // Use setError
       } else {
            // Handle other request errors
            setError('Request Error: ' + err.message); // Use setError
       }
      setMessage(''); // Clear success message on error
    }
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h2>Reset Password</h2>
      {/* Display general error and message */}
      {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>} {/* Use error state */}
      {message && <div style={{ color: message.includes('successful') ? 'green' : 'red', marginBottom: '15px' }}>{message}</div>} {/* Use message state */}


      <form onSubmit={handleSubmit} style={{ display: 'inline-block', textAlign: 'left', border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
        {/* Identifier Field (Phone or Email) */}
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="identifier" style={{ display: 'block', marginBottom: '5px' }}>Phone Number or Email:</label>
          <input
            type="text"
            id="identifier"
            name="identifier"
            value={formData.identifier}
            onChange={handleInputChange}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
             // Disable if identifier is pre-filled from URL
             readOnly={!!identifierFromUrl}
          />
           {errors.identifier && <div style={{ color: 'red', fontSize: '0.9em' }}>{errors.identifier.join(' ')}</div>}
        </div>
        {/* OTP Code Field */}
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="otp_code" style={{ display: 'block', marginBottom: '5px' }}>OTP Code:</label>
          <input
            type="text" // OTP is usually text or number
            id="otp_code"
            name="otp_code"
            value={formData.otp_code}
            onChange={handleInputChange}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
             // Disable if OTP is pre-filled from URL
             readOnly={!!otpFromUrl}
          />
           {errors.otp_code && <div style={{ color: 'red', fontSize: '0.9em' }}>{errors.otp_code.join(' ')}</div>}
        </div>
        {/* New Password Field */}
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="new_password" style={{ display: 'block', marginBottom: '5px' }}>New Password:</label>
          <input
            type="password"
            id="new_password"
            name="new_password"
            value={formData.new_password}
            onChange={handleInputChange}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
           {errors.new_password && <div style={{ color: 'red', fontSize: '0.9em' }}>{errors.new_password.join(' ')}</div>}
        </div>
         {/* Confirm New Password Field */}
         <div style={{ marginBottom: '15px' }}>
          <label htmlFor="new_password2" style={{ display: 'block', marginBottom: '5px' }}>Confirm New Password:</label>
          <input
            type="password"
            id="new_password2"
            name="new_password2"
            value={formData.new_password2}
            onChange={handleInputChange}
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
           {/* Backend serializer should handle password confirmation, but you can add frontend validation too */}
        </div>

        {/* General errors */}
        {errors.non_field_errors && <div style={{ color: 'red', fontSize: '0.9em', marginTop: '10px' }}>{errors.non_field_errors.join(' ')}</div>}


        <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' }}>
          Reset Password
        </button>
      </form>
       <p style={{ marginTop: '20px' }}>
        Remember your password? <Link to="/login">Login here</Link> {/* Link back to login */}
      </p>
    </div>
  );
}

export default ResetPasswordPage;

