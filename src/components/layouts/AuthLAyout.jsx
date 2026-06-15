import React from 'react';
import UI_IMG from '../../assets/images/bag_auth.png';

const AuthLayout = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-black">
      <div className="w-full md:w-[60vw] flex flex-col justify-center items-center px-8 py-12 backdrop-blur-lg bg-white/10 shadow-2xl rounded-xl m-8 animate-fade-in">
        <h2 className="text-3xl font-extrabold text-white mb-4 tracking-wide drop-shadow-lg">Task Manager</h2>
        {children}
      </div>
      <div className="hidden md:flex w-[40vw] h-screen items-center justify-center relative overflow-hidden">
        <img src={UI_IMG} alt="UI" className="w-96 lg:w-[90%] drop-shadow-2xl animate-float" />
        <div className="absolute inset-0 bg-gradient-to-t from-blue-800/60 to-transparent z-0" />
      </div>
    </div>
  );
};

export default AuthLayout;