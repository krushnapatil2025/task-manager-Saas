import React, { useState, useEffect, useContext } from 'react';
import { PRIORITY_DATA } from '../../utils/data';
import toast from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { LuTrash2 } from 'react-icons/lu';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import SelectDropdown from '../../components/Inputs/SelectDropdown';
import SelectUsers from '../../components/Inputs/SelectUsers';
import TodoListInput from '../../components/Inputs/TodoListInput';
import AddAttachmentsInput from '../../components/Inputs/AddAttachmentsInput';
import moment from 'moment';
import Modal from '../../components/Modal';
import DeleteAlert from '../../components/DeleteAlert';
import { UserContext } from '../../context/userContext';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import {
  createTask,
  updateTask,
  deleteTask,
  getTaskById,
  normalizeTask,
} from '../../services/taskService';
import { auditTaskCreated, auditTaskDeleted } from '../../services/auditService';
import usePermissions from '../../hooks/usePermissions';
import PermissionGate from '../../components/PermissionGate';
import AISuggestionBadge from '../../components/AISuggestionBadge';
import useAutomation from '../../hooks/useAutomation';

const CreateTask = () => {
  const location = useLocation();
  const { taskId, aiPrefill } = location.state || {};
  const navigate = useNavigate();
  const { user }      = useContext(UserContext);
  const { workspace } = useContext(WorkspaceContext);
  const { canCreateTask, canEditTask, canDeleteTask } = usePermissions();
  const { trigger: triggerAutomation } = useAutomation();

  const [taskData, setTaskData] = useState({
    title: '',
    description: '',
    priority: 'low',
    dueDate: '',
    assignedTo: [],
    todoCheckList: [],
    attachments: [],
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [openDeleteAlert, setOpenDeleteAlert] = useState(false);

  const clearData = () => {
    setTaskData({
      title: '',
      description: '',
      priority: 'low',
      dueDate: '',
      assignedTo: [],
      todoCheckList: [],
      attachments: [],
    });
  };

  const handleValueChange = (key, value) => {
    setTaskData((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreateTask = async () => {
    setLoading(true);
    try {
      const newTask = await createTask(
        {
          title: taskData.title,
          description: taskData.description,
          priority: taskData.priority,
          dueDate: new Date(taskData.dueDate).toISOString(),
          attachments: taskData.attachments,
        },
        taskData.assignedTo,
        taskData.todoCheckList,
        user.id,
        workspace.id
      );
      // Fire-and-forget audit + automation
      auditTaskCreated(workspace.id, newTask.id, taskData.title);
      triggerAutomation('task_created', { taskId: newTask.id, task: { ...taskData, id: newTask.id } });
      toast.success('Task created successfully!');
      clearData();
    } catch (err) {
      console.error('Create task error:', err);
      toast.error(err.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTask = async () => {
    setLoading(true);
    try {
      await updateTask(
        taskId,
        {
          title: taskData.title,
          description: taskData.description,
          priority: taskData.priority,
          dueDate: new Date(taskData.dueDate).toISOString(),
          attachments: taskData.attachments,
        },
        taskData.assignedTo,
        taskData.todoCheckList
      );
      toast.success('Task updated successfully!');
    } catch (err) {
      console.error('Update task error:', err);
      toast.error(err.message || 'Failed to update task');
    } finally {
      setLoading(false);
    }
  };

  const loadTaskDetails = async (id) => {
    try {
      const raw = await getTaskById(id);
      const task = normalizeTask(raw);
      setTaskData({
        title: task.title,
        description: task.description,
        priority: task.priority,
        dueDate: task.dueDate ? moment(task.dueDate).format('YYYY-MM-DD') : '',
        assignedTo: task.assignedTo.map((u) => u.id),
        todoCheckList: task.todoChecklist.map((c) => c.title),
        attachments: task.attachments,
      });
    } catch (err) {
      console.error('Load task error:', err);
      toast.error('Failed to fetch task details');
    }
  };

  const handleDeleteTask = async () => {
    try {
      await deleteTask(taskId);
      auditTaskDeleted(workspace.id, taskId, taskData.title);
      setOpenDeleteAlert(false);
      toast.success('Task deleted successfully!');
      navigate('/admin/tasks');
    } catch (err) {
      console.error('Delete task error:', err);
      toast.error(err.message || 'Failed to delete task');
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!taskData.title.trim()) return setError('Task title is required');
    if (!taskData.description.trim()) return setError('Task description is required');
    if (!taskData.dueDate) return setError('Task due date is required');
    if (taskData.assignedTo?.length === 0) return setError('At least one user must be assigned');
    if (taskData.todoCheckList?.length === 0) return setError('At least one TODO item is required');

    if (taskId) {
      await handleUpdateTask();
    } else {
      await handleCreateTask();
    }
  };

  // ── Load task for edit OR apply AI prefill from Ctrl+K command bar ────────
  useEffect(() => {
    if (taskId) {
      loadTaskDetails(taskId);
    } else if (aiPrefill) {
      setTaskData((prev) => ({
        ...prev,
        title:       aiPrefill.title       || prev.title,
        description: aiPrefill.description || prev.description,
        priority:    aiPrefill.priority    || prev.priority,
        dueDate:     aiPrefill.dueDate     || prev.dueDate,
      }));
      toast('✨ AI filled the form — review and submit!', { icon: '🤖' });
    }
  }, [taskId, aiPrefill]);

  return (
    <DashboardLayout activeMenu="Create Task">
      <div className="mt-5 px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="col-span-3 p-6 bg-white border border-gray-200 shadow-lg rounded-2xl text-black">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold tracking-wide">
                {taskId ? 'Update Task' : 'Create Task'}
              </h2>
              {taskId && canDeleteTask && (
                <button
                  className="flex items-center gap-2 text-sm font-medium text-red-600 bg-red-100 hover:bg-red-200 px-3 py-1 rounded-full border border-red-300"
                  onClick={() => setOpenDeleteAlert(true)}
                >
                  <LuTrash2 className="text-base" /> Delete
                </button>
              )}
            </div>

            <label className="block mb-2 text-sm font-medium">Task Title</label>
            <input
              placeholder="Create App UI"
              className="w-full px-4 py-2 mb-4 rounded-lg bg-white border border-gray-300 text-black"
              value={taskData.title}
              onChange={({ target }) => handleValueChange('title', target.value)}
            />

            <label className="block mb-2 text-sm font-medium">Description</label>
            <textarea
              placeholder="Describe task"
              className="w-full px-4 py-3 mb-4 rounded-lg bg-white border border-gray-300 text-black"
              rows={4}
              value={taskData.description}
              onChange={({ target }) => handleValueChange('description', target.value)}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block mb-2 text-sm font-medium">Priority</label>
                <SelectDropdown
                  options={PRIORITY_DATA}
                  value={taskData.priority}
                  onChange={(value) => handleValueChange('priority', value)}
                  placeholder="Select Priority"
                />
                {/* ── AI Suggestion Badge ── */}
                <AISuggestionBadge
                  title={taskData.title}
                  description={taskData.description}
                  onAccept={(p) => handleValueChange('priority', p)}
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium">Due Date</label>
                <input
                  type="date"
                  className="w-full px-4 py-2 rounded-lg bg-white border border-gray-300 text-black"
                  value={taskData.dueDate || ''}
                  onChange={({ target }) => handleValueChange('dueDate', target.value)}
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium">Assign To</label>
                <SelectUsers
                  selectedUsers={taskData.assignedTo}
                  setSelectedUsers={(value) => handleValueChange('assignedTo', value)}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium">TODO Checklist</label>
              <TodoListInput
                todoList={taskData.todoCheckList}
                setTodoList={(value) => handleValueChange('todoCheckList', value)}
              />
            </div>

            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium">Add Attachments</label>
              <AddAttachmentsInput
                attachments={taskData.attachments}
                setAttachments={(value) => handleValueChange('attachments', value)}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 font-medium mb-4">{error}</p>
            )}

            <div className="flex justify-end">
              <button
                className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold py-2.5 px-6 rounded-xl shadow-lg transition-all hover:opacity-90 disabled:opacity-60"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading
                  ? taskId ? 'Updating...' : 'Creating...'
                  : taskId ? 'UPDATE TASK' : 'CREATE TASK'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={openDeleteAlert}
        onClose={() => setOpenDeleteAlert(false)}
        title="Delete Task"
      >
        <DeleteAlert
          content="Are you sure you want to delete this task?"
          onDelete={handleDeleteTask}
        />
      </Modal>
    </DashboardLayout>
  );
};

export default CreateTask;
