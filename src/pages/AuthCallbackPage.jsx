import React, { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../ui/Spinner';

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  
  useEffect(() => {
    const token = searchParams.get('token');
    
    if (token) {
      login(token)
        .then(() => {
          navigate('/dashboard', { replace: true });
        })
        .catch(() => {
          toast.error("Google login failed. Please try again.");
          navigate('/login', { replace: true });
        });
    } else {
      toast.error("Google login failed. Please try again.");
      navigate('/login', { replace: true });
    }
  }, [searchParams, login, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <Spinner size="lg" />
      <p className="mt-4 text-gray-500 font-medium">Logging you in...</p>
    </div>
  );
}
