import React, { useState } from 'react';
import { FaRegEye, FaRegEyeSlash } from 'react-icons/fa6';

const Input = ({ value, onChange, label, placeholder, type = 'text', ...rest }) => {
  const [showPassword, setShowPassword] = useState(false);

  const toggleShowPassword = () => {
    setShowPassword((prev) => !prev);
  };

  return (
    <div>
      <label className="text-[13px] text-slate-700 ">{label}</label>
      <div className='input-box flex items-center'>
        <input
          type={type === 'password' ? (showPassword ? 'text' : 'password') : type}
          placeholder={placeholder}
          className="w-full bg-transparent outline-none"
          value={value}
          onChange={onChange}
          {...rest}
        />
        {type === 'password' && (
          <span className="ml-2">
            {showPassword ? (
              <FaRegEye
                size={22}
                className="text-blue-800 cursor-pointer"
                onClick={toggleShowPassword}
                aria-label="Hide password"
                tabIndex={0}
              />
            ) : (
              <FaRegEyeSlash
                size={22}
                className="text-slate-400 cursor-pointer"
                onClick={toggleShowPassword}
                aria-label="Show password"
                tabIndex={0}
              />
            )}
          </span>
        )}
      </div>
    </div>
  );
};

export default Input;