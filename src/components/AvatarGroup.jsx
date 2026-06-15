import React from 'react';

const AvatarGroup = ({ avatars, maxVisible = 3 }) => {
  return (
    <div className="flex items-center">
      {avatars.slice(0, maxVisible).map((avatar, index) => {
        const isValidSrc = avatar && avatar.trim() !== "";

        return isValidSrc ? (
          <img
            key={index}
            src={avatar}
            alt={`Avatar ${index}`}
            className="w-9 h-9 rounded-full border-2 border-white -ml-3 first:ml-0"
          />
        ) : (
          <div
            key={index}
            className="w-9 h-9 rounded-full bg-gray-300 text-sm font-semibold flex items-center justify-center border-2 border-white -ml-3 first:ml-0 text-gray-600"
          >
            ?
          </div>
        );
      })}

      {avatars.length > maxVisible && (
        <div className="w-9 h-9 flex items-center justify-center bg-blue-50 text-xs font-medium text-blue-500 rounded-full border-2 border-white -ml-3">
          +{avatars.length - maxVisible}
        </div>
      )}
    </div>
  );
};

export default AvatarGroup;
