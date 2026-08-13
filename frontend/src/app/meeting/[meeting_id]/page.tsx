"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Monitor, 
  PhoneOff, 
  MessageSquare, 
  Users, 
  ShieldAlert, 
  RefreshCw,
  LogOut,
  AlertCircle,
  Info
} from 'lucide-react';

import { useWebRTC } from '../../../hooks/useWebRTC';
import { useToast } from '../../../components/common/Toast';
import { VideoTile } from '../../../components/meeting/VideoTile';
import { ChatPanel } from '../../../components/meeting/ChatPanel';
import { Participant } from '../../../types/meeting';
import { api } from '../../../lib/api';

export default function MeetingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const meetingId = params?.meeting_id as string;
  const isDemoHost = searchParams?.get('demo_user') === 'alex';

  // Lobby state
  const [joined, setJoined] = useState(false);
  const [displayName, setDisplayName] = useState(isDemoHost ? 'Alex Johnson' : '');
  const [isHostCheck, setIsHostCheck] = useState(isDemoHost);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Participant session details
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<number | null>(null);
  const [isHost, setIsHost] = useState(false);

  // UI state
  const [showChat, setShowChat] = useState(true);
  const [showParticipantsList, setShowParticipantsList] = useState(false);
  const [showInfoPopover, setShowInfoPopover] = useState(false);

  // Auto check for host parameters from URL (e.g. ?demo_user=alex)
  useEffect(() => {
    if (isDemoHost) {
      const timer = setTimeout(() => {
        setIsHostCheck(true);
        setDisplayName('Alex Johnson');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isDemoHost]);

  // Hook orchestration
  const {
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
  } = useWebRTC(
    joined ? meetingId : null,
    joined ? sessionId : null,
    joined ? participantId : null
  );

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    setLoading(true);
    setErrorText(null);

    // Generate unique session id
    const newSessionId = 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    try {
      // REST: Join API using centralized client
      const data = await api.joinMeeting(meetingId, displayName.trim(), newSessionId, isHostCheck);

      // Initialize media capturing before establishing socket connection
      await initLocalMedia();
      
      setSessionId(newSessionId);
      setParticipantId(data.participant_id);
      setIsHost(data.is_host);
      setJoined(true);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Server connection failed. Make sure the backend Django server is running.';
      setErrorText(msg);
      setLoading(false);
    }
  };

  const handleExit = () => {
    leaveMeeting();
    router.push('/');
  };

  const handleEnd = () => {
    hostEndMeeting();
    router.push('/');
  };

  const getConnectionStateBadge = () => {
    switch (connectionState) {
      case 'connected':
        return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded text-xs font-semibold uppercase flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>Connected</span>;
      case 'connecting':
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 rounded text-xs font-semibold uppercase flex items-center gap-1.5 animate-pulse"><span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>Connecting</span>;
      case 'reconnecting':
        return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-1 rounded text-xs font-semibold uppercase flex items-center gap-1.5 animate-pulse"><RefreshCw className="w-3.5 h-3.5 animate-spin" />Reconnecting</span>;
      default:
        return <span className="bg-slate-500/10 text-slate-400 border border-slate-500/20 px-2 py-1 rounded text-xs font-semibold uppercase flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>Disconnected</span>;
    }
  };

  // If meeting ended, render Ended screen
  if (meetingEnded) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 font-sans">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 text-center animate-fade-in">
          <div className="mx-auto w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500">
            <PhoneOff className="w-8 h-8" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">This meeting has ended</h1>
            <p className="text-slate-450 text-sm">
              Your meeting was ended by the host or all participants have left.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800 flex flex-col gap-3">
            <button
              onClick={() => router.push(`/meetings`)}
              className="w-full bg-slate-800 hover:bg-slate-750 text-white font-bold py-3 rounded-xl transition-all text-sm uppercase tracking-wider"
            >
              View Meeting Details
            </button>
            <button
              onClick={() => router.push(`/`)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all text-sm shadow-md uppercase tracking-wider"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (removedFromMeeting) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 font-sans">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 text-center animate-fade-in">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-white">You were removed from this meeting</h1>
            <p className="text-slate-450 text-sm">
              The host removed you from the room.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <button
              onClick={() => router.push(`/`)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all text-sm shadow-md uppercase tracking-wider"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If not joined, render Pre-Join lobby screen
  if (!joined) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">Join Meeting Lobby</h1>
            <p className="text-slate-400 text-sm">Meeting ID: <span className="font-semibold text-indigo-400">{meetingId}</span></p>
          </div>

          {errorText && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-4 rounded-xl text-sm flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <span>{errorText}</span>
            </div>
          )}

          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="displayName" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Display Name</label>
              <input
                id="displayName"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter display name"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 bg-slate-950 border border-slate-800 rounded-xl">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">Join as Host (Alex Johnson)</span>
                <span className="text-xs text-slate-500">Mocks authenticated owner rights</span>
              </div>
              <input
                type="checkbox"
                checked={isHostCheck}
                onChange={(e) => {
                  setIsHostCheck(e.target.checked);
                  if (e.target.checked) setDisplayName('Alex Johnson');
                }}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-800 bg-slate-950 cursor-pointer"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !displayName.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors shadow-md text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Joining Room...</span>
                </>
              ) : (
                <span>Join Meeting</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Active meeting screen
  const localParticipant: Participant = {
    id: participantId || 0,
    session_id: sessionId || '',
    display_name: displayName || '',
    is_host: isHost,
    audio_enabled: microphoneEnabled,
    video_enabled: cameraEnabled,
    stream: localStream,
    is_local: true
  };

  const getGridClasses = (count: number) => {
    if (count === 1) return "max-w-4xl mx-auto w-full aspect-video";
    if (count === 2) return "grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto w-full";
    if (count === 3) return "grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto w-full";
    if (count === 4) return "grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto w-full";
    return "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto w-full";
  };

  const totalTiles = [localParticipant, ...remoteParticipants];

  return (
    <div className="h-screen bg-slate-950 flex flex-col text-slate-100 overflow-hidden font-sans">
      
      {/* 1. Header Bar */}
      <header className="h-16 px-6 bg-slate-900 border-b border-slate-850 flex items-center justify-between shrink-0 relative">
        <div className="flex flex-col">
          <h1 className="text-white font-bold text-base leading-tight flex items-center gap-2">
            <span>{meetingDetails?.title || 'Video Conference'}</span>
            <button
              type="button"
              onClick={() => setShowInfoPopover(!showInfoPopover)}
              className={`p-1 rounded-md transition-colors flex items-center justify-center ${
                showInfoPopover ? 'bg-slate-800 text-indigo-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Meeting Information"
            >
              <Info className="w-4 h-4" />
            </button>
          </h1>
          <span className="text-slate-500 text-xs font-medium">ID: {meetingId}</span>
        </div>
        <div className="flex items-center gap-4">
          {getConnectionStateBadge()}
          {permissionError && (
            <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-1 rounded text-xs font-semibold uppercase flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              {permissionError.replace('_', ' ')}
            </span>
          )}
        </div>
      </header>

      {/* Info Popover Overlay */}
      {showInfoPopover && meetingDetails && (
        <div className="absolute top-16 left-6 w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 z-50 text-xs space-y-4 animate-fade-in">
          <div className="border-b border-slate-800 pb-2.5">
            <h3 className="text-sm font-extrabold text-white">{meetingDetails.title}</h3>
            {meetingDetails.description && (
              <p className="text-slate-400 mt-1 leading-relaxed">{meetingDetails.description}</p>
            )}
          </div>
          
          <div className="space-y-3 text-slate-350">
            <div className="grid grid-cols-3">
              <span className="text-slate-500 font-semibold">Meeting ID</span>
              <span className="col-span-2 text-slate-200 select-all font-mono">{meetingDetails.meeting_id}</span>
            </div>
            <div className="grid grid-cols-3">
              <span className="text-slate-500 font-semibold">Host</span>
              <span className="col-span-2 text-slate-200">{meetingDetails.host ? meetingDetails.host.name : 'Alex Johnson'}</span>
            </div>
            <div className="grid grid-cols-3">
              <span className="text-slate-500 font-semibold">Invite Link</span>
              <span className="col-span-2 text-slate-200 select-all font-mono truncate" title={meetingDetails.invite_link}>
                {meetingDetails.invite_link}
              </span>
            </div>
            {meetingDetails.duration_minutes && (
              <div className="grid grid-cols-3">
                <span className="text-slate-500 font-semibold">Duration</span>
                <span className="col-span-2 text-slate-200">{meetingDetails.duration_minutes} minutes</span>
              </div>
            )}
          </div>
          
          <div className="pt-2 border-t border-slate-800 flex gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(meetingDetails.meeting_id);
                showToast('Copied Meeting ID', 'success');
              }}
              className="flex-1 bg-slate-800 hover:bg-slate-750 text-white font-bold py-1.5 px-3 rounded-lg transition-colors text-center"
            >
              Copy ID
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(meetingDetails.invite_link);
                showToast('Copied Invite Link', 'success');
              }}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-lg transition-colors text-center"
            >
              Copy Link
            </button>
          </div>
        </div>
      )}

      {/* 2. Main Area (Grid + panels) */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Video Grid container */}
        <div className="flex-1 p-6 flex flex-col justify-center items-center overflow-y-auto">
          <div className={getGridClasses(totalTiles.length)}>
            {totalTiles.map((p) => (
              <div key={p.session_id} className="relative aspect-video w-full h-full animate-fade-in">
                <VideoTile participant={p} isLocal={p.is_local} />
                
                {/* Host specific kick controls on remote tiles */}
                {isHost && !p.is_local && (
                  <button
                    onClick={() => hostKickParticipant(p.id, p.session_id)}
                    className="absolute top-3 left-3 bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-bold z-20 border border-rose-700 transition-colors shadow-md uppercase tracking-wider"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Dynamic side panels */}
        {showParticipantsList && (
          <div className="w-64 bg-slate-900 border-l border-slate-800 p-4 flex flex-col shrink-0">
            <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider text-slate-400">Participants ({totalTiles.length})</h2>
            <div className="flex-1 overflow-y-auto space-y-3">
              {totalTiles.map((p) => (
                <div key={p.session_id} className="flex items-center justify-between text-sm py-1">
                  <div className="flex items-center gap-2 max-w-[70%] truncate">
                    {p.is_host && <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    <span className="truncate">{p.display_name} {p.is_local ? '(You)' : ''}</span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {p.audio_enabled ? 'Unmuted' : 'Muted'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {showChat && (
          <ChatPanel 
            messages={chatMessages} 
            currentSessionId={sessionId || ''} 
            onSendMessage={sendChatMessage} 
          />
        )}
      </div>

      {/* 3. Toolbar Control Bar */}
      <footer className="h-20 bg-slate-900 border-t border-slate-850 px-6 flex items-center justify-between shrink-0">
        
        {/* Left indicators */}
        <div className="flex items-center gap-3 w-1/4">
          <button
            onClick={() => setShowParticipantsList(!showParticipantsList)}
            className={`p-2.5 rounded-xl border transition-colors flex items-center justify-center ${
              showParticipantsList 
                ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' 
                : 'bg-slate-800 border-slate-800 text-slate-400 hover:bg-slate-750'
            }`}
            title="Toggle Participants Panel"
          >
            <Users className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-2.5 rounded-xl border transition-colors flex items-center justify-center ${
              showChat 
                ? 'bg-indigo-600/10 border-indigo-500 text-indigo-400' 
                : 'bg-slate-800 border-slate-800 text-slate-400 hover:bg-slate-750'
            }`}
            title="Toggle Chat Panel"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>

        {/* Center Media Toggles */}
        <div className="flex items-center gap-4 justify-center">
          {/* Audio toggle */}
          <button
            onClick={toggleMicrophone}
            className={`p-3.5 rounded-full border transition-all shadow-md flex items-center justify-center ${
              microphoneEnabled 
                ? 'bg-slate-800 border-slate-800 text-slate-300 hover:bg-slate-750' 
                : 'bg-rose-600 border-rose-600 text-white hover:bg-rose-700'
            }`}
            title={microphoneEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {microphoneEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          {/* Video toggle */}
          <button
            onClick={toggleCamera}
            className={`p-3.5 rounded-full border transition-all shadow-md flex items-center justify-center ${
              cameraEnabled 
                ? 'bg-slate-800 border-slate-800 text-slate-300 hover:bg-slate-750' 
                : 'bg-rose-600 border-rose-600 text-white hover:bg-rose-700'
            }`}
            title={cameraEnabled ? 'Disable Camera' : 'Enable Camera'}
          >
            {cameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          {/* Screen Share toggle */}
          <button
            onClick={screenSharing ? stopScreenShare : startScreenShare}
            className={`p-3.5 rounded-full border transition-all shadow-md flex items-center justify-center ${
              screenSharing 
                ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700' 
                : 'bg-slate-800 border-slate-800 text-slate-300 hover:bg-slate-750'
            }`}
            title={screenSharing ? 'Stop Screen Share' : 'Start Screen Share'}
          >
            <Monitor className="w-5 h-5" />
          </button>
        </div>

        {/* Right Exit / Host controls */}
        <div className="flex items-center gap-3 w-1/4 justify-end">
          {/* Host Mute All button */}
          {isHost && (
            <button
              onClick={hostMuteAll}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-4 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-sm uppercase tracking-wider"
            >
              Mute All
            </button>
          )}

          {/* Leave/End buttons */}
          {isHost ? (
            <button
              onClick={handleEnd}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold px-4 py-2.5 rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-sm uppercase tracking-wider"
            >
              <LogOut className="w-4 h-4" />
              <span>End Meeting</span>
            </button>
          ) : (
            <button
              onClick={handleExit}
              className="bg-slate-800 hover:bg-slate-750 text-rose-500 font-semibold px-4 py-2.5 rounded-xl text-xs border border-rose-500/10 transition-colors flex items-center gap-1.5 shadow-sm uppercase tracking-wider"
            >
              <PhoneOff className="w-4 h-4" />
              <span>Leave</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
