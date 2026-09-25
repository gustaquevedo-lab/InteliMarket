// hooks/useLocation.ts
import { useState, useCallback, useEffect } from 'react';
import { getCurrentPreciseLocation, LocationReading, requestLocationPermissions } from '@/lib/location';
import { config } from '@/constants/config';

export function useLocation() {
  const [location, setLocation] = useState<LocationReading | null>(null);
  const [accuracy, setAccuracy] = useState<number>(999);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const requestFix = useCallback(async (): Promise<LocationReading | null> => {
    setIsLocating(true);
    setError(null);
    try {
      const loc = await getCurrentPreciseLocation();
      setLocation(loc);
      setAccuracy(loc.accuracy);
      setIsLocating(false);
      return loc;
    } catch (err: any) {
      setError(err?.message || 'Error al obtener GPS');
      setIsLocating(false);
      return null;
    }
  }, []);

  useEffect(() => {
    // Pedir permisos y obtener primera lectura en segundo plano al montar
    requestLocationPermissions().then((granted) => {
      if (granted) {
        requestFix().catch(() => {});
      }
    });
  }, [requestFix]);

  const isGoodAccuracy = accuracy <= config.gps.targetAccuracyM;
  const isAcceptableAccuracy = accuracy <= config.gps.acceptableAccuracyM;

  return {
    location,
    accuracy,
    isLocating,
    isGoodAccuracy,
    isAcceptableAccuracy,
    error,
    requestFix,
  };
}
