/** Copy from the Stockist widget config (languages.default). */
export const messages = {
  addressNotFound: "Sorry, we couldn't find that address.",
  directionsLink: "Directions",
  genericError: "Sorry, we ran into a problem. Please try again in a moment.",
  geolocationError:
    "We couldn't find your location. Check that location services are turned on in your browser or device settings.",
  initialMessage: "Enter your city or postal code to find nearby stores.",
  noResults: "Sorry, we didn't find any stores nearby.",
  searchPlaceholder: "Type a postcode or address...",
} as const;

export const locatorSettings = {
  radiusOptions: [10, 25, 50, 100, 250],
  defaultRadiusKm: 25,
  maxResults: 100,
  desktopBreakpoint: 700,
  panelWidth: 300,
  desktopHeight: 600,
  mobileMapHeight: 240,
  /** Rough frame around the UK, Ireland and the Channel Islands. */
  initialBounds: {
    west: -10.7,
    south: 49.7,
    east: 2.0,
    north: 61.0,
  },
} as const;
