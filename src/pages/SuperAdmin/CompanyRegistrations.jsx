import React, { useEffect, useState, useCallback } from 'react';
import { getAllWorkspaces, reviewCompanyRegistration } from '../../services/superAdminService';
import { sendApprovalEmail } from '../../services/companyApprovalEmailService';
import {
  LuBuilding2, LuUsers, LuClock, LuCircleCheck, LuCircleX, LuTriangleAlert,
  LuLoaderCircle, LuSearch, LuFilter, LuEye, LuCheck, LuX, LuMail, LuPhone,
  LuLayoutGrid, LuList, LuDownload, LuChevronRight, LuCalendar
} from 'react-icons/lu';
import moment from 'moment';
import toast from 'react-hot-toast';

const STATUS_FILTERS = [
  { value: null, label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'restricted', label: 'Restricted' },
];

const STATUS_BADGE = {
  pending:    'text-amber-400 bg-amber-500/10 border border-amber-500/20',
  approved:   'text-green-400 bg-green-500/10 border border-green-500/20',
  rejected:   'text-rose-400 bg-rose-500/10 border border-rose-500/20',
  restricted: 'text-red-400 bg-red-500/10 border border-red-500/20',
};

const CompanyRegistrations = () => {
  const [registrations, setRegistrations] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState('pending'); // default to pending for queue
  const [selectedReg,   setSelectedReg]   = useState(null); // for detail modal
  const [reviewAction,  setReviewAction]  = useState(null); // { regs: [...], action: 'approve' | 'reject' | 'restrict' }
  const [note,          setNote]          = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [viewMode,      setViewMode]      = useState('table'); // 'table' | 'card'
  const [selectedIds,   setSelectedIds]   = useState([]); // for bulk actions

  const load = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch all to calculate accurate stats bar count, then filter client-side
      const data = await getAllWorkspaces(null, '', null);
      setRegistrations(data);
    } catch (err) {
      toast.error('Failed to load registrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Client-side filtering to search across multiple fields
  const filteredRegs = registrations.filter((reg) => {
    const status = reg.approval_status || 'pending';
    const matchesStatus = !statusFilter || status === statusFilter;
    const searchLower = search.toLowerCase();
    const matchesSearch = 
      reg.name?.toLowerCase().includes(searchLower) ||
      reg.owner_email?.toLowerCase().includes(searchLower) ||
      reg.company_industry?.toLowerCase().includes(searchLower);
    
    return matchesStatus && matchesSearch;
  });

  // Calculate statistics counts based on raw loaded registrations
  const stats = {
    total:      registrations.length,
    pending:    registrations.filter(r => (r.approval_status || 'pending') === 'pending').length,
    approved:   registrations.filter(r => (r.approval_status || 'pending') === 'approved').length,
    rejected:   registrations.filter(r => (r.approval_status || 'pending') === 'rejected').length,
    restricted: registrations.filter(r => (r.approval_status || 'pending') === 'restricted').length,
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewAction || reviewAction.regs.length === 0) return;

    const { regs, action } = reviewAction;
    
    // Validate note for rejection or restriction
    if (action !== 'approve' && !note.trim()) {
      toast.error('Please provide a reason note for this decision.');
      return;
    }

    setActionLoading(true);
    const resolvedStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'restricted';

    try {
      for (const reg of regs) {
        // 1. Update database status via RPC (returns enriched company details)
        let result = null;
        try {
          result = await reviewCompanyRegistration(reg.id, resolvedStatus, note);
          console.log('[SA Review] RPC result for', reg.name, '→', resolvedStatus, ':', result);
        } catch (rpcErr) {
          console.error('RPC reviewCompanyRegistration failed:', rpcErr);
          throw rpcErr;
        }

        // 2. Send email — always use reg (guaranteed to have data) enriched by RPC result
        // Use || with trim() so empty strings ("") also fall through to the next value
        const bestCompanyName =
          (result?.company_name?.trim())   ||
          (reg.company_name?.trim())       ||
          (reg.name?.trim())               ||
          'Your Company';

        const emailPayload = {
          toEmail:       reg.owner_email,
          toName:        result?.owner_name?.trim()  || reg.owner_name || 'Administrator',
          companyName:   bestCompanyName,
          adminName:     result?.owner_name?.trim()  || reg.owner_name || 'Administrator',
          industry:      result?.company_industry    || reg.company_industry || '',
          size:          result?.company_size        || reg.company_size     || '',
          phone:         result?.owner_phone         || reg.owner_phone      || '',
          workspaceSlug: result?.workspace_slug      || reg.slug             || '',
          status:        resolvedStatus,
          reason:        note,
          appUrl:        window.location.origin,
        };

        console.log('[SA Review] Sending email payload:', emailPayload);

        if (emailPayload.toEmail) {
          try {
            const sent = await sendApprovalEmail(emailPayload);
            if (!sent) {
              console.warn('Email dispatch returned false for', emailPayload.toEmail);
              toast.error(`Decision saved but email to ${emailPayload.toEmail} may not have been delivered. Check your Brevo API key.`);
            }
          } catch (emailErr) {
            console.error('Failed to send decision notification email:', emailErr);
            toast.error('Decision saved, but email delivery failed: ' + emailErr.message);
          }
        } else {
          console.warn('No owner_email found for workspace', reg.id, '— email skipped.');
          toast('Decision saved. No email address found for this company — notification skipped.', { icon: '⚠️' });
        }
      }

      toast.success(`Successfully marked ${regs.length} workspace(s) as ${resolvedStatus.toUpperCase()}`);
      setReviewAction(null);
      setSelectedReg(null);
      setSelectedIds([]);
      setNote('');
      load();
    } catch (err) {
      toast.error('Failed to review registration: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk actions triggers
  const handleBulkApprove = () => {
    const selectedRegs = registrations.filter(r => selectedIds.includes(r.id));
    setReviewAction({ regs: selectedRegs, action: 'approve' });
  };

  const handleBulkReject = () => {
    const selectedRegs = registrations.filter(r => selectedIds.includes(r.id));
    setReviewAction({ regs: selectedRegs, action: 'reject' });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredRegs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRegs.map(r => r.id));
    }
  };

  const handleToggleSelectOne = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // CSV Exporter
  const handleExportCSV = () => {
    if (filteredRegs.length === 0) {
      toast.error('No data to export.');
      return;
    }

    const headers = ['Company Name', 'Slug', 'Owner Name', 'Owner Email', 'Owner Phone', 'Industry', 'Size', 'Status', 'Registered Date', 'Review Note'];
    const rows = filteredRegs.map(r => [
      r.name,
      r.slug,
      r.owner_name || '',
      r.owner_email || '',
      r.owner_phone || '',
      r.company_industry || '',
      r.company_size || '',
      r.approval_status || 'pending',
      moment(r.created_at).format('YYYY-MM-DD HH:mm:ss'),
      r.approval_note || ''
    ]);

    const csvContent = 
      'data:text/csv;charset=utf-8,' + 
      [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `company_registrations_${moment().format('YYYYMMDD')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV report downloaded!');
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-fade-in">
      
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50 border border-slate-800/80 p-6 rounded-2xl">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <LuBuilding2 className="text-indigo-400" /> Company Approvals
          </h1>
          <p className="text-slate-400 text-xs mt-1">Review, approve, and authorize onboarding requests for new organizational workspaces</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-850 hover:bg-slate-800 active:scale-95 text-xs text-white font-bold rounded-xl border border-slate-800 transition cursor-pointer"
          >
            <LuDownload size={13} /> Export Report
          </button>
        </div>
      </div>

      {/* Stats Counters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Requests', value: stats.total, color: 'from-slate-800 to-slate-900', text: 'text-white' },
          { label: 'Pending Queue', value: stats.pending, color: 'from-amber-950/40 to-amber-900/10 border-amber-500/20', text: 'text-amber-400' },
          { label: 'Approved', value: stats.approved, color: 'from-emerald-950/40 to-emerald-900/10 border-emerald-500/20', text: 'text-emerald-400' },
          { label: 'Rejected', value: stats.rejected, color: 'from-rose-950/40 to-rose-900/10 border-rose-500/20', text: 'text-rose-400' },
          { label: 'Restricted', value: stats.restricted, color: 'from-red-950/40 to-red-900/10 border-red-500/20', text: 'text-red-400' },
        ].map((s, idx) => (
          <div key={idx} className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-xl flex flex-col justify-center">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{s.label}</span>
            <span className={`text-2xl font-black mt-1 ${s.text}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies by name, email, or industry..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-700 transition"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-850 p-1.5 rounded-xl">
            <span className="text-[10px] text-slate-500 font-bold px-2 uppercase">Status</span>
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value ?? 'all'}
                onClick={() => { setStatusFilter(filter.value); setSelectedIds([]); }}
                className={`text-[10px] font-black px-3 py-1.5 rounded-lg border transition capitalize cursor-pointer ${
                  statusFilter === filter.value
                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    : 'bg-transparent text-slate-400 border-transparent hover:text-white'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* View Toggler */}
          <div className="flex items-center bg-slate-900/60 border border-slate-850 p-1.5 rounded-xl gap-1">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${viewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-350'}`}
              title="Table view"
            >
              <LuList size={14} />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${viewMode === 'card' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-350'}`}
              title="Grid card view"
            >
              <LuLayoutGrid size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-xl">
          <span className="text-xs text-indigo-350 font-bold">
            {selectedIds.length} registration(s) selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkApprove}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg cursor-pointer transition"
            >
              <LuCheck size={12} /> Bulk Approve
            </button>
            <button
              onClick={handleBulkReject}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg cursor-pointer transition"
            >
              <LuX size={12} /> Bulk Reject
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold rounded-lg cursor-pointer transition"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Content List */}
      {loading ? (
        <div className="flex justify-center py-24">
          <LuLoaderCircle className="text-red-500 text-3xl animate-spin" />
        </div>
      ) : filteredRegs.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
          <LuBuilding2 className="text-slate-700 text-4xl mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No registrations match your search criteria.</p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 bg-slate-950/30">
                  <th className="px-5 py-4 w-12 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filteredRegs.length}
                      onChange={handleToggleSelectAll}
                      className="rounded border-slate-800 bg-slate-950 text-indigo-500 focus:ring-indigo-500/20 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4">Company Name</th>
                  <th className="px-6 py-4">Admin Owner</th>
                  <th className="px-6 py-4">Industry / Size</th>
                  <th className="px-6 py-4">Registered Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850/60">
                {filteredRegs.map((reg) => (
                  <tr key={reg.id} className="hover:bg-slate-900/40 transition group">
                    {/* Checkbox select */}
                    <td className="px-5 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(reg.id)}
                        onChange={() => handleToggleSelectOne(reg.id)}
                        className="rounded border-slate-800 bg-slate-950 text-indigo-500 focus:ring-indigo-500/20 cursor-pointer"
                      />
                    </td>

                    {/* Company details */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {reg.logo_url ? (
                          <img src={reg.logo_url} className="w-9 h-9 rounded-xl object-cover border border-slate-850" alt="" />
                        ) : (
                          <div 
                            style={{ backgroundColor: reg.brand_color || '#3b82f6' }}
                            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-inner"
                          >
                            <span className="text-white text-xs font-black">{reg.name?.[0]?.toUpperCase()}</span>
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-100 text-sm">{reg.name}</p>
                          <p className="text-[10px] text-slate-500">Slug: {reg.slug}</p>
                        </div>
                      </div>
                    </td>

                    {/* Owner profile */}
                    <td className="px-6 py-4">
                      <p className="text-slate-350 text-xs font-bold">{reg.owner_name || '—'}</p>
                      <p className="text-slate-500 text-[10px] flex items-center gap-1.5 mt-0.5">
                        <LuMail size={11} className="text-slate-600" /> {reg.owner_email}
                      </p>
                    </td>

                    {/* Size and domain info */}
                    <td className="px-6 py-4 text-xs font-semibold text-slate-450">
                      <p className="text-slate-350">{reg.company_industry || '—'}</p>
                      <p className="text-[10px] text-slate-550 mt-0.5">{reg.company_size ? `${reg.company_size} Employees` : '—'}</p>
                    </td>

                    {/* Joined timestamp */}
                    <td className="px-6 py-4 text-[10px] text-slate-550 font-semibold">
                      {moment(reg.created_at).format('DD MMM YYYY')}
                      <span className="block text-[8px] text-slate-600 mt-0.5">{moment(reg.created_at).fromNow()}</span>
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4">
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border capitalize tracking-wider ${STATUS_BADGE[reg.approval_status || 'pending']}`}>
                        {reg.approval_status || 'pending'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedReg(reg)}
                          className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-750 hover:border-slate-650 rounded-xl transition cursor-pointer"
                          title="View Details"
                        >
                          <LuEye size={13} />
                        </button>

                        {/* Approve: available for pending, rejected, restricted */}
                        {(reg.approval_status === 'pending' || reg.approval_status === 'rejected' || reg.approval_status === 'restricted') && (
                          <button
                            onClick={() => setReviewAction({ regs: [reg], action: 'approve' })}
                            className="p-2 text-green-400 hover:text-white bg-green-500/5 hover:bg-green-600/20 border border-green-500/10 hover:border-green-500/30 rounded-xl transition cursor-pointer"
                            title="Approve registration"
                          >
                            <LuCheck size={13} />
                          </button>
                        )}

                        {/* Reject: available for pending only */}
                        {reg.approval_status === 'pending' && (
                          <button
                            onClick={() => setReviewAction({ regs: [reg], action: 'reject' })}
                            className="p-2 text-rose-400 hover:text-white bg-rose-500/5 hover:bg-rose-600/20 border border-rose-500/10 hover:border-rose-500/30 rounded-xl transition cursor-pointer"
                            title="Reject registration"
                          >
                            <LuX size={13} />
                          </button>
                        )}

                        {/* Restrict: available for pending and approved */}
                        {(reg.approval_status === 'pending' || reg.approval_status === 'approved') && (
                          <button
                            onClick={() => setReviewAction({ regs: [reg], action: 'restrict' })}
                            className="p-2 text-amber-400 hover:text-white bg-amber-500/5 hover:bg-amber-600/20 border border-amber-500/10 hover:border-amber-500/30 rounded-xl transition cursor-pointer"
                            title="Restrict access"
                          >
                            <LuTriangleAlert size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card grid view */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRegs.map((reg) => (
            <div key={reg.id} className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-4 hover:border-slate-700 transition relative group">
              <div className="absolute top-4 right-4">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(reg.id)}
                  onChange={() => handleToggleSelectOne(reg.id)}
                  className="rounded border-slate-800 bg-slate-950 text-indigo-500 focus:ring-indigo-500/20 cursor-pointer"
                />
              </div>

              {/* Branding header */}
              <div className="flex items-center gap-3">
                {reg.logo_url ? (
                  <img src={reg.logo_url} className="w-10 h-10 rounded-xl object-cover border border-slate-855" alt="" />
                ) : (
                  <div 
                    style={{ backgroundColor: reg.brand_color || '#3b82f6' }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-inner"
                  >
                    {reg.name?.[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">{reg.name}</h3>
                  <span className={`inline-block text-[8px] font-black px-2 py-0.5 rounded-full border capitalize tracking-wider mt-1 ${STATUS_BADGE[reg.approval_status || 'pending']}`}>
                    {reg.approval_status || 'pending'}
                  </span>
                </div>
              </div>

              {/* Details table */}
              <div className="space-y-1.5 text-[11px] text-slate-400 bg-slate-950/20 border border-slate-850 p-3 rounded-xl">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold uppercase">Owner</span>
                  <span className="text-slate-200 font-bold">{reg.owner_name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold uppercase">Email</span>
                  <span className="text-slate-250 truncate max-w-[150px]">{reg.owner_email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold uppercase">Industry</span>
                  <span className="text-slate-200 font-bold capitalize">{reg.company_industry || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold uppercase">Size</span>
                  <span className="text-slate-200 font-bold">{reg.company_size || '—'} Employees</span>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-850/60">
                <span className="text-[9px] text-slate-500 font-semibold">
                  Registered {moment(reg.created_at).fromNow()}
                </span>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedReg(reg)}
                    className="p-1.5 text-slate-400 hover:text-white bg-slate-850 hover:bg-slate-800 rounded-lg transition cursor-pointer text-xs font-bold"
                  >
                    View
                  </button>

                  {/* Approve */}
                  {(reg.approval_status === 'pending' || reg.approval_status === 'rejected' || reg.approval_status === 'restricted') && (
                    <button
                      onClick={() => setReviewAction({ regs: [reg], action: 'approve' })}
                      className="p-1.5 text-green-400 hover:text-white bg-green-500/10 hover:bg-green-600 rounded-lg transition cursor-pointer"
                      title="Approve"
                    >
                      <LuCheck size={13} />
                    </button>
                  )}

                  {/* Reject */}
                  {reg.approval_status === 'pending' && (
                    <button
                      onClick={() => setReviewAction({ regs: [reg], action: 'reject' })}
                      className="p-1.5 text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 rounded-lg transition cursor-pointer"
                      title="Reject"
                    >
                      <LuX size={13} />
                    </button>
                  )}

                  {/* Restrict */}
                  {(reg.approval_status === 'pending' || reg.approval_status === 'approved') && (
                    <button
                      onClick={() => setReviewAction({ regs: [reg], action: 'restrict' })}
                      className="p-1.5 text-amber-400 hover:text-white bg-amber-500/10 hover:bg-amber-600 rounded-lg transition cursor-pointer"
                      title="Restrict"
                    >
                      <LuTriangleAlert size={13} />
                    </button>
                  )}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* ── EXPANDED DETAIL VIEW WITH TIMELINE ── */}
      {selectedReg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-2xl relative">
            <button 
              onClick={() => setSelectedReg(null)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition cursor-pointer"
            >
              <LuX size={18} />
            </button>

            <h3 className="text-sm font-black text-white mb-5 uppercase tracking-wider flex items-center gap-2">
              <LuBuilding2 className="text-indigo-400" />
              Company Workspace Audit
            </h3>

            <div className="space-y-5">
              {/* Header Branding */}
              <div className="flex items-center gap-3 p-3 bg-slate-950/40 border border-slate-850 rounded-xl">
                {selectedReg.logo_url ? (
                  <img src={selectedReg.logo_url} className="w-12 h-12 rounded-xl object-cover" alt="" />
                ) : (
                  <div 
                    style={{ backgroundColor: selectedReg.brand_color || '#3b82f6' }}
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-black shadow-inner"
                  >
                    {selectedReg.name?.[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-black text-white">{selectedReg.name}</h4>
                  <p className="text-[9px] text-slate-550 font-mono mt-0.5">ID: {selectedReg.id}</p>
                </div>
              </div>

              {/* Detail fields */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                  <span className="text-slate-500 font-bold block mb-1 uppercase text-[9px]">Admin Owner</span>
                  <span className="text-slate-200 font-extrabold block">{selectedReg.owner_name || '—'}</span>
                  <span className="text-slate-500 text-[10px] block truncate">{selectedReg.owner_email}</span>
                </div>
                <div className="p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                  <span className="text-slate-500 font-bold block mb-1 uppercase text-[9px]">Workspace Plan</span>
                  <span className="text-slate-200 font-extrabold block capitalize">{selectedReg.plan || 'Free'}</span>
                  <span className="text-slate-550 text-[10px] block">Industry: {selectedReg.company_industry || '—'}</span>
                </div>
              </div>

              {/* TIMELINE SECTION */}
              <div className="space-y-3 bg-slate-955 border border-slate-850 p-4 rounded-xl">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Registration Lifecycle Timeline</span>
                
                <div className="space-y-4 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-800">
                  
                  {/* Step 1: Registered */}
                  <div className="flex gap-4 relative pl-6">
                    <div className="absolute left-[3.5px] top-[4px] w-2.5 h-2.5 rounded-full bg-indigo-500 shadow shadow-indigo-500/50" />
                    <div>
                      <p className="text-xs font-bold text-slate-200">Registration Request Submitted</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {moment(selectedReg.created_at).format('DD MMM YYYY, h:mm a')} ({moment(selectedReg.created_at).fromNow()})
                      </p>
                    </div>
                  </div>

                  {/* Step 2: Reviewed */}
                  <div className="flex gap-4 relative pl-6">
                    <div className={`absolute left-[3.5px] top-[4px] w-2.5 h-2.5 rounded-full ${
                      selectedReg.approval_status === 'approved' ? 'bg-green-500 shadow-green-500/50' :
                      selectedReg.approval_status === 'rejected' ? 'bg-rose-500 shadow-rose-500/50' :
                      selectedReg.approval_status === 'restricted' ? 'bg-red-500 shadow-red-500/50' :
                      'bg-slate-700'
                    } shadow`} />
                    <div>
                      <p className="text-xs font-bold text-slate-200 capitalize">
                        Status Update: {selectedReg.approval_status || 'Pending Review'}
                      </p>
                      {selectedReg.approval_reviewed_at ? (
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {moment(selectedReg.approval_reviewed_at).format('DD MMM YYYY, h:mm a')}
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-500 mt-0.5">Awaiting super administrator review action</p>
                      )}
                      {selectedReg.approval_note && (
                        <p className="text-[10px] text-indigo-400 font-medium italic mt-1 bg-slate-900 p-2 rounded-lg border border-slate-850">
                          Note: "{selectedReg.approval_note}"
                        </p>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setSelectedReg(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer transition"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REVIEW ACTION MODAL (APPROVE/REJECT/RESTRICT) ── */}
      {reviewAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleReviewSubmit}
            className="w-full max-w-md bg-slate-900 border border-slate-850 rounded-2xl p-6 shadow-2xl relative"
          >
            {/* Modal header */}
            <div className={`flex items-center gap-2 mb-4 pb-4 border-b ${
              reviewAction.action === 'approve'  ? 'border-green-500/20' :
              reviewAction.action === 'reject'   ? 'border-rose-500/20' :
              'border-amber-500/20'
            }`}>
              {reviewAction.action === 'approve'  && <div className="w-8 h-8 bg-green-500/10 rounded-lg flex items-center justify-center"><LuCircleCheck className="text-green-400" size={16} /></div>}
              {reviewAction.action === 'reject'   && <div className="w-8 h-8 bg-rose-500/10 rounded-lg flex items-center justify-center"><LuCircleX className="text-rose-400" size={16} /></div>}
              {reviewAction.action === 'restrict' && <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center"><LuTriangleAlert className="text-amber-400" size={16} /></div>}
              <div>
                <h3 className="text-sm font-black text-white capitalize">
                  {reviewAction.action === 'approve' ? 'Approve' : reviewAction.action === 'reject' ? 'Reject' : 'Restrict'} Registration
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold">
                  {reviewAction.regs.length} workspace{reviewAction.regs.length > 1 ? 's' : ''} selected
                </p>
              </div>
            </div>

            {/* Companies being acted on */}
            {reviewAction.regs.length <= 3 && (
              <div className="mb-4 space-y-1.5">
                {reviewAction.regs.map(r => (
                  <div key={r.id} className="flex items-center gap-2 bg-slate-950/60 border border-slate-850 rounded-xl px-3 py-2">
                    <div
                      style={{ backgroundColor: r.brand_color || '#3b82f6' }}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-black flex-shrink-0"
                    >
                      {r.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-200 truncate">{r.company_name || r.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{r.owner_email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-slate-400 text-xs mb-4 font-medium leading-relaxed">
              {reviewAction.action === 'approve'
                ? '✅ The company admin will receive an approval email and gain full platform access immediately.'
                : reviewAction.action === 'reject'
                ? '❌ The registration will be declined. The admin will receive an email with your reason below.'
                : '🔒 Access will be restricted. The admin will receive a notification with your reason below.'}
            </p>

            {/* Reason note (required for non-approve actions) */}
            {reviewAction.action !== 'approve' && (
              <div className="mb-5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">
                  Reason / Note — This will be included in the email sent to the company admin
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={reviewAction.action === 'reject'
                    ? 'e.g. Unable to verify company registration details. Please re-submit with supporting documentation.'
                    : 'e.g. Account suspended pending security review. Please contact support@strideo.app.'}
                  rows={4}
                  required
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-850 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-700 transition resize-none font-medium"
                />
                <p className="text-[10px] text-slate-600 font-semibold mt-1.5">
                  This message will be included in the notification email sent to the company admin.
                </p>
              </div>
            )}

            {/* Approve optional note */}
            {reviewAction.action === 'approve' && (
              <div className="mb-5">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wide mb-2">
                  Welcome Note (Optional)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Welcome to Strideo! Your workspace is now active."
                  rows={2}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-850 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-700 transition resize-none font-medium"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setReviewAction(null); setNote(''); }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl text-xs font-semibold cursor-pointer transition"
                disabled={actionLoading}
              >
                Cancel
              </button>

              <button
                type="submit"
                className={`px-5 py-2 rounded-xl text-xs font-black cursor-pointer text-white flex items-center gap-1.5 transition active:scale-95 ${
                  actionLoading ? 'opacity-60 cursor-not-allowed' : ''
                } ${
                  reviewAction.action === 'approve'  ? 'bg-green-600 hover:bg-green-500' :
                  reviewAction.action === 'reject'   ? 'bg-rose-600 hover:bg-rose-500' :
                  'bg-amber-600 hover:bg-amber-500'
                }`}
                disabled={actionLoading}
              >
                {actionLoading && <LuLoaderCircle className="animate-spin" size={13} />}
                {reviewAction.action === 'approve'  ? '✅ Confirm Approval' :
                 reviewAction.action === 'reject'   ? '❌ Confirm Rejection' :
                 '🔒 Confirm Restriction'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default CompanyRegistrations;
