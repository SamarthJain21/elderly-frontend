import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setCloudVoice, speak, stopSpeaking } from './speech'

const played: string[] = []
const deviceSaid: string[] = []
const flush = () => new Promise(r => setTimeout(r, 0))

beforeEach(() => {
  played.length = 0; deviceSaid.length = 0
  vi.stubGlobal('Audio', class { constructor(public src: string) {} play() { played.push(this.src); return Promise.resolve() } pause() {} })
  let n = 0
  vi.stubGlobal('URL', { createObjectURL: () => `blob:${++n}`, revokeObjectURL: () => {} })
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} })
  vi.stubGlobal('speechSynthesis', {
    speaking: false, pending: false, cancel() {}, resume() {},
    speak: (u: { text: string }) => deviceSaid.push(u.text),
    getVoices: () => [{ lang: 'th-TH', voiceURI: 'kanya', name: 'Kanya' }],
  })
  vi.stubGlobal('window', { speechSynthesis: globalThis.speechSynthesis, setTimeout })
})
afterEach(() => { setCloudVoice(null); vi.unstubAllGlobals() })

describe('speak with the natural voice', () => {
  it('plays the cloud clip and reuses it for a replay', async () => {
    const fetchClip = vi.fn(async () => new Blob(['mp3']))
    setCloudVoice(fetchClip)
    speak('สวัสดีค่ะ 😊', 'th-TH'); await flush()
    speak('สวัสดีค่ะ', 'th-TH'); await flush()
    expect(fetchClip).toHaveBeenCalledTimes(1)
    expect(fetchClip).toHaveBeenCalledWith('สวัสดีค่ะ', 'th-TH')
    expect(played).toEqual(['blob:1', 'blob:1'])
    expect(deviceSaid).toEqual([])
  })

  it('falls back to the device voice when the cloud voice fails', async () => {
    setCloudVoice(async () => { throw new Error('502') })
    speak('ฝนจะตกไหม', 'th-TH'); await flush()   // (clips are cached per module: use a fresh sentence)
    expect(played).toEqual([])
    expect(deviceSaid).toEqual(['ฝนจะตกไหม'])
  })

  it('stays quiet if stopped before the clip arrives', async () => {
    let resolve!: (b: Blob) => void
    setCloudVoice(() => new Promise<Blob>(r => { resolve = r }))
    speak('Hello Rose', 'en-US')
    stopSpeaking()
    resolve(new Blob(['mp3'])); await flush()
    expect(played).toEqual([])
  })
})
