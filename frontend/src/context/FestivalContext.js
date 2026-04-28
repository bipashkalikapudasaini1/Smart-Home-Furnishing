import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { festivalAPI } from '../utils/api';

const FestivalContext = createContext();

// Hook — any component can call useFestival() to get active festival info
export const useFestival = () => {
  const context = useContext(FestivalContext);
  if (!context) throw new Error('useFestival must be used within FestivalProvider');
  return context;
};

export const FestivalProvider = ({ children }) => {
  const [activeFestival, setActiveFestival] = useState(null);

  const fetchActiveFestival = useCallback(async () => {
    try {
      const res = await festivalAPI.getActive();
      setActiveFestival(res.data.data || null);
    } catch {
      setActiveFestival(null);
    }
  }, []);

  useEffect(() => {
    fetchActiveFestival();
    // Re-fetch when user returns to the tab (catches admin deactivating mid-session)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchActiveFestival();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchActiveFestival]);

  // Returns the festival discount % if this product is part of the active festival
  // Returns 0 if the product is not in the festival or no festival is active
  const getFestivalDiscount = useCallback((productId) => {
    if (!activeFestival || !activeFestival.discountPercent) return 0;
    const inFestival = activeFestival.products?.some(
      (p) => (p._id || p).toString() === productId?.toString()
    );
    return inFestival ? Number(activeFestival.discountPercent) : 0;
  }, [activeFestival]);

  return (
    <FestivalContext.Provider value={{ activeFestival, getFestivalDiscount, fetchActiveFestival }}>
      {children}
    </FestivalContext.Provider>
  );
};
