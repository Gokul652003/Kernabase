import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Database, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2">
          <Database size={20} className="text-accent" />
          <span className="text-lg font-medium tracking-tight text-text">Kernabase</span>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
          <h1 className="mb-1 text-base font-medium text-text">Log in</h1>
          <p className="mb-5 text-xs text-text-subtle">Welcome back — enter your details to continue.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-xs text-text-subtle">Email</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-subtle">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
              />
            </div>

            {error && <p className="text-xs text-danger">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 flex items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-fg shadow-sm transition hover:brightness-110 disabled:opacity-50"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? 'Logging in…' : 'Log in'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-text-subtle">
          Don't have an account?{' '}
          <Link to="/signup" className="text-accent hover:brightness-110">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
