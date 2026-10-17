import { describe, expect, it } from 'vitest'
import { isRideRequest } from './here'

describe('isRideRequest (location is only shared for rides)', () => {
  it('spots a ride request in each language', () => {
    for (const t of ['I need a taxi', 'taxi book kijiye', 'Mujhe clinic jaane ke liye taxi chahiye', 'मुझे मंदिर जाने के लिए टैक्सी चाहिए', 'อยากได้แท็กซี่', 'Book me an auto'])
      expect(isRideRequest(t)).toBe(true)
  })
  it('does not share location for anything else', () => {
    for (const t of ['Order my medicine', 'Will it rain today?', 'I am feeling okay', 'Please take care', 'मेरी दवाई मँगवा दीजिए'])
      expect(isRideRequest(t)).toBe(false)
  })
})
