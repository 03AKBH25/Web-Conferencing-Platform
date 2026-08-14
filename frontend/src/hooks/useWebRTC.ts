import { useEffect, useRef, useState, useCallback } from 'react';
import { Participant, ChatMessage, Meeting } from '../types/meeting';
import { useLocalMedia } from './useLocalMedia';
import { useMeetingSocket } from './useMeetingSocket';
import { ICE_SERVERS_CONFIG } from '../lib/webrtc';
import { MeetingSocket } from '../lib/socket';
import { api } from '../lib/api';

interface MeetingStatePayload {
  meeting_id: string;
  title: string;
  status: 'scheduled' | 'active' | 'ended' | 'cancelled';
  participants: Participant[];
}

interface ParticipantJoinedPayload {
  participant: Participant;
}

interface ParticipantLeftPayload {
  session_id: string;
}

interface ParticipantRemovedPayload {
  participant_id: number;
  session_id: string;
}

interface WebRTCOfferPayload {
  from: string;
  sdp: RTCSessionDescriptionInit;
}

interface WebRTCAnswerPayload {
  from: string;
  sdp: RTCSessionDescriptionInit;
}

interface WebRTCICECandidatePayload {
  from: string;
  candidate: RTCIceCandidateInit;
}

interface MediaStateChangedPayload {
  session_id: string;
  enabled: boolean;
}

interface ScreenSharePayload {
  session_id: string;
}

