import React, { useRef, useState } from 'react';
import { LuUser, LuUpload, LuTrash } from 'react-icons/lu';

const ProfilePhotoSelector = ({ image, setImage }) => {
  const inputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setImage(file);
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setPreviewUrl(null);
  };

  const onChooseFile = () => {
    inputRef.current.click();
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 mb-6">
      <input
        type="file"
        accept="image/*"
        ref={inputRef}
        onChange={handleImageChange}
        className="hidden"
      />
      {!image ? (
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-600 via-purple-600 to-blue-900 flex items-center justify-center shadow-lg cursor-pointer relative" onClick={onChooseFile}>
          <LuUser className="text-white text-4xl" />
          <span className="absolute bottom-2 right-2 bg-blue-500 rounded-full p-1">
            <LuUpload className="text-white text-lg" />
          </span>
        </div>
      ) : (
        <div className="relative w-24 h-24">
          <img
            src={previewUrl}
            alt="Profile photo"
            className="w-24 h-24 rounded-full object-cover shadow-lg border-4 border-blue-500"
          />
          <button
            type="button"
            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-700 transition"
            onClick={handleRemoveImage}
            aria-label="Remove profile photo"
          >
            <LuTrash />
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfilePhotoSelector;