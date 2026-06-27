import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import TaskSlidePanel from '../../components/TaskSlidePanel';

const CreateTask = () => {
  const location = useLocation();
  const { taskId, aiPrefill } = location.state || {};
  const navigate = useNavigate();

  const handleClose = () => {
    navigate('/admin/tasks');
  };

  return (
    <DashboardLayout activeMenu={taskId ? "Manage Tasks" : "Create Task"}>
      <div className="min-h-[60vh] flex items-center justify-center p-8 bg-slate-25 rounded-2xl border border-slate-200/50 mt-4 animate-fade-in">
        <div className="text-center max-w-sm">
          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Redirecting to Workspace drawer...</h3>
          <p className="text-xs text-slate-455 mt-2 font-medium">
            Tasks are now managed using the new premium slide-over workspace drawer. Click the button below if it does not open automatically.
          </p>
          <button
            onClick={handleClose}
            className="mt-4 text-xs font-bold bg-indigo-650 hover:bg-indigo-750 text-white px-4.5 py-2.5 rounded-xl transition cursor-pointer shadow-md shadow-indigo-100"
          >
            View Task List
          </button>
        </div>
      </div>
      <TaskSlidePanel
        taskId={taskId}
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleClose}
        aiPrefill={aiPrefill}
      />
    </DashboardLayout>
  );
};

export default CreateTask;
