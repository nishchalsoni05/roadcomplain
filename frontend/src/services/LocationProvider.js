export class LocationProvider {
  /**
   * Request the current location, attempting high-accuracy GPS first,
   * falling back to standard accuracy (IP/WiFi).
   * Returns a promise resolving to { latitude, longitude, accuracy, source }.
   */
  static async getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('Geolocation is not supported by this browser.'));
      }

      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      };

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy, // meters
            source: pos.coords.accuracy <= 50 ? 'gps' : 'wifi/ip'
          });
        },
        (error) => {
          // Fallback to low accuracy if high accuracy fails
          if (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE) {
            navigator.geolocation.getCurrentPosition(
              (posFallback) => {
                resolve({
                  latitude: posFallback.coords.latitude,
                  longitude: posFallback.coords.longitude,
                  accuracy: posFallback.coords.accuracy,
                  source: 'wifi/ip'
                });
              },
              (fallbackError) => reject(fallbackError),
              { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
            );
          } else {
            reject(error);
          }
        },
        options
      );
    });
  }

  /**
   * Watch the location continuously.
   * @param {Function} onUpdate - callback(locationData)
   * @param {Function} onError - callback(error)
   * @returns {Number} watchId
   */
  static watchLocation(onUpdate, onError) {
    if (!navigator.geolocation) {
      if (onError) onError(new Error('Geolocation not supported.'));
      return null;
    }

    return navigator.geolocation.watchPosition(
      (pos) => {
        onUpdate({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          source: pos.coords.accuracy <= 50 ? 'gps' : 'wifi/ip',
          altitude: pos.coords.altitude,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          timestamp: pos.timestamp / 1000,
        });
      },
      (error) => {
        if (onError) onError(error);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }

  static clearWatch(watchId) {
    if (navigator.geolocation && watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }
  }
}
