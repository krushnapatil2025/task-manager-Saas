import React, { useContext, useState } from 'react';
import AuthLayout from '../../components/layouts/AuthLAyout';
import { validateEmail } from '../../utils/helper';
import { supabase } from '../../utils/supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { UserContext } from '../../context/userContext';
import UploadImage from '../../utils/uploadImage';
import toast from 'react-hot-toast';
import {
  LuLoaderCircle, LuUser, LuMail, LuLock, LuShield,
  LuEye, LuEyeOff, LuUpload, LuTrash, LuCircleCheck,
} from 'react-icons/lu';

// ── password strength helper ──────────────────────────────────────────────────
const getStrength = (pw) => {
  let score = 0;
  if (pw.length >= 8)              score++;
  if (/[A-Z]/.test(pw))           score++;
  if (/[0-9]/.test(pw))           score++;
  if (/[^A-Za-z0-9]/.test(pw))    score++;
  return score; // 0-4
};
const strengthLabel = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
const strengthColor = ['bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500'];

const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_INVITE_TOKEN || 'change_this_to_a_strong_secret';

const SignUp = () => {
  const [profilePic, setProfilePic] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fullname, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminInviteToken, setAdminInviteToken] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const fileInputRef = React.useRef(null);

  const { updateUser } = useContext(UserContext);
  const navigate = useNavigate();

  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setProfilePic(file);
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);
    }
  };

  const handleRemoveImage = () => {
    setProfilePic(null);
    setPreviewUrl(null);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');

    if (!fullname.trim()) {
      setError('Please enter your Full Name.');
      return;
    }
    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const role = adminInviteToken === ADMIN_TOKEN ? 'admin' : 'member';

      let profileImageUrl = '';
      if (profilePic) {
        const imgResult = await UploadImage(profilePic);
        profileImageUrl = imgResult.imageUrl || '';
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: fullname,
            role,
            profileImageUrl,
          },
        },
      });

      if (signUpError) throw signUpError;

      await new Promise((r) => setTimeout(r, 800));
      await updateUser();

      toast.success('Account created successfully!');
      if (role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/user/dashboard');
      }
    } catch (err) {
      console.error('SignUp error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const strength = getStrength(password);

  return (
    <AuthLayout title="Create an Account" subtitle="Register your credentials to join your workspace">
      <div className="w-full">
        {error && (
          <div className="text-red-650 text-xs mb-4 text-center bg-red-50 border border-red-200 rounded-xl px-3 py-2 font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleSignUp} className="flex flex-col gap-4">
          
          {/* Custom Dynamic Profile Photo Upload */}
          <div className="flex flex-col items-center justify-center gap-3 mb-2 select-none">
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageChange}
              className="hidden"
            />
            {!profilePic ? (
              <div 
                className="w-20 h-20 rounded-full border-2 border-dashed border-indigo-200 bg-indigo-50/10 flex flex-col items-center justify-center cursor-pointer relative hover:bg-indigo-50/20 transition group"
                onClick={() => fileInputRef.current.click()}
              >
                <LuUser className="text-slate-400 text-2xl group-hover:scale-105 transition" />
                <span className="absolute bottom-1 right-1 bg-white border border-slate-200 shadow-sm rounded-full p-1 text-[10px] text-slate-500">
                  <LuUpload size={10} />
                </span>
              </div>
            ) : (
              <div className="relative w-20 h-20">
                <img
                  src={previewUrl}
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover shadow-md border-2 border-indigo-650"
                />
                <button
                  type="button"
                  className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600 transition"
                  onClick={handleRemoveImage}
                  aria-label="Remove photo"
                >
                  <LuTrash size={12} />
                </button>
              </div>
            )}
            <span className="text-[10px] font-bold text-slate-400">Profile Photo (Optional)</span>
          </div>

          <div className="flex flex-col gap-3">
            <Field label="Full Name" icon={<LuUser size={13} />}>
              <input
                type="text"
                value={fullname}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                className="form-input mt-0"
                autoComplete="name"
              />
            </Field>

            <Field label="Email Address" icon={<LuMail size={13} />}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@company.com"
                className="form-input mt-0"
                autoComplete="email"
              />
            </Field>

            <div>
              <Field label="Password" icon={<LuLock size={13} />}>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    className="form-input mt-0 pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650"
                  >
                    {showPw ? <LuEyeOff size={15} /> : <LuEye size={15} />}
                  </button>
                </div>
              </Field>
              {password && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[1,2,3,4].map((i) => (
                      <div
                        key={i}
                        className={`flex-1 h-1 rounded-full transition-all ${
                          i <= strength ? strengthColor[strength] : 'bg-slate-100'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold">{strengthLabel[strength]}</p>
                </div>
              )}
            </div>

            <Field label="Admin Invite Token (optional)" icon={<LuShield size={13} />}>
              <input
                type="text"
                value={adminInviteToken}
                onChange={(e) => setAdminInviteToken(e.target.value)}
                placeholder="Leave blank for member role"
                className="form-input mt-0"
                autoComplete="off"
              />
            </Field>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 text-white bg-indigo-600 hover:bg-indigo-700 font-bold py-2.5 rounded-xl shadow-lg transition disabled:opacity-60 mt-4 cursor-pointer"
          >
            {loading ? <LuLoaderCircle className="animate-spin" size={16} /> : null}
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-xs text-slate-500 mt-6 text-center font-bold">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-650 hover:text-indigo-700 hover:underline font-extrabold">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};

// ── Field Helper ──
const Field = ({ label, icon, children }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs text-slate-500 font-semibold flex items-center gap-1.5 select-none">
      <span className="text-slate-400">{icon}</span> {label}
    </label>
    {children}
  </div>
);

export default SignUp;