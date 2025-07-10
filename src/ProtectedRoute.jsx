import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import Spinner from './components/Spinner';

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // Si estamos creando un usuario, no procesar cambios de autenticación
      if (window.isCreatingUser) {
        return;
      }
      
      if (user) {
        setUser(user);
        
        // Verificar rol del usuario en Firestore
        try {
          const emailQuery = query(
            collection(db, "users"),
            where("email", "==", user.email)
          );
          const emailSnapshot = await getDocs(emailQuery);
          
          if (!emailSnapshot.empty) {
            const userData = emailSnapshot.docs[0].data();
            setUserRole(userData.rol);
          } else {
            setUserRole('usuario');
          }
        } catch (error) {
          console.error('Error al obtener rol del usuario:', error);
          setUserRole('usuario');
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#222220',
        color: '#ffffff'
      }}>
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (requireAdmin && userRole !== 'admin') {
    return <Navigate to="/menu" replace />;
  }

  // Si NO requiere admin (rutas de usuario) y el usuario ES admin, redirigir a admin
  if (!requireAdmin && userRole === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return children;
};

export default ProtectedRoute;
