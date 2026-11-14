// src/utils/locationUtils.js
// Geolocation and GPS Utilities

/**
 * Get user's current GPS location
 * @returns {Promise} - { latitude, longitude, accuracy }
 */
export const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation API not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        reject(error);
      },
      {
        timeout: 10000,
        enableHighAccuracy: true,
      }
    );
  });
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 * @param {number} lat1 - Latitude 1
 * @param {number} lon1 - Longitude 1
 * @param {number} lat2 - Latitude 2
 * @param {number} lon2 - Longitude 2
 * @returns {number} - Distance in kilometers
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Format coordinates for display
 * @param {number} latitude
 * @param {number} longitude
 * @returns {string} - Formatted coordinates
 */
export const formatCoordinates = (latitude, longitude) => {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
};

/**
 * Get reverse geocoding (address from coordinates) - using OpenStreetMap
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise} - Address details
 */
export const getAddressFromCoordinates = async (latitude, longitude) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
    );

    const data = await response.json();
    return {
      address: data.address?.road || data.address?.suburb || 'Unknown Location',
      area: data.address?.city || data.address?.town || '',
      state: data.address?.state || '',
      zipcode: data.address?.postcode || '',
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    throw error;
  }
};

export default {
  getCurrentLocation,
  calculateDistance,
  formatCoordinates,
  getAddressFromCoordinates,
};
