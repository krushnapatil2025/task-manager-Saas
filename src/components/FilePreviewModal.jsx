import React from 'react';
import { LuX, LuDownload } from 'react-icons/lu';

const FilePreviewModal = ({ file, isOpen, onClose }) => {
  if (!isOpen || !file) return null;

  const isImage = file.mimeType?.startsWith('image/');
  const isPdf = file.mimeType === 'application/pdf';

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative bg-white rounded-3xl overflow-hidden shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col border border-slate-100 animate-scale-in">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="min-w-0 pr-4">
            <h3 className="text-sm font-extrabold text-slate-800 truncate">
              {file.fileName}
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5 uppercase tracking-wider">
              {file.mimeType} • {file.fileSizeFormatted}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={file.publicUrl}
              download={file.fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-slate-450 hover:text-indigo-650 hover:bg-indigo-50 rounded-xl transition cursor-pointer"
              title="Download File"
            >
              <LuDownload size={18} />
            </a>
            <button
              onClick={onClose}
              className="p-2 text-slate-450 hover:text-slate-650 hover:bg-slate-50 rounded-xl transition cursor-pointer"
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
              src={file.publicUrl}
              alt={file.fileName}
              className="max-w-full max-h-[60vh] object-contain rounded-xl shadow-md border border-slate-200/50"
            />
          ) : isPdf ? (
            <iframe
              src={`${file.publicUrl}#toolbar=0`}
              title={file.fileName}
              className="w-full h-[60vh] rounded-xl border border-slate-200/50 shadow-md bg-white"
            />
          ) : (
            <div className="text-center p-8 bg-white rounded-2xl border border-slate-200/60 max-w-sm">
              <span className="text-4xl block mb-3">📁</span>
              <h4 className="text-sm font-extrabold text-slate-700">Preview Not Available</h4>
              <p className="text-xs text-slate-450 mt-1.5 leading-relaxed font-semibold">
                We can't render a live preview for this file type. Please download the file to view its contents.
              </p>
              <a
                href={file.publicUrl}
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
