import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Location } from '../types';
import { LOCATIONS } from '../data/mockData';

interface LocationContextType {
  selectedLocation: Location;
  setSelectedLocation: (loc: Location) => void;
  setLocationByName: (name: string) => void;
  availableLocations: Location[];
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedLocation, setSelectedLocation] = useState<Location>(() => {
    const saved = localStorage.getItem('medipath_city');
    if (saved) {
      const found = LOCATIONS.find((l) => l.name.toLowerCase() === saved.toLowerCase());
      if (found) return found;
    }
    // Default to Bhimavaram as highlighted in requirements
    return LOCATIONS[0];
  });

  useEffect(() => {
    localStorage.setItem('medipath_city', selectedLocation.name);
  }, [selectedLocation]);

  const setLocationByName = (name: string) => {
    const match = LOCATIONS.find(
      (l) => l.name.toLowerCase() === name.toLowerCase()
    );
    if (match) {
      setSelectedLocation(match);
    }
  };

  return (
    <LocationContext.Provider
      value={{
        selectedLocation,
        setSelectedLocation,
        setLocationByName,
        availableLocations: LOCATIONS,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
