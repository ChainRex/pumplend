import { useState, useCallback } from 'react';
import { ToastType } from '../components/Toast';

interface ToastState {
  message: string;
  type: ToastType;
  id: number;
  txHash?: string;
  tokenUrl?: string;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  const showToast = useCallback((
    message: string, 
    type: ToastType = 'info', 
    txHash?: string,
    tokenUrl?: string
  ) => {
    const id = Date.now();
    setToasts(prev => [...prev, { message, type, id, txHash, tokenUrl }]);
    return id;
  }, []);

  const hideToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return {
    toasts,
    showToast,
    hideToast
  };
} 