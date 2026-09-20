// src/context/BLEContext.jsx
import React, { createContext, useContext } from 'react';
import { useBLEHeartRate } from '../hooks/useBLEHeartRate';

const BLEContext = createContext(null);

export function BLEProvider({ children }) {
  const ble = useBLEHeartRate();
  return (
    <BLEContext.Provider value={ble}>
      {children}
    </BLEContext.Provider>
  );
}

export function useBLE() {
  const context = useContext(BLEContext);
  if (!context) {
    throw new Error('useBLE trebuie utilizat în interiorul unui BLEProvider');
  }
  return context;
}
