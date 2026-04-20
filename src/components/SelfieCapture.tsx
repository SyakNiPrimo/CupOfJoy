import { useEffect, useRef, useState } from 'react';

type SelfieCaptureProps = {
  enabled: boolean;
  helpText: string;
  onCaptured: (dataUrl: string) => void;
};

export default function SelfieCapture({ enabled, helpText, onCaptured }: SelfieCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [cameraBusy, setCameraBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    setError('');
    setCameraReady(false);
    setCameraBusy(enabled);

    async function startCamera() {
      if (!enabled) {
        setCameraBusy(false);
        return;
      }

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        });

        activeStream = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play();
        }

        setCameraReady(true);
      } catch {
        setError('Camera permission is required for selfie verification.');
      } finally {
        setCameraBusy(false);
      }
    }

    startCamera();

    return () => {
      activeStream?.getTracks().forEach((track) => track.stop());
      setStream(null);
      setCameraReady(false);
      setCameraBusy(false);
    };
  }, [enabled]);

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) {
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    onCaptured(dataUrl);

    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setCameraReady(false);
  }

  return (
    <div className="panel">
      <div className="section-title">Selfie verification</div>
      <p className="muted">{helpText}</p>

      {error ? <div className="error-box">{error}</div> : null}

      {enabled ? <video ref={videoRef} className="camera-preview" playsInline muted /> : <div className="camera-preview placeholder-box" />}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {cameraBusy ? <div className="info-box">Opening camera...</div> : null}

      <button className="primary-btn" onClick={capturePhoto} type="button" disabled={!enabled || !cameraReady}>
        {cameraReady ? 'Capture selfie' : 'Waiting for camera'}
      </button>
    </div>
  );
}
