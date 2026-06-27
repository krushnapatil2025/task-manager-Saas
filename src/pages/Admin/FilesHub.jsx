import React, { useEffect, useState, useContext, useCallback } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { UserContext } from '../../context/userContext';
import {
  getWorkspaceFiles,
  deleteTaskFile,
  formatFileSize,
} from '../../services/fileService';
import FilePreviewModal from '../../components/FilePreviewModal';
import toast from 'react-hot-toast';
import moment from 'moment';
import {
  LuFolder,
  LuSearch,
  LuLayoutGrid,
  LuList,
  LuDownload,
  LuTrash2,
  LuEye,
  LuHardDrive,
  LuLoaderCircle,
  LuFile,
  LuFileImage,
  LuFileSpreadsheet,
  LuFileText,
  LuFileUp
} from 'react-icons/lu';
import usePermissions from '../../hooks/usePermissions';
import TaskSlidePanel from '../../components/TaskSlidePanel';

const STORAGE_QUOTA = 100 * 1024 * 1024; // 100 MB Mock Storage Quota

const FilesHub = () => {
  const { workspace } = useContext(WorkspaceContext);
  const { user } = useContext(UserContext);
  const { canEditTask } = usePermissions();

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all'); // all, image, pdf, spreadsheet, other
  const [selectedUploader, setSelectedUploader] = useState('all');

  // Preview & Task slide states
  const [previewFile, setPreviewFile] = useState(null);
  const [isSlidePanelOpen, setIsSlidePanelOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  // Load Workspace Files
  const loadFiles = useCallback(async () => {
    if (!workspace?.id) return;
    setLoading(true);
    try {
      const data = await getWorkspaceFiles(workspace.id);
      setFiles(data);
    } catch (err) {
      console.error('Error loading workspace files:', err);
      toast.error('Failed to load workspace files');
    } finally {
      setLoading(false);
    }
  }, [workspace?.id]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Delete handler
  const handleDelete = async (fileId, storagePath) => {
    if (!confirm('Are you sure you want to delete this file permanently?')) return;
    try {
      await deleteTaskFile(fileId, storagePath);
      toast.success('File deleted successfully');
      loadFiles();
    } catch (err) {
      console.error('Error deleting file:', err);
      toast.error('Failed to delete file');
    }
  };

  // Calculate unique uploaders for filter dropdown
  const uploaders = Array.from(
    new Map(
      files
        .filter(f => f.uploaderId && f.uploaderName)
        .map(f => [f.uploaderId, f.uploaderName])
    ).entries()
  );

  // Filter logic
  const filteredFiles = files.filter(f => {
    // 1. Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = f.fileName?.toLowerCase().includes(q);
      const matchTask = f.taskTitle?.toLowerCase().includes(q);
      if (!matchName && !matchTask) return false;
    }

    // 2. File Type filter
    if (selectedType !== 'all') {
      const mime = f.mimeType?.toLowerCase() || '';
      if (selectedType === 'image' && !mime.startsWith('image/')) return false;
      if (selectedType === 'pdf' && mime !== 'application/pdf') return false;
      if (selectedType === 'spreadsheet' && !mime.includes('spreadsheet') && !mime.includes('excel') && !mime.includes('sheet')) return false;
      if (selectedType === 'other' && (mime.startsWith('image/') || mime === 'application/pdf' || mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('sheet'))) return false;
    }

    // 3. Uploader filter
    if (selectedUploader !== 'all' && f.uploaderId !== selectedUploader) {
      return false;
    }

    return true;
  });

  // Calculate storage usage metrics
  const totalSize = files.reduce((acc, f) => acc + (f.fileSize || 0), 0);
  const storagePercentage = Math.min((totalSize / STORAGE_QUOTA) * 100, 100);

  // Get matching icon React Component
  const getRenderIcon = (mime = '') => {
    if (mime.startsWith('image/')) return <LuFileImage className="text-emerald-500" size={24} />;
    if (mime === 'application/pdf') return <LuFileText className="text-rose-500" size={24} />;
    if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('sheet')) {
      return <LuFileSpreadsheet className="text-cyan-500" size={24} />;
    }
    return <LuFile className="text-slate-400" size={24} />;
  };

  const handleOpenTask = (taskId) => {
    if (taskId && canEditTask) {
      setSelectedTaskId(taskId);
      setIsSlidePanelOpen(true);
    }
  };

  return (
    <DashboardLayout activeMenu="Files">
      <div className="mt-4 pb-12 animate-fade-in font-sans">
        
        {/* Header Block */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-905 dark:text-zinc-105 tracking-tight flex items-center gap-2">
              📂 File Management Hub
            </h1>
            <p className="text-xs text-slate-400 dark:text-zinc-550 mt-1.5 font-bold uppercase tracking-wider">
              Browse, search, and preview all attachments uploaded across tasks
            </p>
          </div>

          {/* Storage Quota Bar */}
          <div className="card min-w-[280px]">
            <div className="flex justify-between items-center text-[10px] text-slate-450 dark:text-zinc-500 font-extrabold uppercase tracking-wider mb-2">
              <span className="flex items-center gap-1"><LuHardDrive size={12} className="text-indigo-500" /> Space Used</span>
              <span>{formatFileSize(totalSize)} of 100 MB</span>
            </div>
            <div className="w-full h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-1">
              <div
                className={`h-full bg-gradient-to-r ${storagePercentage > 85 ? 'from-rose-500 to-red-650' : 'from-indigo-650 to-violet-650'} rounded-full transition-all`}
                style={{ width: `${storagePercentage}%` }}
              />
            </div>
            <span className="text-[9px] text-slate-400 dark:text-zinc-550 font-bold tracking-tight">
              Usage: {storagePercentage.toFixed(1)}% of free tier allowance
            </span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="card p-4 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Search Input */}
            <div className="relative">
              <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search file name or task..."
                className="field-input pl-9 dark:bg-[#121215] dark:border-zinc-800/80 dark:text-zinc-200"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* File Type Filter */}
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              className="field-input dark:bg-[#121215] dark:border-zinc-800/80 dark:text-zinc-200 cursor-pointer h-auto py-2 text-xs"
            >
              <option value="all" className="dark:bg-zinc-905">All File Types</option>
              <option value="image" className="dark:bg-zinc-905">Images</option>
              <option value="pdf" className="dark:bg-zinc-905">PDF Documents</option>
              <option value="spreadsheet" className="dark:bg-zinc-905">Spreadsheets</option>
              <option value="other" className="dark:bg-zinc-905">Other formats</option>
            </select>

            {/* Uploader Filter */}
            <select
              value={selectedUploader}
              onChange={e => setSelectedUploader(e.target.value)}
              className="field-input dark:bg-[#121215] dark:border-zinc-800/80 dark:text-zinc-200 cursor-pointer h-auto py-2 text-xs"
            >
              <option value="all" className="dark:bg-zinc-905">All Uploaders</option>
              {uploaders.map(([id, name]) => (
                <option key={id} value={id} className="dark:bg-zinc-905">{name}</option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1.5 border border-slate-200 dark:border-zinc-800 p-1 rounded-xl bg-slate-50/50 dark:bg-[#121215] self-end md:self-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${viewMode === 'grid' ? 'bg-white dark:bg-zinc-800 text-indigo-650 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-zinc-700' : 'text-slate-450 hover:text-slate-655 dark:hover:text-zinc-200'}`}
              title="Grid View"
            >
              <LuLayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${viewMode === 'list' ? 'bg-white dark:bg-zinc-800 text-indigo-650 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-zinc-700' : 'text-slate-450 hover:text-slate-655 dark:hover:text-zinc-200'}`}
              title="List View"
            >
              <LuList size={15} />
            </button>
          </div>
        </div>

        {/* File List/Grid container */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <LuLoaderCircle className="text-indigo-505 text-3xl animate-spin" />
            <p className="text-xs text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider">Gathering attachments...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800/80 text-slate-350 dark:text-zinc-650 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <LuFileUp size={28} />
            </div>
            <p className="text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider text-xs">No files found.</p>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">Try clearing filters or check other workspace directories.</p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View Layout */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredFiles.map(file => (
              <div
                key={file.id}
                className="card flex flex-col group hover:-translate-y-0.5 transition-all duration-250"
              >
                {/* File Render Preview / Icon */}
                <div className="h-32 bg-slate-50 dark:bg-[#121215]/50 rounded-xl border border-slate-200/40 dark:border-zinc-800/80 flex items-center justify-center overflow-hidden mb-3 relative">
                  {file.mimeType?.startsWith('image/') ? (
                    <img
                      src={file.publicUrl}
                      alt={file.fileName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    getRenderIcon(file.mimeType)
                  )}
                  {/* Actions overlay on hover */}
                  <div className="absolute inset-0 bg-[#0c0c0e]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => setPreviewFile({ ...file, fileSizeFormatted: formatFileSize(file.fileSize) })}
                      className="p-2 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:text-indigo-650 dark:hover:text-indigo-400 rounded-xl shadow transition cursor-pointer"
                      title="Quick Preview"
                    >
                      <LuEye size={15} />
                    </button>
                    <a
                      href={file.publicUrl}
                      download={file.fileName}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 hover:text-indigo-650 dark:hover:text-indigo-400 rounded-xl shadow transition cursor-pointer"
                      title="Download"
                    >
                      <LuDownload size={15} />
                    </a>
                    <button
                      onClick={() => handleDelete(file.id, file.storagePath)}
                      className="p-2 bg-white dark:bg-zinc-800 text-slate-700 dark:text-rose-455 hover:text-rose-650 rounded-xl shadow transition cursor-pointer"
                      title="Delete"
                    >
                      <LuTrash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-slate-805 dark:text-zinc-200 truncate" title={file.fileName}>
                    {file.fileName}
                  </h4>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider mt-1.5">
                    <span>{formatFileSize(file.fileSize)}</span>
                    <span>{moment(file.createdAt).format('MMM D, YYYY')}</span>
                  </div>
                  {/* Attached Task Link */}
                  {file.taskId && (
                    <button
                      onClick={() => handleOpenTask(file.taskId)}
                      className="text-left w-full mt-2.5 pt-2.5 border-t border-slate-100 dark:border-zinc-800/80 text-[10px] font-bold text-indigo-650 dark:text-indigo-400 hover:text-indigo-850 truncate flex items-center gap-1 cursor-pointer"
                    >
                      📎 Task: <span className="underline truncate">{file.taskTitle}</span>
                    </button>
                  )}
                  {/* Uploader Label */}
                  {file.uploaderName && (
                    <div className="text-[9px] text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider mt-2">
                      Uploaded by: <span className="text-slate-600 dark:text-zinc-350 font-extrabold">{file.uploaderName}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View Layout */
          <div className="card !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-zinc-800/80 bg-slate-50/75 dark:bg-zinc-900/35 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Attached To</th>
                    <th className="px-5 py-3">Uploaded By</th>
                    <th className="px-5 py-3">Date Added</th>
                    <th className="px-5 py-3 text-right">Size</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-105 dark:divide-zinc-800/80">
                  {filteredFiles.map(file => (
                    <tr key={file.id} className="hover:bg-slate-25/50 dark:hover:bg-zinc-900/10 transition">
                      <td className="px-5 py-3.5 flex items-center gap-3 min-w-[200px]">
                        {getRenderIcon(file.mimeType)}
                        <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 truncate max-w-[240px]" title={file.fileName}>
                          {file.fileName}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        {file.taskId ? (
                          <button
                            onClick={() => handleOpenTask(file.taskId)}
                            className="text-xs font-bold text-indigo-650 dark:text-indigo-400 hover:text-indigo-850 underline cursor-pointer text-left truncate max-w-[180px]"
                          >
                            {file.taskTitle}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-zinc-500 italic">No Task</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-slate-600 dark:text-zinc-300 font-bold">
                          {file.uploaderName || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-zinc-450 font-medium">
                        {moment(file.createdAt).format('MMM D, YYYY h:mm A')}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-700 dark:text-zinc-205 font-bold text-right">
                        {formatFileSize(file.fileSize)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setPreviewFile({ ...file, fileSizeFormatted: formatFileSize(file.fileSize) })}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-indigo-650 dark:hover:text-indigo-400 rounded-lg text-slate-450 dark:text-zinc-500 transition cursor-pointer"
                            title="Quick Preview"
                          >
                            <LuEye size={14} />
                          </button>
                          <a
                            href={file.publicUrl}
                            download={file.fileName}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-indigo-650 dark:hover:text-indigo-400 rounded-lg text-slate-450 dark:text-zinc-500 transition cursor-pointer"
                            title="Download"
                          >
                            <LuDownload size={14} />
                          </a>
                          <button
                            onClick={() => handleDelete(file.id, file.storagePath)}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-zinc-800 hover:text-red-650 dark:hover:text-rose-455 rounded-lg text-slate-455 dark:text-zinc-500 transition cursor-pointer"
                            title="Delete"
                          >
                            <LuTrash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Inline Image/PDF Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
      />

      {/* Slide-over task editor */}
      <TaskSlidePanel
        taskId={selectedTaskId}
        isOpen={isSlidePanelOpen}
        onClose={() => setIsSlidePanelOpen(false)}
        onSuccess={loadFiles}
      />
    </DashboardLayout>
  );
};

export default FilesHub;
