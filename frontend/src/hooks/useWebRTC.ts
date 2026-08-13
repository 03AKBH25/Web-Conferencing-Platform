import { useEffect, useRef, useState, useCallback } from 'react';
import { Participant, ChatMessage, ConnectionState, Meeting } from '../types/meeting';
import { useLocalMedia } from './useLocalMedia';
import { useMeetingSocket } from './useMeetingSocket';
import { ICE_SERVERS_CONFIG } from '../lib/webrtc';

export function useWebRTC(
  meetingId: string | null,
  sessionId: string | null,
  participantId: number | null,
  displayName: string | null
) {
  const [remoteParticipants, setRemoteParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [meetingDetails, setMeetingDetails] = useState<Meeting | null>(null);
  
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const iceQueueMap = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  // Local media hook
  const {
    localStream,
    cameraEnabled,
    microphoneEnabled,
    screenSharing,
    permissionError,
    initLocalMedia,
    toggleMicrophone: toggleLocalMic,
    toggleCamera: toggleLocalCam,
    startScreenShare: startLocalScreen,
    stopScreenShare: stopLocalScreen,
    cleanupMedia
  } = useLocalMedia();

  // Store localStream in ref to access it in event listeners without re-binding
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Main callback to route incoming WebSocket events
  const handleWebSocketMessage = useCallback(async (socket: any) => {
    if (!socket) return;

    // 1. Initial state synchronization
    const unsubscribeState = socket.subscribe('meeting_state', (payload: any) => {
      console.log('Received meeting_state:', payload);
      setMeetingDetails({
        meeting_id: payload.meeting_id,
        title: payload.title,
        description: '',
        status: payload.status,
        meeting_type: 'instant', // default placeholder
        invite_link: ''
      });

      // Initialize remote participants
      const peers = payload.participants as Participant[];
      setRemoteParticipants(peers);

      // We are the newly joined user, so we initiate connections to ALL existing peers
      peers.forEach(async (peer) => {
        await initiatePeerConnection(peer.session_id, peer.display_name, peer.is_host, socket);
      });
    });

    // 2. Another participant joined
    const unsubscribeJoined = socket.subscribe('participant_joined', (payload: any) => {
      const newPeer = payload.participant as Participant;
      console.log('Participant joined:', newPeer);
      
      setRemoteParticipants((prev) => {
        if (prev.some(p => p.session_id === newPeer.session_id)) return prev;
        return [...prev, newPeer];
      });
      // Do not initiate connection here: the newly joined participant will offer to us
    });

    // 3. Another participant left
    const unsubscribeLeft = socket.subscribe('participant_left', (payload: any) => {
      const leftSessionId = payload.session_id;
      console.log('Participant left:', leftSessionId);
      closePeerConnection(leftSessionId);
    });

    // 4. WebRTC Offer
    const unsubscribeOffer = socket.subscribe('webrtc_offer', async (payload: any) => {
      const fromSessionId = payload.from;
      console.log('Received WebRTC offer from:', fromSessionId);
      
      let pc = peerConnections.current.get(fromSessionId);
      if (!pc) {
        // Find user display name
        const peerInfo = remoteParticipants.find(p => p.session_id === fromSessionId);
        const name = peerInfo ? peerInfo.display_name : 'Guest';
        const isHost = peerInfo ? peerInfo.is_host : false;
        pc = await initiatePeerConnection(fromSessionId, name, isHost, socket, false);
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        socket.send('webrtc_answer', {
          target: fromSessionId,
          sdp: answer
        });

        // Apply any queued ICE candidates
        const queue = iceQueueMap.current.get(fromSessionId);
        if (queue) {
          for (const cand of queue) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
          iceQueueMap.current.delete(fromSessionId);
        }
      } catch (err) {
        console.error('Error handling WebRTC offer:', err);
      }
    });

    // 5. WebRTC Answer
    const unsubscribeAnswer = socket.subscribe('webrtc_answer', async (payload: any) => {
      const fromSessionId = payload.from;
      console.log('Received WebRTC answer from:', fromSessionId);
      
      const pc = peerConnections.current.get(fromSessionId);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          
          // Apply any queued ICE candidates
          const queue = iceQueueMap.current.get(fromSessionId);
          if (queue) {
            for (const cand of queue) {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
            iceQueueMap.current.delete(fromSessionId);
          }
        } catch (err) {
          console.error('Error setting remote description on answer:', err);
        }
      }
    });

    // 6. WebRTC ICE Candidate
    const unsubscribeIce = socket.subscribe('webrtc_ice_candidate', async (payload: any) => {
      const fromSessionId = payload.from;
      const candidate = payload.candidate;
      
      const pc = peerConnections.current.get(fromSessionId);
      if (pc) {
        try {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            // Queue candidate
            if (!iceQueueMap.current.has(fromSessionId)) {
              iceQueueMap.current.set(fromSessionId, []);
            }
            iceQueueMap.current.get(fromSessionId)!.push(candidate);
          }
        } catch (err) {
          console.error('Error adding remote ICE candidate:', err);
        }
      }
    });

    // 7. State changes
    const unsubscribeAudio = socket.subscribe('audio_state_changed', (payload: any) => {
      setRemoteParticipants((prev) =>
        prev.map((p) =>
          p.session_id === payload.session_id ? { ...p, audio_enabled: payload.enabled } : p
        )
      );
    });

    const unsubscribeVideo = socket.subscribe('video_state_changed', (payload: any) => {
      setRemoteParticipants((prev) =>
        prev.map((p) =>
          p.session_id === payload.session_id ? { ...p, video_enabled: payload.enabled } : p
        )
      );
    });

    const unsubscribeScreenStart = socket.subscribe('screen_share_started', (payload: any) => {
      setRemoteParticipants((prev) =>
        prev.map((p) =>
          p.session_id === payload.session_id ? { ...p, is_screen_sharing: true } : p
        )
      );
    });

    const unsubscribeScreenStop = socket.subscribe('screen_share_stopped', (payload: any) => {
      setRemoteParticipants((prev) =>
        prev.map((p) =>
          p.session_id === payload.session_id ? { ...p, is_screen_sharing: false } : p
        )
      );
    });

    // 8. Chat
    const unsubscribeChat = socket.subscribe('chat_message', (payload: any) => {
      setChatMessages((prev) => [...prev, payload]);
    });

    // 9. Host Mute All
    const unsubscribeMuteAll = socket.subscribe('mute_all', () => {
      console.log('Host triggered mute all.');
      if (localStreamRef.current) {
        const audioTracks = localStreamRef.current.getAudioTracks();
        audioTracks.forEach(track => {
          track.enabled = false;
        });
        // Sync state representation
        toggleLocalMic(); // force local mic sync call
        socket.send('audio_state_changed', { enabled: false });
      }
    });

    return () => {
      unsubscribeState();
      unsubscribeJoined();
      unsubscribeLeft();
      unsubscribeOffer();
      unsubscribeAnswer();
      unsubscribeIce();
      unsubscribeAudio();
      unsubscribeVideo();
      unsubscribeScreenStart();
      unsubscribeScreenStop();
      unsubscribeChat();
      unsubscribeMuteAll();
    };
  }, [remoteParticipants, toggleLocalMic]);

  // Hook WebSocket and register listeners
  const { connectionState, socket } = useMeetingSocket(
    meetingId,
    sessionId,
    participantId
  );

  useEffect(() => {
    let cleanupWS: () => void = () => {};
    
    if (socket && connectionState === 'connected') {
      handleWebSocketMessage(socket).then((clean) => {
        if (clean) cleanupWS = clean;
      });
    }

    return () => {
      cleanupWS();
    };
  }, [socket, connectionState, handleWebSocketMessage]);

  // Peer connection instantiator helper
  const initiatePeerConnection = async (
    remoteSessionId: string,
    remoteName: string,
    isHost: boolean,
    socket: any,
    createOffer = true
  ) => {
    console.log(`Initiating Peer Connection for session: ${remoteSessionId}, createOffer=${createOffer}`);
    
    const pc = new RTCPeerConnection(ICE_SERVERS_CONFIG);
    peerConnections.current.set(remoteSessionId, pc);

    // Add local tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Capture ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.send('webrtc_ice_candidate', {
          target: remoteSessionId,
          candidate: event.candidate
        });
      }
    };

    // Attach incoming remote tracks
    pc.ontrack = (event) => {
      console.log(`Received remote track from ${remoteSessionId}:`, event.track.kind);
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      
      setRemoteParticipants((prev) =>
        prev.map((p) =>
          p.session_id === remoteSessionId ? { ...p, stream: remoteStream } : p
        )
      );
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state for ${remoteSessionId}: ${pc.connectionState}`);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        closePeerConnection(remoteSessionId);
      }
    };

    if (createOffer && socket) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.send('webrtc_offer', {
          target: remoteSessionId,
          sdp: offer
        });
      } catch (err) {
        console.error('Error creating WebRTC offer:', err);
      }
    }

    return pc;
  };

  const closePeerConnection = (remoteSessionId: string) => {
    const pc = peerConnections.current.get(remoteSessionId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(remoteSessionId);
    }
    iceQueueMap.current.delete(remoteSessionId);
    setRemoteParticipants((prev) => prev.filter(p => p.session_id !== remoteSessionId));
  };

  // Replace video track helper (for screen sharing toggle)
  const replaceVideoTrack = useCallback((newTrack: MediaStreamTrack) => {
    peerConnections.current.forEach((pc) => {
      const senders = pc.getSenders();
      const videoSender = senders.find(sender => sender.track && sender.track.kind === 'video');
      if (videoSender) {
        videoSender.replaceTrack(newTrack).catch(err => console.error('Failed to replace track:', err));
      }
    });
  }, []);

  // UI trigger functions

  const toggleMicrophone = useCallback(() => {
    toggleLocalMic();
    if (socket) {
      socket.send('audio_state_changed', { enabled: !microphoneEnabled });
    }
  }, [socket, toggleLocalMic, microphoneEnabled]);

  const toggleCamera = useCallback(() => {
    toggleLocalCam();
    if (socket) {
      socket.send('video_state_changed', { enabled: !cameraEnabled });
    }
  }, [socket, toggleLocalCam, cameraEnabled]);

  const startScreenShare = useCallback(async () => {
    const stream = await startLocalScreen(replaceVideoTrack);
    if (stream && socket) {
      socket.send('screen_share_started', {});
    }
  }, [socket, startLocalScreen, replaceVideoTrack]);

  const stopScreenShare = useCallback(() => {
    stopLocalScreen(replaceVideoTrack);
    if (socket) {
      socket.send('screen_share_stopped', {});
    }
  }, [socket, stopLocalScreen, replaceVideoTrack]);

  const sendChatMessage = useCallback((message: string) => {
    if (socket && message.trim()) {
      socket.send('chat_message', { message: message.trim() });
    }
  }, [socket]);

  // Host operations

  const hostMuteAll = useCallback(() => {
    if (socket) {
      socket.send('mute_all', {});
    }
  }, [socket]);

  const hostKickParticipant = useCallback((targetParticipantId: number, targetSessionId: string) => {
    if (socket) {
      socket.send('participant_removed', {
        participant_id: targetParticipantId,
        session_id: targetSessionId
      });
    }
  }, [socket]);

  const hostEndMeeting = useCallback(() => {
    if (socket) {
      socket.send('meeting_ended', {});
    }
  }, [socket]);

  const leaveMeeting = useCallback(() => {
    cleanupMedia();
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    iceQueueMap.current.clear();
    
    if (socket) {
      socket.disconnect();
    }
  }, [socket, cleanupMedia]);

  return {
    localStream,
    remoteParticipants,
    chatMessages,
    connectionState,
    cameraEnabled,
    microphoneEnabled,
    screenSharing,
    permissionError,
    meetingDetails,
    initLocalMedia,
    toggleMicrophone,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    sendChatMessage,
    leaveMeeting,
    hostMuteAll,
    hostKickParticipant,
    hostEndMeeting
  };
}
