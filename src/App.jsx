// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import AdminDashboard from './AdminDashboard';
import Formulario from './Formulario';
import MenuSelector from './components/MenuSelector';
import CierreSemanalPage from './components/CierreSemanalPage';
import EditarUsuario from './components/EditarUsuario';
import ProtectedRoute from './ProtectedRoute';
import AutoRedirect from './components/AutoRedirect';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={
            <>
              <AutoRedirect />
              <Login />
            </>
          } />
          <Route path="/admin" element={
            <ProtectedRoute requireAdmin={true}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/cierre-semanal" element={
            <ProtectedRoute requireAdmin={true}>
              <CierreSemanalPage />
            </ProtectedRoute>
          } />
          <Route path="/menu" element={
            <ProtectedRoute requireAdmin={false}>
              <MenuSelector />
            </ProtectedRoute>
          } />
          <Route path="/menu/actual" element={
            <ProtectedRoute requireAdmin={false}>
              <Formulario tipo="actual" />
            </ProtectedRoute>
          } />
          <Route path="/menu/proxima" element={
            <ProtectedRoute requireAdmin={false}>
              <Formulario tipo="proxima" />
            </ProtectedRoute>
          } />
          <Route path="/menu/editar-usuario" element={
            <ProtectedRoute requireAdmin={false}>
              <EditarUsuario />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
