import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTE_PERMISSIONS, hasRouteAccess } from '../config/permissions';
import AccessDenied from './AccessDenied';

export default function RoleRoute({ allowedRoles, children }) {
  const { role, isAdmin } = useAuth();
  const location = useLocation();

  // Admin always has unrestricted access
  if (isAdmin || role === 'ADMIN') {
    return children;
  }

  // If explicit allowedRoles is provided, check against it
  if (allowedRoles && Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    if (allowedRoles.includes(role)) {
      return children;
    }
    return (
      <AccessDenied 
        requiredRole={allowedRoles.join(' / ')} 
        currentRole={role} 
      />
    );
  }

  // Otherwise check route against ROUTE_PERMISSIONS
  const currentPath = location.pathname.replace(/\/$/, '') || '/';
  if (hasRouteAccess(role, currentPath)) {
    return children;
  }

  const configuredRoles = ROUTE_PERMISSIONS[currentPath] || [];
  return (
    <AccessDenied 
      requiredRole={configuredRoles.length > 0 ? configuredRoles.join(' / ') : 'Restricted'} 
      currentRole={role} 
    />
  );
}

