import React, { useState } from 'react';
import { LuX, LuLock, LuGlobe, LuCheck, LuSearch, LuLoaderCircle } from 'react-icons/lu';

const CreateChannelModal = ({ onClose, onCreate, workspaceMembers = [] }) => {
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleMember = (memberId) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Channel name is required.');
      return;
    }
    setError('');
    setLoading(true);

    const formattedName = name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');

    try {
      await onCreate(formattedName, isPrivate, selectedMembers);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create channel.');
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = workspaceMembers.filter(m =>
    m.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="modal-overlay">
      <div className="modal-card max-w-md w-full relative" style={{ borderRadius: '16px' }}>
        <button
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          onClick={onClose}
        >
          <LuX size={18} />
        </button>

        <h3 className="text-lg font-bold text-slate-800 mb-2">Create a Channel</h3>
        <p className="text-xs text-slate-500 mb-4">
          Channels are where your team communicates. They’re best when organized around a topic.
        </p>

        {error && (
          <div className="mb-3 p-2.5 bg-red-50 text-red-600 text-xs rounded-lg font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="modal-label">Name</label>
            <input
              type="text"
              className="modal-input"
              placeholder="e.g. plan-launch"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          {/* Privacy Toggle */}
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-700 text-sm">
                {isPrivate ? (
                  <>
                    <LuLock className="text-amber-500" size={14} />
                    <span>Private Channel</span>
                  </>
                ) : (
                  <>
                    <LuGlobe className="text-indigo-500" size={14} />
                    <span>Public Channel</span>
                  </>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                {isPrivate
                  ? 'Access is limited to invited members only. This channel won’t appear in search results.'
                  : 'Anyone in your workspace can join, read messages, and browse files in this channel.'}
              </p>
            </div>
            <button
              type="button"
              className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none flex-shrink-0 ${
                isPrivate ? 'bg-amber-500' : 'bg-indigo-500'
              }`}
              onClick={() => setIsPrivate(p => !p)}
              disabled={loading}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                  isPrivate ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Members Selection (if private, or optional pre-adds) */}
          <div className="space-y-2">
            <label className="modal-label">Invite Members</label>
            <div className="relative">
              <LuSearch className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100"
                placeholder="Search team members..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="border border-slate-100 rounded-xl max-h-40 overflow-y-auto divide-y divide-slate-50">
              {filteredMembers.map(member => {
                const isSelected = selectedMembers.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    className="w-full flex items-center justify-between p-2.5 hover:bg-slate-50 text-left transition-colors"
                    onClick={() => toggleMember(member.id)}
                    disabled={loading}
                  >
                    <div className="flex items-center gap-2">
                      {member.profileImageUrl ? (
                        <img
                          src={member.profileImageUrl}
                          alt={member.name}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">
                          {(member.name || 'M')[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-medium text-slate-700">{member.name || 'Member'}</div>
                        <div className="text-[10px] text-slate-400 capitalize">{member.wsRole || 'member'}</div>
                      </div>
                    </div>
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <LuCheck size={10} />}
                    </div>
                  </button>
                );
              })}
              {filteredMembers.length === 0 && (
                <div className="p-3 text-center text-xs text-slate-400">No members found</div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-50">
            <button
              type="button"
              className="px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition-all flex items-center gap-1.5 ${
                isPrivate
                  ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-100'
                  : 'bg-indigo-600 hover:bg-indigo-750 shadow-indigo-100'
              }`}
              disabled={loading}
            >
              {loading && <LuLoaderCircle size={14} className="animate-spin" />}
              Create Channel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateChannelModal;
