import React, { useState, useEffect } from 'react';
import { reviewLeaveRequest } from '../../services/leaveService';
import LeaveTypeBadge from './LeaveTypeBadge';
import toast from 'react-hot-toast';
import { LuX, LuCalendar, LuCircleCheck, LuCircleX, LuMessageSquare, LuPaperclip, LuLoader } from 'react-icons/lu';

const ReviewLeaveModal = ({ open, request, reviewerId, onClose, onSuccess }) => {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setComment('');
    }
  }, [open]);

  if (!open || !request) return null;

  const handleReview = async (status) => {
    if (status === 'rejected' && !comment.trim()) {
      toast.error('A review comment is required when rejecting a leave request.');
      return;
    }

    setSubmitting(true);
    try {
      await reviewLeaveRequest(request.id, status, comment, reviewerId);
      toast.success(`Leave request ${status} successfully!`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to submit review');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const applicant = request.applicant || {};
  const leaveType = request.leaveType || {};
  const isPending = request.status === 'pending';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
      <div className="card w-full max-w-md overflow-hidden bg-white dark:bg-[#151518] dark:border-zinc-800 shadow-2xl rounded-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-zinc-850">
          <div>
            <h3 className="text-sm md:text-base font-extrabold text-slate-900 dark:text-zinc-100 uppercase tracking-wider">📋 Review Leave Request</h3>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wide mt-1">Make approval decision and add feedback</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 cursor-pointer"
          >
            <LuX size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Applicant Info */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-900/40 border border-slate-100 dark:border-zinc-800/80 rounded-xl">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg bg-indigo-50 text-indigo-650 dark:bg-indigo-950/20 dark:text-indigo-400 font-bold">
              {applicant.profile_image_url ? (
                <img src={applicant.profile_image_url} alt={applicant.name} className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                (applicant.name || 'U').substring(0, 2).toUpperCase()
              )}
            </div>
            <div>
              <p className="font-bold text-slate-800 dark:text-zinc-200 text-xs">
                {applicant.name}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wide mt-0.5">
                {applicant.job_profile} · {applicant.department || 'No Department'}
              </p>
            </div>
          </div>

          {/* Request Details */}
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-zinc-850">
              <span className="text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Leave Category</span>
              <LeaveTypeBadge leaveType={leaveType} />
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-zinc-850">
              <span className="text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Requested Period</span>
              <span className="font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1">
                <LuCalendar size={13} />
                {new Date(request.start_date).toLocaleDateString()} to {new Date(request.end_date).toLocaleDateString()}
              </span>
            </div>

            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-zinc-850">
              <span className="text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Total Duration</span>
              <span className="font-extrabold text-slate-800 dark:text-zinc-200 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-md">
                {request.total_days} Day{request.total_days !== 1 ? 's' : ''}
                {request.is_half_day && ` (Half-day ${request.half_day_session})`}
              </span>
            </div>

            {request.reason && (
              <div className="py-2">
                <span className="block text-[10px] font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-wider mb-1">Reason</span>
                <p className="p-3 bg-slate-50 dark:bg-[#121215] dark:border-zinc-800/80 border border-slate-100 text-slate-650 dark:text-zinc-300 rounded-lg whitespace-pre-line leading-relaxed">
                  {request.reason}
                </p>
              </div>
            )}

            {request.emergency_contact && (
              <div className="py-1">
                <span className="text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider block mb-1">Emergency Contact</span>
                <p className="text-slate-700 dark:text-zinc-300 font-semibold">{request.emergency_contact}</p>
              </div>
            )}

            {request.document_url && (
              <div className="py-1">
                <span className="text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider block mb-1">Attachment</span>
                <a 
                  href={request.document_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-indigo-100 dark:border-indigo-900 bg-indigo-50/20 text-indigo-700 dark:text-indigo-400 rounded-lg hover:underline font-bold"
                >
                  <LuPaperclip size={12} /> View Supporting Document
                </a>
              </div>
            )}
          </div>

          {/* Review Feedback Comment */}
          {isPending && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-wider flex items-center gap-1">
                <LuMessageSquare size={12} /> Reviewer Comment
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add comments or details regarding your approval or rejection..."
                className="field-input dark:bg-[#121215] dark:border-zinc-800 dark:text-zinc-200 text-xs min-h-[70px] py-2"
                required={false}
              />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-5 border-t border-slate-100 dark:border-zinc-850 bg-slate-50/50 dark:bg-zinc-900/10">
          {isPending ? (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleReview('rejected')}
                disabled={submitting}
                className="flex-1 py-2.5 border border-rose-200 dark:border-rose-900 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-955/10 dark:text-rose-455 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {submitting ? <LuLoader className="animate-spin" size={14} /> : <LuCircleX size={14} />}
                Reject
              </button>
              <button
                type="button"
                onClick={() => handleReview('approved')}
                disabled={submitting}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/15"
              >
                {submitting ? <LuLoader className="animate-spin" size={14} /> : <LuCircleCheck size={14} />}
                Approve
              </button>
            </div>
          ) : (
            <div className="text-center text-xs text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider">
              This request was {request.status} on {request.reviewed_at ? new Date(request.reviewed_at).toLocaleDateString() : 'N/A'}
              {request.reviewer?.name && ` by ${request.reviewer.name}`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewLeaveModal;
