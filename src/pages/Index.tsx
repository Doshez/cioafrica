import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to dashboard if user is logged in
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return null;
};

export default Index;
