import React, { useState, useEffect, useContext } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { UserContext } from '../../context/userContext';
import { 
  getLeaveTypes, 
  getMyLeaveBalances, 
  submitLeaveRequest, 
  getLeaveHolidays, 
  uploadLeaveDocument 
} from '../../services/leaveService';
import toast from 'react-hot-toast';
import { LuX, LuCalendar, LuPaperclip, LuInfo, LuCircleAlert, LuLoader } from 'react-icons/lu';

const ApplyLeaveModal = ({ open, onClose, onSuccess }) => {
  const { workspace } = useContext(WorkspaceContext);
  const { user } = useContext(UserContext);

  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDaySession, setHalfDaySession] = useState('morning');
  const [reason, setReason] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [documentUrl, setDocumentUrl] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [calculatedDays, setCalculatedDays] = useState(0);

  // Fetch leave types, balances, and holidays
  useEffect(() => {
    if (!open || !workspace?.id || !user?.id) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [types, myBalances, hols] = await Promise.all([
          getLeaveTypes(workspace.id),
          getMyLeaveBalances(workspace.id, user.id),
          getLeaveHolidays(workspace.id)
        ]);
        setLeaveTypes(types);
        setBalances(myBalances);
        setHolidays(hols);

        if (types.length > 0) {
          setLeaveTypeId(types[0].id);
        }
      } catch (err) {
        toast.error('Failed to load leave configuration');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [open, workspace?.id, user?.id]);

  // Selected leave type details
  const selectedType = leaveTypes.find((t) => t.id === leaveTypeId);
  const selectedBalance = balances.find((b) => b.leave_type_id === leaveTypeId);

  // Reset form when closed or loaded
  useEffect(() => {
    if (!open) {
      setLeaveTypeId('');
      setStartDate('');
      setEndDate('');
      setIsHalfDay(false);
      setHalfDaySession('morning');
      setReason('');
      setEmergencyContact('');
      setSelectedFile(null);
      setDocumentUrl('');
      setCalculatedDays(0);
    }
  }, [open]);

  // Dynamic Day Calculator
  useEffect(() => {
    if (isHalfDay) {
      setCalculatedDays(0.5);
      if (startDate) {
        setEndDate(startDate); // Sync dates for half-day
      }
      return;
    }

    if (!startDate || !endDate) {
      setCalculatedDays(0);
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      setCalculatedDays(0);
      return;
    }

    let workingDays = 0;
    const current = new Date(start);

    // Convert holiday dates to YYYY-MM-DD string array for quick lookup
    const holidayStrings = holidays.map(h => {
      // Handles timezone mismatch in Date parsing
      const d = new Date(h.date);
      return d.toISOString().split('T')[0];
    });

    while (current <= end) {
      const dayOfWeek = current.getDay();
      const dateString = current.toISOString().split('T')[0];

      // Exclude weekends (0 = Sunday, 6 = Saturday) and public holidays
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = holidayStrings.includes(dateString);

      if (!isWeekend && !isHoliday) {
        workingDays++;
      }

      current.setDate(current.getDate() + 1);
    }

    setCalculatedDays(workingDays);
  }, [startDate, endDate, isHalfDay, holidays]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadingFile(true);

    try {
      const url = await uploadLeaveDocument(file, workspace.id);
      setDocumentUrl(url);
      toast.success('Document uploaded successfully');
    } catch (err) {
      toast.error('File upload failed. Please try again.');
      console.error(err);
      setSelectedFile(null);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!startDate || !endDate) {
      toast.error('Please select both start and end dates');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) {
      toast.error('End date cannot be before start date');
      return;
    }

    if (calculatedDays === 0) {
      toast.error('The selected range has 0 working days (weekends or holidays)');
      return;
    }

    // Check document requirement
    if (selectedType?.requires_document && !documentUrl) {
      toast.error(`A supporting document is required for ${selectedType.name}`);
      return;
    }

    // Check balance limit
    if (selectedBalance && selectedBalance.total_days > 0) {
      const remaining = selectedBalance.total_days - selectedBalance.used_days - selectedBalance.pending_days;
      if (calculatedDays > remaining) {
        toast.error(`Insufficient balance. You only have ${remaining} days available.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        workspace_id: workspace.id,
        applicant_id: user.id,
        leave_type_id: leaveTypeId,
        start_date: startDate,
        end_date: endDate,
        total_days: calculatedDays,
        reason,
        document_url: documentUrl || null,
        is_half_day: isHalfDay,
        half_day_session: isHalfDay ? halfDaySession : null,
        emergency_contact: emergencyContact || null,
        status: 'pending',
      };

      await submitLeaveRequest(payload);
      toast.success('Leave application submitted successfully!');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
      <div className="card w-full max-w-lg overflow-hidden bg-white dark:bg-[#151518] dark:border-zinc-800 shadow-2xl rounded-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-zinc-850">
          <div>
            <h3 className="text-sm md:text-base font-extrabold text-slate-900 dark:text-zinc-100 uppercase tracking-wider">🌴 Submit Leave Application</h3>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wide mt-1">Apply for time off and manage your balance</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-200 cursor-pointer"
          >
            <LuX size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <LuLoader className="animate-spin text-indigo-500" size={28} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {/* Leave Type Selector */}
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-wider mb-1.5">Leave Type</label>
              <select
                value={leaveTypeId}
                onChange={(e) => {
                  setLeaveTypeId(e.target.value);
                  setSelectedFile(null);
                  setDocumentUrl('');
                }}
                className="field-input dark:bg-[#121215] dark:border-zinc-800 dark:text-zinc-200 cursor-pointer text-xs"
                required
              >
                {leaveTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>

              {/* Balance Summary Info */}
              {selectedBalance && (
                <div className="mt-2 p-3 rounded-lg flex items-center justify-between text-xs bg-slate-50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800/80">
                  <span className="font-semibold text-slate-600 dark:text-zinc-400">Available Balance:</span>
                  <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                    {selectedBalance.total_days === 0
                      ? 'Unlimited'
                      : `${selectedBalance.total_days - selectedBalance.used_days - selectedBalance.pending_days} days remaining`}
                  </span>
                </div>
              )}
            </div>

            {/* Half Day Checkbox */}
            <div className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                id="isHalfDay"
                checked={isHalfDay}
                onChange={(e) => {
                  setIsHalfDay(e.target.checked);
                  if (e.target.checked && startDate) {
                    setEndDate(startDate); // Match end date
                  }
                }}
                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="isHalfDay" className="text-xs font-bold text-slate-650 dark:text-zinc-350 cursor-pointer select-none">
                Apply for Half-Day
              </label>
            </div>

            {/* Date Pickers */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-wider mb-1.5">
                  {isHalfDay ? 'Leave Date' : 'Start Date'}
                </label>
                <div className="relative">
                  <LuCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (isHalfDay) setEndDate(e.target.value);
                    }}
                    className="field-input pl-9 dark:bg-[#121215] dark:border-zinc-800 dark:text-zinc-200 text-xs"
                    required
                  />
                </div>
              </div>

              {!isHalfDay && (
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-wider mb-1.5">End Date</label>
                  <div className="relative">
                    <LuCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="field-input pl-9 dark:bg-[#121215] dark:border-zinc-800 dark:text-zinc-200 text-xs"
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Session Selector (for Half-Day) */}
            {isHalfDay && (
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-wider mb-1.5">Session</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setHalfDaySession('morning')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      halfDaySession === 'morning'
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-750 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-400'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-[#121215] dark:border-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    🌅 Morning
                  </button>
                  <button
                    type="button"
                    onClick={() => setHalfDaySession('afternoon')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      halfDaySession === 'afternoon'
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-750 dark:bg-indigo-950/20 dark:border-indigo-900/40 dark:text-indigo-400'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-[#121215] dark:border-zinc-800 dark:text-zinc-400'
                    }`}
                  >
                    🌇 Afternoon
                  </button>
                </div>
              </div>
            )}

            {/* Duration Display Box */}
            {calculatedDays > 0 && (
              <div className="p-3 rounded-xl border border-dashed border-indigo-150 bg-indigo-50/20 dark:border-indigo-900/30 dark:bg-indigo-955/5 flex items-start gap-2.5">
                <LuInfo className="text-indigo-500 mt-0.5 flex-shrink-0" size={16} />
                <div>
                  <p className="text-xs font-bold text-indigo-750 dark:text-indigo-400">
                    Application Duration: {calculatedDays} working day{calculatedDays !== 1 ? 's' : ''}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-semibold mt-0.5">
                    * Weekends and workspace public holidays are automatically excluded from this duration.
                  </p>
                </div>
              </div>
            )}

            {/* Reason Field */}
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-wider mb-1.5">Reason for Leave</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Please describe why you are taking leave..."
                className="field-input dark:bg-[#121215] dark:border-zinc-800 dark:text-zinc-200 text-xs min-h-[80px] py-2"
                required
              />
            </div>

            {/* Emergency Contact */}
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-wider mb-1.5">Emergency Contact Details</label>
              <input
                type="text"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="Phone number, relationship, or alternative contact info..."
                className="field-input dark:bg-[#121215] dark:border-zinc-800 dark:text-zinc-200 text-xs"
              />
            </div>

            {/* Document Upload */}
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-wider mb-1.5">
                Attachment {selectedType?.requires_document && <span className="text-rose-500 font-bold">*</span>}
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-205 dark:border-zinc-800 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-850 cursor-pointer text-slate-700 dark:text-zinc-300">
                  <LuPaperclip size={13} />
                  {uploadingFile ? 'Uploading...' : 'Choose File'}
                  <input
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={uploadingFile}
                  />
                </label>
                {selectedFile && (
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-bold truncate max-w-[200px]">
                    📎 {selectedFile.name}
                  </span>
                )}
              </div>
              {selectedType?.requires_document && !documentUrl && (
                <p className="text-[10px] text-rose-500 font-bold flex items-center gap-1 mt-1.5 uppercase">
                  <LuCircleAlert size={10} /> Supporting document is required for this leave type.
                </p>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-zinc-850">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 border border-slate-200 dark:border-zinc-850 hover:bg-slate-50 dark:hover:bg-zinc-850 text-slate-700 dark:text-zinc-300 rounded-xl text-xs font-bold transition cursor-pointer"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/15 disabled:opacity-50"
                disabled={submitting || uploadingFile || (selectedType?.requires_document && !documentUrl)}
              >
                {submitting ? (
                  <>
                    <LuLoader className="animate-spin" size={14} /> Submitting...
                  </>
                ) : (
                  'Submit Application'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ApplyLeaveModal;
