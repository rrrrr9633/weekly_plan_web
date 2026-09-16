type VoiceInput = {
  stop: () => void
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike
type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

function recognitionCtor(): SpeechRecognitionCtor | undefined {
  const speech = window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor }
  return speech.SpeechRecognition ?? speech.webkitSpeechRecognition
}

export function isBrowserVoiceSupported() {
  return Boolean(recognitionCtor())
}

export function startVoiceInput(onText: (text: string, isFinal: boolean) => void, onEnd: (error?: string) => void): VoiceInput {
  const Ctor = recognitionCtor()
  if (!Ctor) throw new Error('当前浏览器不支持语音输入，请使用 Chrome / Edge，或改用文字。')
  const recognition = new Ctor()
  recognition.lang = 'zh-CN'
  recognition.continuous = true
  recognition.interimResults = true
  recognition.maxAlternatives = 1
  let stopped = false
  recognition.onresult = (event) => {
    let finalText = ''
    let interimText = ''
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index]
      const transcript = result[0]?.transcript ?? ''
      if (result.isFinal) finalText += transcript
      else interimText += transcript
    }
    if (finalText) onText(finalText, true)
    else if (interimText) onText(interimText, false)
  }
  recognition.onerror = (event) => {
    if (event.error === 'aborted' || event.error === 'no-speech') return
    onEnd(event.error === 'not-allowed' ? '请允许浏览器使用麦克风。' : '语音识别失败，请改用文字输入。')
  }
  recognition.onend = () => {
    if (!stopped) onEnd()
  }
  recognition.start()
  return {
    stop: () => {
      stopped = true
      recognition.onend = () => onEnd()
      recognition.stop()
    },
  }
}
