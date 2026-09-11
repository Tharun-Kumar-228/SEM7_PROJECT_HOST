import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient, { setAuthToken } from '../api/client';

const AuthContext = createContext();
const AUTH_TOKEN_KEY = 'NEUROSCREEN_AUTH_TOKEN';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'PARENT' | 'TEACHER'
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState(null);

  // Restore session on app launch
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const storedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        if (storedToken) {
          setAuthToken(storedToken);
          const response = await apiClient.get('/auth/me');
          if (response.data?.data?.user) {
            const userData = response.data.data.user;
            setToken(storedToken);
            setUser(userData);
            setRole(userData.role);
          } else {
            await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
            setAuthToken(null);
          }
        }
      } catch (err) {
        console.log('[AuthContext] Session restore notice:', err.message);
        await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
        setAuthToken(null);
      } finally {
        setIsInitializing(false);
      }
    };

    restoreSession();
  }, []);

  const loginParentOtp = async (phone) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/send-otp', { phone });
      setLoading(false);
      return response.data;
    } catch (err) {
      setLoading(false);
      const msg = err.response?.data?.error?.message || 'Failed to send OTP';
      setError(msg);
      throw new Error(msg);
    }
  };

  const verifyParentOtp = async (phone, otpCode, parentName) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/verify-otp', { phone, otpCode, parentName });
      const { token: userToken, user: userData } = response.data.data;
      setToken(userToken);
      setUser(userData);
      setRole('PARENT');
      setAuthToken(userToken);
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, userToken);
      setLoading(false);
      return userData;
    } catch (err) {
      setLoading(false);
      const msg = err.response?.data?.error?.message || 'Invalid OTP verification';
      setError(msg);
      throw new Error(msg);
    }
  };

  const registerTeacher = async (name, email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/teacher/register', { name, email, password });
      const { token: userToken, user: userData } = response.data.data;
      setToken(userToken);
      setUser(userData);
      setRole('TEACHER');
      setAuthToken(userToken);
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, userToken);
      setLoading(false);
      return userData;
    } catch (err) {
      setLoading(false);
      const msg = err.response?.data?.error?.message || 'Teacher registration failed';
      setError(msg);
      throw new Error(msg);
    }
  };

  const loginTeacher = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/teacher/login', { email, password });
      const { token: userToken, user: userData } = response.data.data;
      setToken(userToken);
      setUser(userData);
      setRole('TEACHER');
      setAuthToken(userToken);
      await AsyncStorage.setItem(AUTH_TOKEN_KEY, userToken);
      setLoading(false);
      return userData;
    } catch (err) {
      setLoading(false);
      const msg = err.response?.data?.error?.message || 'Teacher login failed';
      setError(msg);
      throw new Error(msg);
    }
  };

  const forgotPasswordTeacher = async (email) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/teacher/forgot-password', { email });
      setLoading(false);
      return response.data;
    } catch (err) {
      setLoading(false);
      const msg = err.response?.data?.error?.message || 'Password reset request failed';
      setError(msg);
      throw new Error(msg);
    }
  };

  const resetPasswordTeacher = async (email, resetToken, newPassword) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/teacher/reset-password', {
        email,
        resetToken,
        newPassword,
      });
      setLoading(false);
      return response.data;
    } catch (err) {
      setLoading(false);
      const msg = err.response?.data?.error?.message || 'Password reset failed';
      setError(msg);
      throw new Error(msg);
    }
  };

  const clearError = () => setError(null);

  const logout = async () => {
    setUser(null);
    setRole(null);
    setToken(null);
    setAuthToken(null);
    setError(null);
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        token,
        loading,
        isInitializing,
        error,
        clearError,
        loginParentOtp,
        verifyParentOtp,
        loginTeacher,
        registerTeacher,
        forgotPasswordTeacher,
        resetPasswordTeacher,
        logout,
        setRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
