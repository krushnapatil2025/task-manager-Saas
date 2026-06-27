import React, { useState, useEffect, useRef } from 'react';
import { LuPlay, LuPause } from 'react-icons/lu';

const VoiceMessageBubble = ({ fileUrl, isOwn }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);

  const parts = fileUrl?.split('||') || [];
  const audioSrc = parts[1] || parts[0];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const handleTimeUpdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    // Some browsers don't trigger loadedmetadata for webm blobs instantly
    if (audio.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioSrc]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        console.error('Audio play failed:', err);
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleProgressChange = (e) => {
    if (!audioRef.current || !duration) return;
    const val = Number(e.target.value);
    const nextTime = (val / 100) * duration;
    audioRef.current.currentTime = nextTime;
    setProgress(val);
  };

  const formatAudioTime = (time) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className={`flex items-center gap-2.5 p-3 rounded-2xl min-w-[200px] sm:min-w-[240px] border shadow-sm ${
      isOwn 
        ? 'bg-indigo-600 text-white border-indigo-700' 
        : 'bg-white text-slate-700 border-slate-200'
    }`}>
      <audio ref={audioRef} src={audioSrc} preload="metadata" />
      <button 
        onClick={togglePlay} 
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer shadow-sm transition-all hover:scale-105 active:scale-95 ${
          isOwn ? 'bg-white text-indigo-650' : 'bg-indigo-600 text-white hover:bg-indigo-700'
        }`}
      >
        {isPlaying ? (
          <LuPause size={14} />
        ) : (
          <LuPlay size={14} className={isOwn ? 'pl-0.5' : 'pl-0.5'} />
        )}
      </button>
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <input 
          type="range" 
          min="0" 
          max="100" 
          value={progress} 
          onChange={handleProgressChange}
          className={`h-1 rounded-lg appearance-none cursor-pointer w-full accent-indigo-500 ${
            isOwn ? 'bg-indigo-800' : 'bg-slate-200'
          }`}
        />
        <div className={`flex items-center justify-between text-[9px] font-semibold ${
          isOwn ? 'text-indigo-200' : 'text-slate-400'
        }`}>
          <span>{formatAudioTime(audioRef.current?.currentTime || 0)}</span>
          <span>{formatAudioTime(duration || 0)}</span>
        </div>
      </div>
    </div>
  );
};

export default VoiceMessageBubble;