export function useWebRTC(
  meetingId: string | null,
  sessionId: string | null,
  participantId: number | null
) {
  const [remoteParticipants, setRemoteParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [meetingDetails, setMeetingDetails] = useState<Meeting | null>(null);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [removedFromMeeting, setRemovedFromMeeting] = useState(false);

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const iceQueueMap = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreams = useRef<Map<string, MediaStream>>(new Map());

  // Local media hook
  const {
    localStream,
    cameraEnabled,
    microphoneEnabled,
    screenSharing,
    permissionError,
    initLocalMedia,
    toggleMicrophone: toggleLocalMic,
    setMicrophoneEnabledState,
    toggleCamera: toggleLocalCam,
    startScreenShare: startLocalScreen,
    stopScreenShare: stopLocalScreen,
    cleanupMedia
  } = useLocalMedia();

  // Store localStream in ref to access it in event listeners without re-binding
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Hook WebSocket and register listeners
  const { connectionState, socket } = useMeetingSocket(
    meetingId,
    sessionId,
    participantId
  );

  // Close peer connection helper
  const closePeerConnection = useCallback((remoteSessionId: string) => {
    const pc = peerConnections.current.get(remoteSessionId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(remoteSessionId);
    }
    iceQueueMap.current.delete(remoteSessionId);
    remoteStreams.current.delete(remoteSessionId);
    setRemoteParticipants((prev) => prev.filter(p => p.session_id !== remoteSessionId));
  }, []);

  const attachLocalTracks = useCallback(async (pc: RTCPeerConnection) => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const replacements: Promise<void>[] = [];

    stream.getTracks().forEach((track) => {
      const existingSender = pc.getSenders().find((sender) => sender.track === track);
      if (existingSender) return;

      const matchingTransceiver = pc.getTransceivers().find((transceiver) =>
        transceiver.receiver.track.kind === track.kind &&
        (!transceiver.sender.track || transceiver.sender.track.readyState === 'ended')
      );

      if (matchingTransceiver) {
        matchingTransceiver.direction = 'sendrecv';
        replacements.push(matchingTransceiver.sender.replaceTrack(track));
        return;
      }

      pc.addTrack(track, stream);
    });

    try {
      await Promise.all(replacements);
    } catch (err) {
      console.error('Failed to attach local media tracks:', err);
    }
  }, []);

  // Peer connection instantiator helper
  const initiatePeerConnection = useCallback(async (
    remoteSessionId: string,
    _remoteName: string,
    _isHost: boolean,
    socketInst: MeetingSocket,
    createOffer = true
  ) => {
    console.log(`Initiating Peer Connection for session: ${remoteSessionId}, createOffer=${createOffer}`);

    const pc = new RTCPeerConnection(ICE_SERVERS_CONFIG);
    peerConnections.current.set(remoteSessionId, pc);

    // Add local tracks to peer connection ONLY when creating an offer (initiator).
    if (createOffer) {
      await attachLocalTracks(pc);
      // Always ensure a video transceiver exists even if we have no video track
      // (e.g. camera was denied). This allows replaceTrack later without renegotiation.
      const hasVideoSender = pc.getSenders().some(s => s.track?.kind === 'video');
      if (!hasVideoSender) {
        pc.addTransceiver('video', { direction: 'sendrecv' });
      }
    }

    // Capture ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketInst.send('webrtc_ice_candidate', {
          target: remoteSessionId,
          candidate: event.candidate
        });
      }
    };

    // Attach incoming remote tracks
    pc.ontrack = (event) => {
      console.log(`Received remote track from ${remoteSessionId}:`, event.track.kind);
      const remoteStream = remoteStreams.current.get(remoteSessionId) || new MediaStream();
      if (!remoteStream.getTracks().some((track) => track.id === event.track.id)) {
        remoteStream.addTrack(event.track);
      }
      remoteStreams.current.set(remoteSessionId, remoteStream);

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

    if (createOffer) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketInst.send('webrtc_offer', {
          target: remoteSessionId,
          sdp: offer
        });
      } catch (err) {
        console.error('Error creating WebRTC offer:', err);
      }
    }

    return pc;
  }, [attachLocalTracks, closePeerConnection]);

  // Main callback to route incoming WebSocket events
  const handleWebSocketMessage = useCallback((socketInst: MeetingSocket) => {
    // 1. Initial state synchronization
    const unsubscribeState = socketInst.subscribe<MeetingStatePayload>('meeting_state', (payload) => {
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
      const peers = payload.participants;
      setRemoteParticipants(peers);

      // We are the newly joined user, so we initiate connections to ALL existing peers
      peers.forEach(async (peer) => {
        await initiatePeerConnection(peer.session_id, peer.display_name, peer.is_host, socketInst);
      });
    });

    // 2. Another participant joined
    const unsubscribeJoined = socketInst.subscribe<ParticipantJoinedPayload>('participant_joined', (payload) => {
      const newPeer = payload.participant;
      console.log('Participant joined:', newPeer);

      setRemoteParticipants((prev) => {
        if (prev.some(p => p.session_id === newPeer.session_id)) return prev;
        return [...prev, newPeer];
      });
    });

    // 3. Another participant left
    const unsubscribeLeft = socketInst.subscribe<ParticipantLeftPayload>('participant_left', (payload) => {
      const leftSessionId = payload.session_id;
      console.log('Participant left:', leftSessionId);
      closePeerConnection(leftSessionId);
    });

    // 4. WebRTC Offer
    const unsubscribeOffer = socketInst.subscribe<WebRTCOfferPayload>('webrtc_offer', async (payload) => {
      const fromSessionId = payload.from;
      console.log('Received WebRTC offer from:', fromSessionId);

      let pc = peerConnections.current.get(fromSessionId);
      if (!pc) {
        pc = await initiatePeerConnection(fromSessionId, 'Guest', false, socketInst, false);
      }

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

        // Add local tracks AFTER setting remote description (answerer side).
        // This lets the browser match our local tracks to the remote offer's
        // transceivers by media kind, preventing cross-browser mismatches.
        await attachLocalTracks(pc);

        // Ensure video transceivers are sendrecv so we can start sending
        // video later if camera becomes available (without renegotiation)
        pc.getTransceivers().forEach(t => {
          if (t.receiver.track.kind === 'video' && t.direction === 'recvonly') {
            t.direction = 'sendrecv';
          }
        });

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socketInst.send('webrtc_answer', {
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
    const unsubscribeAnswer = socketInst.subscribe<WebRTCAnswerPayload>('webrtc_answer', async (payload) => {
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
    const unsubscribeIce = socketInst.subscribe<WebRTCICECandidatePayload>('webrtc_ice_candidate', async (payload) => {
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
    const unsubscribeAudio = socketInst.subscribe<MediaStateChangedPayload>('audio_state_changed', (payload) => {
      setRemoteParticipants((prev) =>
        prev.map((p) =>
          p.session_id === payload.session_id ? { ...p, audio_enabled: payload.enabled } : p
        )
      );
    });

    const unsubscribeVideo = socketInst.subscribe<MediaStateChangedPayload>('video_state_changed', (payload) => {
      setRemoteParticipants((prev) =>
        prev.map((p) =>
          p.session_id === payload.session_id ? { ...p, video_enabled: payload.enabled } : p
        )
      );
    });

    const unsubscribeScreenStart = socketInst.subscribe<ScreenSharePayload>('screen_share_started', (payload) => {
      setRemoteParticipants((prev) =>
        prev.map((p) =>
          p.session_id === payload.session_id ? { ...p, is_screen_sharing: true } : p
        )
      );
    });

    const unsubscribeScreenStop = socketInst.subscribe<ScreenSharePayload>('screen_share_stopped', (payload) => {
      setRemoteParticipants((prev) =>
        prev.map((p) =>
          p.session_id === payload.session_id ? { ...p, is_screen_sharing: false } : p
        )
      );
    });

    // 8. Chat
    const unsubscribeChat = socketInst.subscribe<ChatMessage>('chat_message', (payload) => {
      setChatMessages((prev) => [...prev, payload]);
    });

    // 9. Host Mute All
    const unsubscribeMuteAll = socketInst.subscribe<void>('mute_all', () => {
      console.log('Host triggered mute all.');
      setMicrophoneEnabledState(false);
      socketInst.send('audio_state_changed', { enabled: false });
    });

    const unsubscribeParticipantRemoved = socketInst.subscribe<ParticipantRemovedPayload>('participant_removed', (payload) => {
      if (payload.session_id !== sessionId) return;

      console.log('Removed from meeting by host.');
      setRemovedFromMeeting(true);
      cleanupMedia();
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      iceQueueMap.current.clear();
      socketInst.disconnect();
    });

    const unsubscribeMeetingEnded = socketInst.subscribe<void>('meeting_ended', () => {
      console.log('Meeting has been ended by the host.');
      setMeetingEnded(true);
      cleanupMedia();
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      iceQueueMap.current.clear();
      remoteStreams.current.clear();
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
      unsubscribeParticipantRemoved();
      unsubscribeMeetingEnded();
    };
  }, [initiatePeerConnection, closePeerConnection, attachLocalTracks, setMicrophoneEnabledState, cleanupMedia, sessionId]);

  // Handle socket subscription registration
  useEffect(() => {
    let cleanupWS: (() => void) | undefined;

    if (socket && connectionState === 'connected') {
      cleanupWS = handleWebSocketMessage(socket);
    }

    return () => {
      if (cleanupWS) {
        cleanupWS();
      }
    };
  }, [socket, connectionState, handleWebSocketMessage]);

  // Replace video track helper (for screen sharing toggle)
  const replaceVideoTrack = useCallback((newTrack: MediaStreamTrack) => {
    peerConnections.current.forEach((pc) => {
      const videoSender = pc.getSenders().find(sender => sender.track?.kind === 'video')
        || pc.getTransceivers().find(t => t.receiver.track.kind === 'video')?.sender;
      if (videoSender) {
        videoSender.replaceTrack(newTrack).catch(err => console.error('Failed to replace track:', err));
      }
    });
  }, []);

  // UI trigger functions

  const toggleMicrophone = useCallback(() => {
    toggleLocalMic();
    if (socket) {
      const nextState = localStreamRef.current?.getAudioTracks()[0]
        ? localStreamRef.current.getAudioTracks()[0].enabled
        : !microphoneEnabled;
      socket.send('audio_state_changed', { enabled: nextState });
    }
  }, [socket, toggleLocalMic, microphoneEnabled]);

  const toggleCamera = useCallback(async () => {
    const newTrack = await toggleLocalCam();
    if (socket) {
      if (newTrack) {
        // Camera was just acquired — replace the null track in each PC's video sender
        peerConnections.current.forEach((pc) => {
          const videoTransceiver = pc.getTransceivers().find(
            t => t.receiver.track.kind === 'video'
          );
          if (videoTransceiver) {
            videoTransceiver.sender.replaceTrack(newTrack).catch(err =>
              console.error('Failed to replace video track:', err)
            );
          }
        });
        socket.send('video_state_changed', { enabled: true });
      } else {
        // Normal toggle — read the track's current enabled state
        const videoTrack = localStreamRef.current?.getVideoTracks()[0];
        if (videoTrack) {
          socket.send('video_state_changed', { enabled: videoTrack.enabled });
        }
        // If no video track and acquisition failed, don't send stale state
      }
    }
  }, [socket, toggleLocalCam]);

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
    remoteStreams.current.clear();

    if (meetingId && participantId) {
      api.leaveMeeting(meetingId, participantId).catch((err) => {
        console.error('Failed to leave meeting via API:', err);
      });
    }

    if (socket) {
      socket.disconnect();
    }
  }, [socket, cleanupMedia, meetingId, participantId]);

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
    meetingEnded,
    removedFromMeeting,
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
