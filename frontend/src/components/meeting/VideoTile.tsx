import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, Shield } from 'lucide-react';
import { Participant } from '../../types/meeting';

interface VideoTileProps {
  participant: Participant;
  isLocal?: boolean;
}

export const VideoTile: React.FC<VideoTileProps> = ({ participant, isLocal = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      console.log(`Setting stream for tile: ${participant.display_name} (Local: ${isLocal})`);
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream, participant.display_name, isLocal]);

  // Extract initials for placeholder avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const showVideo = participant.video_enabled && participant.stream;

  return (
    <div className="relative w-full h-full bg-slate-900 rounded-2xl overflow-hidden shadow-lg border border-slate-800 flex items-center justify-center group aspect-video">
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal} // Critical: always mute local audio to prevent echo loopback
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          showVideo ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
        }`}
      />

      {/* Avatar Placeholder when video is disabled */}
      {!showVideo && (
        <div className="flex flex-col items-center justify-center text-center p-4 select-none">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-2xl font-semibold shadow-md animate-pulse">
            {getInitials(participant.display_name)}
          </div>
          <span className="mt-3 text-slate-400 text-sm font-medium">Camera Disabled</span>
        </div>
      )}

      {/* Mic Status Indicator overlay */}
      <div className="absolute top-3 right-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1.5 rounded-full flex items-center justify-center text-white text-xs border border-slate-800 shadow-sm z-10">
        {participant.audio_enabled ? (
          <Mic className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <MicOff className="w-3.5 h-3.5 text-rose-500" />
        )}
      </div>

      {/* Participant Info overlay */}
      <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2 text-white text-sm font-medium border border-slate-800 shadow-sm max-w-[85%] truncate z-10">
        {participant.is_host && (
          <Shield className="w-4 h-4 text-amber-400 fill-amber-400/20 shrink-0" />
        )}
        <span className="truncate">
          {participant.display_name} {isLocal ? '(You)' : ''}
        </span>
      </div>
    </div>
  );
};
export default VideoTile;
