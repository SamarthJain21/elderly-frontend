import { describe, expect, it } from 'vitest'
import { activityLabel } from './activity'

describe('activityLabel', () => {
  it('names the running action in the elder’s language', () => {
    expect(activityLabel('check_weather', 'en-US')).toBe('Checking the weather…')
    expect(activityLabel('check_weather', 'th-TH')).toBe('กำลังดูสภาพอากาศ…')
  })
  it('falls back to English for a language without labels', () => {
    expect(activityLabel('book_ride', 'ja-JP')).toBe('Finding a taxi…')
  })
  it('shows just the dots for no tool or an unknown one', () => {
    expect(activityLabel(undefined, 'en-US')).toBeNull()
    expect(activityLabel('reply', 'hi-IN')).toBeNull()
  })
})
