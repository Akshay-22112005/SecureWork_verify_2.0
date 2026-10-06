import React from 'react';
import { useAuth } from '../context/AuthContext';
import AccessDenied from './AccessDenied';

export default function RoleRoute({ allowedRoles = [], children }) {
  const { role, isAdmin } = useAuth();

  // Admin always has superuser access
  if (isAdmin || allowedRoles.includes(role)) {
    return children;
  }

  return (
    <AccessDenied 
      requiredRole={allowedRoles.join(' / ')} 
      currentRole={role} 
    />
  );
}
