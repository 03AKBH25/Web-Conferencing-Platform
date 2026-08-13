import { useState, useCallback, useRef } from 'react';
import { DEFAULT_MEDIA_CONSTRAINTS } from '../lib/webrtc';

export function useLocalMedia() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [permissionError, setPermissionError] = useState<'camera_denied' | 'microphone_denied' | 'all_denied' | null>(null);
  
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);

  const initLocalMedia = useCallback(async (constraints = DEFAULT_MEDIA_CONSTRAINTS) => {
    try {
      setPermissionError(null);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
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
    } catch (err) {
      console.warn('Initial getUserMedia failed, attempting fallback...', err);
      // Try audio-only fallback
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setLocalStream(stream);
        setCameraEnabled(false);
        setPermissionError('camera_denied');
        
        const aTrack = stream.getAudioTracks()[0];
        if (aTrack) {
          setMicrophoneEnabled(aTrack.enabled);
        }
        return stream;
      } catch {
        // Try video-only fallback
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
          setLocalStream(stream);
          setMicrophoneEnabled(false);
          setPermissionError('microphone_denied');
          
          const vTrack = stream.getVideoTracks()[0];
          if (vTrack) {
            cameraTrackRef.current = vTrack;
            setCameraEnabled(vTrack.enabled);
          }
          return stream;
        } catch (err3) {
          console.error('All media devices blocked:', err3);
          setCameraEnabled(false);
          setMicrophoneEnabled(false);
          setPermissionError('all_denied');
          return null;
        }
      }
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

  const toggleCamera = useCallback(() => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
        setCameraEnabled(track.enabled);
      });
    }
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
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    cleanupMedia
  };
}
