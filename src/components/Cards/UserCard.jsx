import React from 'react';
import { LuCircleCheck, LuClock9, LuLoaderCircle } from 'react-icons/lu';




const UserCard = ({ userInfo }) => {
    return (
        <div className="p-4 bg-white border rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-300">
            <div className="flex items-center gap-4 mb-4">
                <img
                    src={userInfo?.profileImageUrl || "/default-avatar.png"}
                    alt="User Avatar"
                    className="w-16 h-16 rounded-full object-cover border border-gray-300"
                />
                <div>
                    <p className="text-lg font-semibold text-gray-800">{userInfo?.name}</p>
                    <p className="text-sm text-gray-500">{userInfo?.email}</p>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <StatCard
                    label="Pending"
                    count={userInfo?.pendingTasks || 0}
                    icon={<LuClock9 className="text-yellow-500 text-lg" />}
                    bg="bg-yellow-100"
                    text="text-yellow-700"
                />
                <StatCard
                    label="In Progress"
                    count={userInfo?.inProgressTasks || 0}
                    icon={<LuLoaderCircle className="text-blue-500 text-lg" />}
                    bg="bg-blue-100"
                    text="text-blue-700"
                />
                <StatCard
                    label="Completed"
                    count={userInfo?.completedTasks || 0}
                    icon={<LuCircleCheck className="text-green-500 text-lg" />}
                    bg="bg-green-100"
                    text="text-green-700"
                />
            </div>
        </div>
    );
};

export default UserCard;

const StatCard = ({ label, count, icon, bg, text }) => {
    return (
        <div className={`flex flex-col items-center justify-center p-3 rounded-xl ${bg} ${text}`}>
            {icon}
            <p className="text-sm font-medium mt-1">{label}</p>
            <span className="text-lg font-semibold">{count}</span>
        </div>
    );
};
