import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import qrWorker from 'qr-scanner/qr-scanner-worker.min?url';
import SelfieCapture from './SelfieCapture';
import { supabase } from '../lib/supabase';
import { getCurrentCoordinates } from '../lib/geolocation';
import type { AttendanceEventType, AttendanceResponse, Coordinates } from '../types';

QrScanner.WORKER_PATH = qrWorker;

type AttendancePanelProps = {
  onGoToPOS?: () => void;
  onBack?: () => void;
};

type LastStaffIdentity = {
  employeeId?: string;
  employeeNumber?: string;
  employeeName?: string;
  qrToken?: string;
};

export default function AttendancePanel({ onGoToPOS, onBack }: AttendancePanelProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);

  const [eventType, setEventType] = useState<AttendanceEventType | null>(null);
  const [scannerActive, setScannerActive] = useState(false);

  const [qrToken, setQrToken] = useState('');
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [selfieDataUrl, setSelfieDataUrl] = useState('');

  const [busy, setBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [submitStep, setSubmitStep] = useState('');

  const [status, setStatus] = useState<AttendanceResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function startScanner() {
      if (!scannerActive || !videoRef.current) {
        return;
      }

      try {
        const scanner = new QrScanner(
          videoRef.current,
          async (result) => {
            const token = typeof result === 'string' ? result : result.data;
            setQrToken(token);
            setError('');
            setScannerActive(false);
            scanner.stop();
            await autoRequestLocation();
          },
          {
            highlightScanRegion: true,
            highlightCodeOutline: true,
            maxScansPerSecond: 5,
            preferredCamera: 'environment',
          },
        );

        scannerRef.current = scanner;
        await scanner.start();
      } catch {
        setError('Unable to open QR scanner. Please allow camera access.');
      }
    }

    startScanner();

    return () => {
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [scannerActive]);

  useEffect(() => {
    if (!eventType || !qrToken || !coords || !selfieDataUrl || busy || autoSubmitted) {
      return;
    }

    setAutoSubmitted(true);
    void submitAttendance();
  }, [eventType, qrToken, coords, selfieDataUrl, busy, autoSubmitted]);

  async function autoRequestLocation() {
    try {
      setLocationBusy(true);
      const currentCoords = await getCurrentCoordinates();
      setCoords(currentCoords);
      setError('');
    } catch (locationError) {
      const message = locationError instanceof Error ? locationError.message : 'Unable to get location.';
      setError(message);
    } finally {
      setLocationBusy(false);
    }
  }

  async function startFlow(type: AttendanceEventType) {
    setEventType(type);
    setScannerActive(true);
    setQrToken('');
    setCoords(null);
    setSelfieDataUrl('');
    setStatus(null);
    setError('');
    setBusy(false);
    setLocationBusy(false);
    setAutoSubmitted(false);
    setSubmitStep('');
  }

  async function restartFlow() {
    setQrToken('');
    setCoords(null);
    setSelfieDataUrl('');
    setStatus(null);
    setError('');
    setBusy(false);
    setLocationBusy(false);
    setAutoSubmitted(false);
    setSubmitStep('');

    if (eventType) {
      setScannerActive(true);
      return;
    }
  }

  async function submitAttendance() {
    if (!eventType) {
      setError('Please choose Time In or Time Out first.');
      return;
    }

    if (!qrToken) {
      setError('Please scan the employee QR code first.');
      return;
    }

    if (!coords) {
      setError('Location is required.');
      return;
    }

    if (!selfieDataUrl) {
      setError('Selfie is required.');
      return;
    }

    try {
      setBusy(true);
      setError('');
      setStatus(null);
      setSubmitStep('Uploading selfie proof...');

      const selfiePath = await withTimeout(
        uploadSelfie(selfieDataUrl),
        30000,
        'Selfie upload timed out. Please check Supabase storage setup and try again.',
      );

      setSubmitStep('Saving attendance record...');

      const { data, error: rpcError } = await withTimeout(
        supabase.rpc('record_attendance_scan', {
          p_qr_token: qrToken,
          p_event_type: eventType,
          p_latitude: coords.latitude,
          p_longitude: coords.longitude,
          p_accuracy: coords.accuracy ?? null,
          p_selfie_path: selfiePath,
          p_source_label: 'netlify-kiosk',
        }),
        30000,
        'Saving attendance timed out. Make sure the updated SQL setup was run in Supabase.',
      );

      if (rpcError) throw rpcError;

      const result = data as AttendanceResponse;

      if (!result.success) {
        throw new Error(result.message || 'Attendance submit failed.');
      }

      setStatus(result);

      if (eventType === 'time_in' && result.employeeId) {
        localStorage.setItem(
          'coj_last_staff',
          JSON.stringify({
            employeeId: result.employeeId,
            employeeNumber: result.employeeNumber ?? '',
            employeeName: result.employeeName ?? '',
            qrToken,
          }),
        );

        window.dispatchEvent(new Event('coj-staff-updated'));
      }

      if (eventType === 'time_out') {
        localStorage.removeItem('coj_last_staff');
        window.dispatchEvent(new Event('coj-staff-updated'));
      }

      if (eventType === 'time_in' && onGoToPOS) {
        setTimeout(() => {
          onGoToPOS();
        }, 900);
      }
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : 'Attendance submit failed.';
      setError(message);
      setAutoSubmitted(false);
      setSelfieDataUrl('');
    } finally {
      setBusy(false);
      setSubmitStep('');
    }
  }

  async function uploadSelfie(dataUrl: string) {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const path = `attendance/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('attendance-selfies')
      .upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) throw uploadError;
    return path;
  }

  function withTimeout<T>(promise: PromiseLike<T>, milliseconds: number, message: string) {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => reject(new Error(message)), milliseconds);

      Promise.resolve(promise).then(
        (value) => {
          window.clearTimeout(timeoutId);
          resolve(value);
        },
        (reason) => {
          window.clearTimeout(timeoutId);
          reject(reason);
        },
      );
    });
  }

  const selfieEnabled = Boolean(eventType && qrToken && coords && !busy && !status);
  const stepLabel = !eventType
    ? 'Choose Time In or Time Out.'
    : !qrToken
      ? 'Scan employee QR.'
      : !coords
        ? 'Checking location.'
        : !selfieDataUrl
          ? 'Capture selfie.'
          : busy
            ? submitStep || 'Submitting attendance.'
            : status
              ? 'Attendance saved.'
              : 'Ready to submit.';
  const selfieHelpText = busy
    ? 'Selfie captured. Please wait while attendance is being submitted.'
    : selfieDataUrl
      ? 'Selfie captured. Attendance is ready to submit.'
      : selfieEnabled
        ? 'Take a clear selfie before submitting your time record.'
        : eventType === 'time_out'
          ? 'Scan QR, then capture a selfie to confirm the exact staff logging out.'
          : 'Choose Time In, scan QR, then allow location before selfie capture.';

  const showSelfiePanel = Boolean(qrToken && coords);

  return (
    <div className={showSelfiePanel ? 'grid-two' : 'single-panel'}>
      <div className="panel">
        {onBack ? (
          <button className="ghost-btn" onClick={onBack} type="button" disabled={busy}>
            Back
          </button>
        ) : null}

        <div className="section-title">Login and Logout</div>
        <p className="muted">
          Time In and Time Out both use QR, location, and selfie so each record belongs to the right staff.
        </p>

        <div className="toggle-row">
          <button
            className={eventType === 'time_in' ? 'toggle-btn active' : 'toggle-btn'}
            onClick={() => void startFlow('time_in')}
            type="button"
            disabled={busy}
          >
            Time In
          </button>
          <button
            className={eventType === 'time_out' ? 'toggle-btn active' : 'toggle-btn'}
            onClick={() => void startFlow('time_out')}
            type="button"
            disabled={busy}
          >
            Time Out
          </button>
        </div>

        <div className="info-box">{stepLabel}</div>

        {!eventType ? (
          <div className="info-box">Choose Time In or Time Out to start.</div>
        ) : !qrToken ? (
          <>
            <video ref={videoRef} className="scanner-preview" playsInline muted />
            <div className="muted small">Scan the employee QR code.</div>
          </>
        ) : (
          <div className="success-box">QR scanned successfully.</div>
        )}

        {locationBusy ? <div className="info-box">Checking location automatically...</div> : null}
        {coords ? <div className="info-box">Location checked successfully.</div> : null}

        <div className="action-row wrap">
          <button className="ghost-btn" onClick={() => void restartFlow()} type="button" disabled={busy}>
            {eventType === 'time_out' ? 'Restart Time Out' : 'Scan again'}
          </button>

          {qrToken && !coords && !locationBusy ? (
            <button className="secondary-btn" onClick={() => void autoRequestLocation()} type="button" disabled={busy}>
              Retry location
            </button>
          ) : null}
        </div>

        {busy ? (
          <div className="info-box">
            {submitStep || (eventType === 'time_in' ? 'Submitting time in...' : 'Submitting time out...')}
          </div>
        ) : null}

        {error ? <div className="error-box">{error}</div> : null}

        {status ? (
          <div className="success-box">
            <strong>{status.employeeName}</strong>
            <br />
            {status.message}
            {status.locationName ? (
              <>
                <br />
                Location checked: {status.locationName}
              </>
            ) : null}
            {status.scannedAt ? (
              <>
                <br />
                Time: {status.scannedAt}
              </>
            ) : null}
            {status.shiftName ? (
              <>
                <br />
                Shift: {status.shiftName}
              </>
            ) : null}
            {typeof status.lateMinutes === 'number' && status.lateMinutes > 0 ? (
              <>
                <br />
                Late: {status.lateMinutes} minute(s)
              </>
            ) : null}
            {typeof status.payrollDeduction === 'number' && status.payrollDeduction > 0 ? (
              <>
                <br />
                Payroll deduction: PHP {status.payrollDeduction.toFixed(2)}
              </>
            ) : null}
            {typeof status.overtimeHours === 'number' && status.overtimeHours > 0 ? (
              <>
                <br />
                Overtime: {status.overtimeHours} hour(s)
              </>
            ) : null}
            {typeof status.overtimePay === 'number' && status.overtimePay > 0 ? (
              <>
                <br />
                Overtime pay: PHP {status.overtimePay.toFixed(2)}
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {showSelfiePanel ? (
        <SelfieCapture enabled={selfieEnabled} helpText={selfieHelpText} onCaptured={setSelfieDataUrl} />
      ) : null}
    </div>
  );
}
