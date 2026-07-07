import React, { useState, useRef } from 'react';
import {
  LuUpload, LuFile, LuFileImage, LuTrash2,
  LuLoaderCircle, LuPaperclip, LuExternalLink,
} from 'react-icons/lu';
import { uploadTaskFile, getTaskFiles, deleteTaskFile, formatFileSize, getMimeIcon } from '../services/fileService';
import toast from 'react-hot-toast';
import FilePreviewModal from './FilePreviewModal';

// ─────────────────────────────────────────────────────────────────────────────
// TaskFileUploader — upload files to Supabase Storage and list attached files
// Props:
//   taskId, workspaceId, uploadedBy (userId)
//   files (array from parent)
//   onFilesChange (callback)
// ─────────────────────────────────────────────────────────────────────────────

const ICON_MAP = {
  image: <LuFileImage className="text-purple-500" />,
  pdf:   <LuFile className="text-red-500" />,
  excel: <LuFile className="text-green-500" />,
  word:  <LuFile className="text-blue-500" />,
  file:  <LuFile className="text-gray-400" />,
};

const TaskFileUploader = ({ taskId, workspaceId, uploadedBy, files = [], onFilesChange }) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const inputRef = useRef(null);

  const handleFiles = async (fileList) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;

    // Validate size (10 MB max per file)
    const invalid = arr.filter((f) => f.size > 10 * 1024 * 1024);
    if (invalid.length > 0) {
      toast.error('Each file must be under 10 MB');
      return;
    }

    setUploading(true);
    try {
      const results = await Promise.all(
        arr.map((f) => uploadTaskFile(f, taskId, workspaceId, uploadedBy))
      );
      toast.success(`${results.length} file${results.length > 1 ? 's' : ''} uploaded!`);
      // Reload the full file list
      const updated = await getTaskFiles(taskId);
      onFilesChange?.(updated);
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Upload failed: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (file) => {
    try {
      await deleteTaskFile(file.id, file.storagePath || file.publicUrl);
      onFilesChange?.((prev) => prev.filter((f) => f.id !== file.id));
      toast.success('File removed');
    } catch (err) {
      toast.error('Failed to remove file');
    }
  };

  return (
    <div className="mt-5">
      <div className="flex items-center gap-2 mb-3">
        <LuPaperclip className="text-gray-400 text-base" />
        <h4 className="text-sm font-semibold text-gray-700">
          Attachments <span className="text-gray-400 font-normal">({files.length})</span>
        </h4>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-2xl py-7 cursor-pointer transition-colors ${
          dragOver
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-200 bg-gray-50/60 hover:border-blue-300 hover:bg-blue-50/30'
        }`}
      >
        {uploading ? (
          <LuLoaderCircle className="text-blue-500 text-2xl animate-spin" />
        ) : (
          <LuUpload className="text-gray-400 text-2xl" />
        )}
        <p className="text-xs text-gray-500 font-medium">
          {uploading ? 'Uploading...' : 'Click or drag files here'}
        </p>
        <p className="text-[10px] text-gray-400">Max 10 MB per file</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mt-3 space-y-2">
          {files.map((f) => (
            <FileRow 
              key={f.id} 
              file={f} 
              onDelete={() => handleDelete(f)} 
              onPreview={() => setPreviewFile({ ...f, fileSizeFormatted: formatFileSize(f.fileSize) })}
            />
          ))}
        </div>
      )}

      {/* Inline File Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
};

export default TaskFileUploader;

// ─────────────────────────── File Row ────────────────────────────────────────

const FileRow = ({ file, onDelete, onPreview }) => {
  const iconType = getMimeIcon(file.mimeType || '');

  return (
    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-3 py-2.5 hover:border-blue-200 hover:shadow-sm transition group">
      <span className="text-lg flex-shrink-0">{ICON_MAP[iconType]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-800 truncate">{file.fileName}</p>
        <p className="text-[10px] text-gray-400">{formatFileSize(file.fileSize)}</p>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onPreview(); }}
          className="text-gray-400 hover:text-blue-600 text-sm cursor-pointer border-0 bg-transparent p-0 flex items-center"
          title="View File"
        >
          <LuExternalLink />
        </button>
        <button
          onClick={onDelete}
          className="text-gray-400 hover:text-red-500 text-sm"
          title="Delete File"
        >
          <LuTrash2 />
        </button>
      </div>
    </div>
  );
};
