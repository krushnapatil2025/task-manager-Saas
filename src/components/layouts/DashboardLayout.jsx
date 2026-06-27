import React, { useContext } from 'react'
import { UserContext } from '../../context/userContext';
import Navbar from './Navbar';
import SideMenu from './SideMenu';

const DashboardLayout = ({ children, activeMenu }) => {
  const { user } = useContext(UserContext);
  return (
    <div className="min-h-screen bg-gray-25 flex flex-col font-sans">
      <Navbar activeMenu={activeMenu} />

      {user && (
        <div className="flex flex-1 items-stretch">
          <div className="max-[1080px]:hidden shrink-0">
            <SideMenu activeMenu={activeMenu} />
          </div>
          <div className="grow min-w-0 mx-6 my-6 md:mx-8">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout