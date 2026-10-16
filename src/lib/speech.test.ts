import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PUSH_WAIT_MS, addPushedClip, setCloudVoice, speak, speakMessage, stopSpeaking } from './speech'

const played: string[] = []
const deviceSaid: string[] = []
const audios: { onended: (() => void) | null }[] = []
const flush = () => new Promise(r => setTimeout(r, 0))

beforeEach(() => {
  played.length = 0; deviceSaid.length = 0
  audios.length = 0
  vi.stubGlobal('Audio', class { onended: (() => void) | null = null; constructor(public src: string) { audios.push(this) } play() { played.push(this.src); return Promise.resolve() } pause() {} })
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

describe('voice pushed by the server', () => {
  const clip = (t: string) => new Blob([t])

  it('plays the reply’s clips in order, the second after the first ends — even if it arrived first', async () => {
    const fetchClip = vi.fn(async () => new Blob(['x']))
    setCloudVoice(fetchClip)
    speakMessage('m1', 'Hello Rose. Your tea is coming.', 'en-US')
    addPushedClip('m1', 1, true, clip('b'))
    expect(played).toEqual([])                    // waits for clip 0
    addPushedClip('m1', 0, false, clip('a'))
    expect(played).toEqual(['blob:1'])
    audios[0].onended?.()
    expect(played).toEqual(['blob:1', 'blob:2'])
    expect(fetchClip).not.toHaveBeenCalled()      // no round trip
  })

  it('fetches the voice itself if nothing is pushed in time, and ignores a clip that turns up late', async () => {
    vi.useFakeTimers()
    const fetchClip = vi.fn(async () => new Blob(['x']))
    setCloudVoice(fetchClip)
    speakMessage('m2', 'Namaste ji.', 'hi-IN')
    vi.advanceTimersByTime(PUSH_WAIT_MS)
    expect(fetchClip).toHaveBeenCalledWith('Namaste ji.', 'hi-IN')
    vi.useRealTimers(); await flush()
    const before = played.length
    addPushedClip('m2', 0, true, clip('late'))
    expect(played.length).toBe(before)
  })

  it('a newer message stops the previous one’s pushed voice', () => {
    setCloudVoice(async () => new Blob(['x']))
    speakMessage('m3', 'First reply.', 'en-US')
    speakMessage('m4', 'Second reply.', 'en-US')
    addPushedClip('m3', 0, true, clip('old'))
    expect(played).toEqual([])
    addPushedClip('m4', 0, true, clip('new'))
    expect(played).toHaveLength(1)
  })
})
