import type { Coordinates } from '../types';

export async function getCurrentCoordinates(): Promise<Coordinates> {
  if (!navigator.geolocation) {
    throw new Error('Location is not supported on this device or browser.');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        reject(new Error(error.message || 'Unable to get your current location.'));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  });
}
