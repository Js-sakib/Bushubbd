'use client'

import { useEffect, useRef, useState } from 'react'

/** How often a frame is checked for a QR code. Every frame would drain a phone's battery. */
const SCAN_INTERVAL_MS = 150
/** Frames are shrunk to this width before decoding; plenty for a ticket held up to the camera. */
const DECODE_WIDTH = 640

interface NativeDetector {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>
}

/**
 * Live camera view that reports the first QR code it reads. Uses the phone's built-in
 * barcode reader where the browser has one (Chrome on Android) and falls back to jsQR.
 */
export default function QrCamera({ onDetected }: { onDetected: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const callbackRef = useRef(onDetected)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(true)

  callbackRef.current = onDetected

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser cannot open the camera. Type the booking code below instead.')
        setStarting(false)
        return
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
      } catch {
        setError('Camera permission was blocked. Allow the camera for this site in your browser settings, or type the booking code below.')
        setStarting(false)
        return
      }
      if (stopped) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play().catch(() => undefined)
      setStarting(false)

      let detector: NativeDetector | null = null
      const Native = (window as unknown as { BarcodeDetector?: any }).BarcodeDetector
      if (Native) {
        try {
          const formats: string[] = await Native.getSupportedFormats()
          if (formats.includes('qr_code')) detector = new Native({ formats: ['qr_code'] })
        } catch {
          detector = null
        }
      }
      const jsQR = detector ? null : (await import('jsqr')).default

      const tick = async () => {
        if (stopped) return
        let text: string | undefined

        if (video.readyState >= 2 && video.videoWidth > 0) {
          try {
            if (detector) {
              text = (await detector.detect(video))[0]?.rawValue
            } else if (jsQR && canvasRef.current) {
              const scale = Math.min(1, DECODE_WIDTH / video.videoWidth)
              const width = Math.round(video.videoWidth * scale)
              const height = Math.round(video.videoHeight * scale)
              const canvas = canvasRef.current
              canvas.width = width
              canvas.height = height
              const ctx = canvas.getContext('2d', { willReadFrequently: true })
              if (ctx) {
                ctx.drawImage(video, 0, 0, width, height)
                const frame = ctx.getImageData(0, 0, width, height)
                text = jsQR(frame.data, width, height, { inversionAttempts: 'dontInvert' })?.data
              }
            }
          } catch {
            text = undefined
          }
        }

        if (text && !stopped) {
          stopped = true
          callbackRef.current(text)
          return
        }
        timer = setTimeout(tick, SCAN_INTERVAL_MS)
      }
      tick()
    }

    start()
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  if (error) {
    return (
      <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-[22px] border border-[#3a2c10] bg-[#1a1508] p-6 text-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="#f5a524" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-9 w-9">
          <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H7l1.5-2h7L17 6h2.5A1.5 1.5 0 0 1 21 7.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
          <path d="M3 3l18 18" />
        </svg>
        <p className="text-[13px] leading-relaxed text-[#e8d6b0]">{error}</p>
      </div>
    )
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-[22px] bg-black">
      <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Aiming frame: the four corners of the area to hold the ticket's QR code in. */}
      <div className="pointer-events-none absolute inset-[16%]">
        {['left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl', 'right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl', 'left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl', 'right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl'].map((corner) => (
          <span key={corner} className={`absolute h-10 w-10 border-[#f5a524] ${corner}`} />
        ))}
        <span className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse bg-[#f5a524]/70" />
      </div>

      <span className="absolute inset-x-0 bottom-3 text-center text-[12.5px] font-semibold text-white/85">
        {starting ? 'Opening camera...' : 'Hold the ticket QR code inside the frame'}
      </span>
    </div>
  )
}
