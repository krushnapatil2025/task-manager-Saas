import React, { useState, useEffect } from 'react';
import { LuX, LuDownload, LuExternalLink } from 'react-icons/lu';

const TextPreview = ({ url }) => {
  const [text, setText] = useState('Loading content...');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load file contents');
        return res.text();
      })
      .then((data) => setText(data))
      .catch((err) => setError(err.message));
  }, [url]);

  if (error) {
    return (
      <div className="text-center p-4 bg-rose-55 text-rose-600 rounded-xl text-xs font-bold border border-rose-100 max-w-sm">
        Failed to fetch text preview: {error}
      </div>
    );
  }

  return (
    <pre className="w-full h-[60vh] bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-auto text-left whitespace-pre-wrap select-text border border-slate-800">
      {text}
    </pre>
  );
};

const FilePreviewModal = ({ file, isOpen, onClose }) => {
  if (!isOpen || !file) return null;

  const isImage = file.mimeType?.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].some(ext => file.fileName?.toLowerCase().endsWith(ext));
  const isPdf = file.mimeType === 'application/pdf' || file.fileName?.toLowerCase().endsWith('.pdf');
  const isVideo = file.mimeType?.startsWith('video/') || ['.mp4', '.webm', '.ogg', '.mov'].some(ext => file.fileName?.toLowerCase().endsWith(ext));
  const isAudio = file.mimeType?.startsWith('audio/') || ['.mp3', '.wav', '.m4a', '.ogg'].some(ext => file.fileName?.toLowerCase().endsWith(ext));
  const isText = file.mimeType?.startsWith('text/') || ['.txt', '.log', '.json', '.js', '.ts', '.css', '.html', '.md', '.xml'].some(ext => file.fileName?.toLowerCase().endsWith(ext));

  const isGoogleDrive = file.publicUrl?.includes('drive.google.com') || file.storagePath?.startsWith('google-drive:');

  const getGoogleDriveEmbedUrl = (url, storagePath) => {
    let fileId = '';
    if (storagePath && storagePath.startsWith('google-drive:')) {
      fileId = storagePath.replace('google-drive:', '');
    } else if (url) {
      const match = url.match(/[?&]id=([^&]+)/) || url.match(/\/file\/d\/([^/]+)/);
      if (match) fileId = match[1];
    }
    return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : url;
  };

  const getGoogleDriveImageUrl = (url, storagePath) => {
    let fileId = '';
    if (storagePath && storagePath.startsWith('google-drive:')) {
      fileId = storagePath.replace('google-drive:', '');
    } else if (url) {
      const match = url.match(/[?&]id=([^&]+)/) || url.match(/\/file\/d\/([^/]+)/);
      if (match) fileId = match[1];
    }
    return fileId ? `https://drive.google.com/uc?id=${fileId}&export=download` : url;
  };

  const displayUrl = isGoogleDrive 
    ? (isImage ? getGoogleDriveImageUrl(file.publicUrl, file.storagePath) : getGoogleDriveEmbedUrl(file.publicUrl, file.storagePath))
    : file.publicUrl;

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative bg-white rounded-3xl overflow-hidden shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col border border-slate-100 animate-scale-in">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="min-w-0 pr-4">
            <h3 className="text-sm font-extrabold text-slate-800 truncate">
              {file.fileName}
            </h3>
            <p className="text-[10px] text-slate-450 font-semibold mt-0.5 uppercase tracking-wider">
              {file.mimeType} • {file.fileSizeFormatted}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isGoogleDrive && (
              <a
                href={getGoogleDriveEmbedUrl(file.publicUrl, file.storagePath).replace('/preview', '/view')}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-slate-455 hover:text-indigo-650 hover:bg-indigo-50 rounded-xl transition cursor-pointer"
                title="Open in Google Drive"
              >
                <LuExternalLink size={18} />
              </a>
            )}
            <a
              href={isGoogleDrive ? getGoogleDriveImageUrl(file.publicUrl, file.storagePath) : file.publicUrl}
              download={file.fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-slate-455 hover:text-indigo-650 hover:bg-indigo-50 rounded-xl transition cursor-pointer"
              title="Download File"
            >
              <LuDownload size={18} />
            </a>
            <button
              onClick={onClose}
              className="p-2 text-slate-455 hover:text-slate-655 hover:bg-slate-50 rounded-xl transition cursor-pointer"
              title="Close Preview"
            >
              <LuX size={18} />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto bg-slate-50 flex items-center justify-center p-6 min-h-[300px]">
          {isImage ? (
            <img
              src={displayUrl}
              alt={file.fileName}
              className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-md border border-slate-200/50"
            />
          ) : (isPdf && !isGoogleDrive) ? (
            <iframe
              src={`${displayUrl}#toolbar=0`}
              title={file.fileName}
              className="w-full h-[60vh] rounded-xl border border-slate-200/50 shadow-md bg-white"
            />
          ) : isGoogleDrive ? (
            <iframe
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(getGoogleDriveImageUrl(file.publicUrl, file.storagePath))}&embedded=true`}
              title={file.fileName}
              className="w-full h-[60vh] rounded-xl border border-slate-200/50 shadow-md bg-white"
            />
          ) : isVideo ? (
            <video
              src={displayUrl}
              controls
              className="max-w-full max-h-[60vh] rounded-xl shadow-md border border-slate-200/50 bg-black"
            />
          ) : isAudio ? (
            <audio
              src={displayUrl}
              controls
              className="w-full max-w-md bg-white p-4 rounded-xl border border-slate-200/50 shadow"
            />
          ) : isText ? (
            <TextPreview url={displayUrl} />
          ) : (
            <div className="text-center p-8 bg-white rounded-2xl border border-slate-200/60 max-w-sm">
              <span className="text-4xl block mb-3">📁</span>
              <h4 className="text-sm font-extrabold text-slate-700">Preview Not Available</h4>
              <p className="text-xs text-slate-455 mt-1.5 leading-relaxed font-semibold">
                We can't render a live preview for this file type. Please download the file to view its contents.
              </p>
              <a
                href={isGoogleDrive ? getGoogleDriveImageUrl(file.publicUrl, file.storagePath) : file.publicUrl}
                download={file.fileName}
                className="inline-flex items-center gap-2 mt-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-750 px-4 py-2 rounded-xl shadow-md shadow-indigo-100 transition cursor-pointer"
              >
                <LuDownload size={14} /> Download File
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;
