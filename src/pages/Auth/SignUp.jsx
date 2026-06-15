import React, { useContext, useState } from 'react';
import AuthLayout from '../../components/layouts/AuthLAyout';
import ProfilePhotoSelector from '../../components/Inputs/ProfilePhotoSelector';
import Input from '../../components/Inputs/Input';
import { validateEmail } from '../../utils/helper';
import { supabase } from '../../utils/supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { UserContext } from '../../context/userContext';
import UploadImage from '../../utils/uploadImage';
import toast from 'react-hot-toast';

// The secret token that grants admin role on signup.
// Change this in your .env: VITE_ADMIN_INVITE_TOKEN=your_secret
const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_INVITE_TOKEN || 'change_this_to_a_strong_secret';

const SignUp = () => {
  const [profilePic, setProfilePic] = useState(null);
  const [fullname, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminInviteToken, setAdminInviteToken] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { updateUser } = useContext(UserContext);
  const navigate = useNavigate();

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
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      // Determine role from invite token
      const role = adminInviteToken === ADMIN_TOKEN ? 'admin' : 'member';

      // Upload profile image first (if selected)
      let profileImageUrl = '';
      if (profilePic) {
        const imgResult = await UploadImage(profilePic);
        profileImageUrl = imgResult.imageUrl || '';
      }

      // Register with Supabase Auth — metadata flows into handle_new_user() trigger
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

      // The DB trigger handle_new_user() auto-creates the profile row.
      // We wait briefly then load the profile.
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

  return (
    <AuthLayout>
      <div className="w-full max-w-lg mx-auto p-8 rounded-xl bg-white/20 shadow-xl backdrop-blur-lg animate-fade-in mt-10 md:mt-0">
        <h3 className="text-2xl font-bold text-white mb-2 text-center tracking-wide">
          Create an Account
        </h3>
        <p className="text-xs text-slate-200 mb-6 text-center">
          Join us today by entering your details below.
        </p>

        {error && (
          <div className="text-red-400 text-xs mb-4 text-center bg-red-500/10 border border-red-400/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSignUp} className="flex flex-col gap-6">
          <ProfilePhotoSelector image={profilePic} setImage={setProfilePic} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              value={fullname}
              onChange={(e) => setFullName(e.target.value)}
              label="Full Name"
              placeholder="Enter your Full Name"
              type="text"
              autoComplete="name"
            />
            <Input
              value={email}
              onChange={({ target }) => setEmail(target.value)}
              label="Email Address"
              placeholder="Enter your email"
              type="text"
              autoComplete="email"
            />
            <Input
              value={password}
              onChange={({ target }) => setPassword(target.value)}
              label="Password"
              placeholder="Min. 6 characters"
              type="password"
              autoComplete="new-password"
            />
            <Input
              value={adminInviteToken}
              onChange={({ target }) => setAdminInviteToken(target.value)}
              label="Admin Invite Token (optional)"
              placeholder="Leave blank for member role"
              type="text"
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 text-white font-semibold py-2.5 rounded-lg shadow-lg hover:scale-105 transition-transform duration-200 disabled:opacity-60 w-full mt-2"
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="text-xs text-slate-200 mt-6 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:underline font-medium">
            Login
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default SignUp;