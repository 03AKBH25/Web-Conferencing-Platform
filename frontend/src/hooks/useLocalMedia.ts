import { useState, useCallback, useRef } from 'react';
import { DEFAULT_MEDIA_CONSTRAINTS } from '../lib/webrtc';

export function useLocalMedia() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('syncmeet_pref_camera') !== 'false';
    }
    return true;
  });
  const [microphoneEnabled, setMicrophoneEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('syncmeet_pref_mic_muted') !== 'true';
    }
    return true;
  });
  const [screenSharing, setScreenSharing] = useState(false);
  const [permissionError, setPermissionError] = useState<'camera_denied' | 'camera_in_use' | 'camera_unavailable' | 'microphone_denied' | 'all_denied' | null>(null);
  
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);

  const getMediaErrorName = (error: unknown) => {
    return error instanceof Error ? error.name : undefined;
  };

  const initLocalMedia = useCallback(async (constraints = DEFAULT_MEDIA_CONSTRAINTS) => {
    try {
      setPermissionError(null);
      let stream: MediaStream | null = null;
      let primaryErr: unknown = null;

      // 1. Attempt ideal constraints
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err: unknown) {
        primaryErr = err;
        console.warn('Initial getUserMedia with ideal constraints failed, trying basic video/audio...', err);
        // 2. Attempt basic constraints (fallback for camera resolution mismatch)
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (err2: unknown) {
          primaryErr = err2;
        }
      }

      if (stream) {
        setLocalStream(stream);
        const vTrack = stream.getVideoTracks()[0];
        if (vTrack) {
          cameraTrackRef.current = vTrack;
          setCameraEnabled(vTrack.enabled);
        }
        const aTrack = stream.getAudioTracks()[0];
        if (aTrack) {
          setMicrophoneEnabled(aTrack.enabled);
        }
        return stream;
      }

      // 3. Video failed — analyze error type
      const primaryErrorName = getMediaErrorName(primaryErr);
      const isDenied = primaryErrorName === 'NotAllowedError' || primaryErrorName === 'PermissionDeniedError';
      const isInUse = primaryErrorName === 'NotReadableError' || primaryErrorName === 'TrackStartError';
      const camErrorType = isDenied ? 'camera_denied' : isInUse ? 'camera_in_use' : 'camera_unavailable';

      console.warn(`Video acquisition failed (${primaryErrorName}). Attempting audio-only fallback...`);

      // 4. Try Audio-only fallback
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setLocalStream(audioStream);
        setCameraEnabled(false);
        setPermissionError(camErrorType);
        
        const aTrack = audioStream.getAudioTracks()[0];
        if (aTrack) {
          setMicrophoneEnabled(aTrack.enabled);
        }
        return audioStream;
      } catch {
        // 5. Try Video-only fallback
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
          setLocalStream(videoStream);
          setMicrophoneEnabled(false);
          setPermissionError('microphone_denied');
          
          const vTrack = videoStream.getVideoTracks()[0];
          if (vTrack) {
            cameraTrackRef.current = vTrack;
            setCameraEnabled(vTrack.enabled);
          }
          return videoStream;
        } catch (allErr) {
          console.error('All media devices unavailable or blocked:', allErr);
          setCameraEnabled(false);
          setMicrophoneEnabled(false);
          setPermissionError('all_denied');
          return null;
        }
      }
    } catch (outerErr) {
      console.error('Unexpected error in initLocalMedia:', outerErr);
      return null;
    }
  }, []);

  const toggleMicrophone = useCallback(() => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
        setMicrophoneEnabled(track.enabled);
      });
    }
  }, [localStream]);

  const setMicrophoneEnabledState = useCallback((enabled: boolean) => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
    setMicrophoneEnabled(enabled);
  }, [localStream]);

  const toggleCamera = useCallback(async (): Promise<MediaStreamTrack | null> => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        // Video track exists — toggle its enabled state
        videoTracks.forEach(track => {
          track.enabled = !track.enabled;
          setCameraEnabled(track.enabled);
        });
        return null;
      }
    }

    // No video track available (camera was in use or denied or unavailable at join).
    // Try to acquire the camera now.
    if (!localStream) return null;
    try {
      let videoStream: MediaStream;
      try {
        videoStream = await navigator.mediaDevices.getUserMedia({
          video: DEFAULT_MEDIA_CONSTRAINTS.video
        });
      } catch {
        // Fallback to unconstrained video
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      const newVideoTrack = videoStream.getVideoTracks()[0];
      if (newVideoTrack) {
        localStream.addTrack(newVideoTrack);
        cameraTrackRef.current = newVideoTrack;
        setCameraEnabled(true);
        setPermissionError(null);
        return newVideoTrack; // Caller adds to peer connections
      }
    } catch (err: unknown) {
      console.warn('Camera re-acquisition failed:', err);
      const errorName = getMediaErrorName(err);
      const isDenied = errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError';
      const isInUse = errorName === 'NotReadableError' || errorName === 'TrackStartError';
      setPermissionError(isDenied ? 'camera_denied' : isInUse ? 'camera_in_use' : 'camera_unavailable');
    }
    return null;
  }, [localStream]);

  const stopScreenShare = useCallback((onTrackReplace: (track: MediaStreamTrack) => void) => {
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }
    setScreenSharing(false);
    
    // Restore camera track
    if (cameraTrackRef.current) {
      onTrackReplace(cameraTrackRef.current);
    }
  }, []);

  const startScreenShare = useCallback(async (onTrackReplace: (track: MediaStreamTrack) => void) => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = stream.getVideoTracks()[0];
      screenTrackRef.current = screenTrack;
      setScreenSharing(true);

      // Replace track inside active peer connections
      onTrackReplace(screenTrack);

      // Listen for screen share end (native stop button)
      screenTrack.onended = () => {
        stopScreenShare(onTrackReplace);
      };
      
      return stream;
    } catch (err) {
      console.error('Failed to share screen:', err);
      return null;
    }
  }, [stopScreenShare]);

  const cleanupMedia = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
    }
  }, [localStream]);

  return {
    localStream,
    cameraEnabled,
    microphoneEnabled,
    screenSharing,
    permissionError,
    initLocalMedia,
    toggleMicrophone,
    setMicrophoneEnabledState,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    cleanupMedia
  };
}
