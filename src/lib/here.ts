/** A request for a ride, in any of the app's languages: only then does the phone share where it is. */
const RIDE = /\b(taxi|cab|ride|uber|ola|rapido|auto|gaadi|gadi|car)\b|टैक्सी|गाड़ी|ऑटो|कैब|แท็กซี่|เรียกรถ|รถ/i

export const isRideRequest = (text: string) => RIDE.test(text)

export type Here = { lat: number; lng: number; accuracy: number }

/**
 * The phone's location for a ride pickup — asked only when a ride is requested (the browser asks permission the
 * first time). Never stored: the server keeps it for 10 minutes on this connection. null = not shared / not found.
 */
export function getHere(timeoutMs = 8000): Promise<Here | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null)
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 120_000 },
    )
  })
}
