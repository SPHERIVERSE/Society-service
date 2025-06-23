// frontend/src/components/ProtectedRoute.js
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

// ProtectedRoute component to guard routes based on authentication and user role
// allowedRoles is an array of strings, e.g., ['resident', 'provider']
function ProtectedRoute({ allowedRoles }) {
    // Retrieve authentication token and user role from local storage
    const authToken = localStorage.getItem('authToken');
    const userRole = localStorage.getItem('userRole'); // Get the stored user role

    console.log(`ProtectedRoute: Checking access. Token: ${authToken ? 'Exists' : 'None'}, Role: ${userRole}, Allowed Roles: ${allowedRoles}`);

    // Check if the user is authenticated (token exists)
    if (!authToken) {
        console.log("ProtectedRoute: No auth token found. Redirecting to login.");
        // If not authenticated, redirect to the login page
        // You might want to pass the current location to redirect back after login
        return <Navigate to="/login" replace />;
    }

    // If allowedRoles are specified, check if the user's role is in the allowed list
    if (allowedRoles && allowedRoles.length > 0) {
        // Check if the userRole is included in the allowedRoles array
        // Ensure the role stored matches the role being checked against
        const isRoleAllowed = allowedRoles.includes(userRole); // Use the stored userRole

        if (!isRoleAllowed) {
            console.warn(`ProtectedRoute: User with role '${userRole}' attempted to access a route allowed for roles: ${allowedRoles}. Redirecting.`);
            // If the role is not allowed, redirect to a forbidden page or the dashboard
            // Redirecting to the appropriate dashboard based on role might be better
            if (userRole === 'resident') {
                 return <Navigate to="/dashboard" replace />;
            } else if (userRole === 'provider') { // Check for 'provider' role
                 return <Navigate to="/provider-dashboard" replace />;
            } else {
                // Default redirect if role is unknown or no specific dashboard
                 return <Navigate to="/" replace />; // Redirect to home or a general forbidden page
            }
        }
         console.log(`ProtectedRoute: Access granted for user with role '${userRole}' to route allowed for roles: ${allowedRoles}`);
    } else {
         // If no specific allowedRoles are provided, just check for authentication
         console.log("ProtectedRoute: No specific roles required, only authentication. Access granted.");
    }


    // If authenticated and role is allowed (or no specific roles required), render the child routes
    return <Outlet />;
}

export default ProtectedRoute;

