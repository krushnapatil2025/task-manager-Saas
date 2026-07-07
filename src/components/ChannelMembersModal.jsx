import React, { useState, useEffect, useCallback, useContext } from 'react';
import { LuX, LuUserPlus, LuUserMinus, LuSearch, LuLoaderCircle } from 'react-icons/lu';
import { getRoomMembers, addRoomMember, removeRoomMember, updateRoomDetails } from '../services/chatService';
import { getWorkspaceMembers } from '../services/workspaceService';
import { WorkspaceContext } from '../context/WorkspaceContext';
import { UserContext } from '../context/userContext';
import { supabase } from '../utils/supabaseClient';
import { toast } from 'react-hot-toast';

const ChannelMembersModal = ({ roomId, isOwnerOrAdmin, onClose }) => {
  const { workspace } = useContext(WorkspaceContext);
  const { user: currentUser } = useContext(UserContext);

  const [currentMembers, setCurrentMembers] = useState([]);
  const [allWorkspaceMembers, setAllWorkspaceMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  // Channel details state
  const [activeTab, setActiveTab] = useState('members');
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');

  const loadMembers = useCallback(async () => {
    if (!roomId || !workspace?.id) return;
    setLoading(true);
    try {
      const [roomMems, wsMems, { data: roomData }] = await Promise.all([
        getRoomMembers(roomId),
        getWorkspaceMembers(workspace.id),
        supabase.from('chat_rooms').select('topic, description').eq('id', roomId).single(),
      ]);
      setCurrentMembers(roomMems);
      setAllWorkspaceMembers(wsMems);
      if (roomData) {
        setTopic(roomData.topic || '');
        setDescription(roomData.description || '');
      }
    } catch (err) {
      setError('Failed to load members or channel info.');
    } finally {
      setLoading(false);
    }
  }, [roomId, workspace?.id]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleAddMember = async (userId) => {
    setActionLoading(true);
    setError('');
    try {
      await addRoomMember(roomId, userId);
      await loadMembers();
    } catch (err) {
      setError(err.message || 'Failed to add member.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (userId === currentUser.id) {
      setError('You cannot remove yourself. Use the leave option instead.');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      await removeRoomMember(roomId, userId);
      await loadMembers();
    } catch (err) {
      setError(err.message || 'Failed to remove member.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');
    try {
      await updateRoomDetails(roomId, topic, description);
      toast.success('Channel details updated successfully!');
      await loadMembers();
    } catch (err) {
      setError(err.message || 'Failed to update channel details.');
      toast.error('Failed to update channel details');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter workspace members who are NOT already in the room
  const currentMemberIds = currentMembers.map(m => m.id);
  const addableMembers = allWorkspaceMembers.filter(
    m => !currentMemberIds.includes(m.id) && m.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="modal-overlay">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800 p-6 w-full max-w-md relative shadow-2xl dark:shadow-zinc-950/80" style={{ borderRadius: '16px' }}>
        <button
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
          onClick={onClose}
        >
          <LuX size={18} />
        </button>

        <h3 className="text-lg font-bold text-slate-805 dark:text-zinc-100 mb-1">Manage Channel</h3>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
          Add new team members, manage permissions, or edit channel details.
        </p>

        {isOwnerOrAdmin && (
          <div className="flex border-b border-slate-100 dark:border-zinc-800/80 mb-4 gap-4">
            <button
              className={`pb-2 text-xs font-bold transition-all border-b-2 ${activeTab === 'members' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-305'}`}
              onClick={() => setActiveTab('members')}
            >
              Members
            </button>
            <button
              className={`pb-2 text-xs font-bold transition-all border-b-2 ${activeTab === 'settings' ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400' : 'border-transparent text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-305'}`}
              onClick={() => setActiveTab('settings')}
            >
              Channel Settings
            </button>
          </div>
        )}

        {error && (
          <div className="mb-3 p-2.5 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs rounded-lg font-medium">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <LuLoaderCircle className="animate-spin text-indigo-500" size={24} />
          </div>
        ) : activeTab === 'members' ? (
          <div className="space-y-4">
            {/* 1. Add Members Section (Only for Channel Owner / Workspace Admin) */}
            {isOwnerOrAdmin && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Add Team Members</h4>
                <div className="relative">
                  <LuSearch className="absolute left-3 top-2.5 text-slate-400 dark:text-zinc-500" size={14} />
                  <input
                    type="text"
                    className="w-full pl-9 pr-3 py-1.5 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs outline-none bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-150 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 dark:focus:ring-indigo-950/40"
                    placeholder="Search people to add..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    disabled={actionLoading}
                  />
                </div>

                <div className="border border-slate-100 dark:border-zinc-800/80 rounded-xl max-h-32 overflow-y-auto divide-y divide-slate-50 dark:divide-zinc-900/60">
                  {addableMembers.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-zinc-950/60">
                      <div className="flex items-center gap-2">
                        {member.profileImageUrl ? (
                          <img src={member.profileImageUrl} alt={member.name} className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 text-[10px] font-bold flex items-center justify-center">
                            {(member.name || 'M')[0].toUpperCase()}
                          </div>
                        )}
                        <span className="text-xs font-medium text-slate-700 dark:text-zinc-200">{member.name || 'Member'}</span>
                      </div>
                      <button
                        type="button"
                        className="p-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded transition-colors flex items-center gap-1 text-[10px] font-semibold"
                        onClick={() => handleAddMember(member.id)}
                        disabled={actionLoading}
                      >
                        <LuUserPlus size={12} />
                        <span>Add</span>
                      </button>
                    </div>
                  ))}
                  {addableMembers.length === 0 && (
                    <div className="p-3 text-center text-[10px] text-slate-400 dark:text-zinc-500">All workspace members are in the channel</div>
                  )}
                </div>
              </div>
            )}

            {/* 2. Current Members List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                Current Members ({currentMembers.length})
              </h4>
              <div className="border border-slate-100 dark:border-zinc-800/80 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-50 dark:divide-zinc-900/60">
                {currentMembers.map(member => (
                  <div key={member.id} className="flex items-center justify-between p-2.5">
                    <div className="flex items-center gap-2.5">
                      {member.avatar ? (
                        <img src={member.avatar} alt={member.name} className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 text-xs font-bold flex items-center justify-center">
                          {(member.name || 'M')[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-medium text-slate-700 dark:text-zinc-200 flex items-center gap-1.5">
                          <span>{member.name || 'Member'}</span>
                          {member.id === currentUser.id && (
                            <span className="bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 px-1.5 py-0.5 rounded text-[8px] font-bold">You</span>
                          )}
                          {member.role === 'owner' && (
                            <span className="bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded text-[8px] font-bold">Owner</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isOwnerOrAdmin && member.id !== currentUser.id && member.role !== 'owner' && (
                      <button
                        type="button"
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors flex items-center justify-center"
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={actionLoading}
                        title="Remove member"
                      >
                        <LuUserMinus size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Channel Topic</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs outline-none bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 dark:focus:ring-indigo-950/40"
                placeholder="e.g. Project updates, design feedback"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                disabled={actionLoading}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Channel Description</label>
              <textarea
                className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-lg text-xs outline-none bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 dark:focus:ring-indigo-950/40 min-h-[80px]"
                placeholder="Provide details about what this channel is used for..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={actionLoading}
              />
            </div>

            <button
              type="submit"
              disabled={actionLoading}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
            >
              {actionLoading ? (
                <LuLoaderCircle className="animate-spin" size={14} />
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ChannelMembersModal;
