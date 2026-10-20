import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { ArrowLeft, ArrowRight, LockKeyhole, Mail, Palette, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";

function authErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="auth-card panel">
      <Link href="/home" className="auth-back">
        <ArrowLeft size={14} /> Back to ARTNEST
      </Link>
      <div className="auth-mark">
        <Palette size={22} />
      </div>
      <div className="eyebrow">ARTNEST · STUDENT CREATOR MARKETPLACE</div>
      <h1 className="page-title auth-title">{title}</h1>
      <p className="subhead auth-description">{description}</p>
      {children}
    </section>
  );
}

function AuthField({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <input
        className="input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        autoComplete={autoComplete}
        required={required}
        minLength={type === "password" ? 6 : undefined}
      />
    </label>
  );
}

export function SignInPage() {
  const auth = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nextPath = new URLSearchParams(window.location.search).get("next");
  const destination = nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/home";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await auth.signIn(email, password);
      setLocation(destination);
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Welcome back." description="Sign in to save work, message creators, and manage your studio.">
      {!auth.authConfigured && (
        <p className="auth-error" role="alert">
          Firebase is not configured. Add the Firebase web app settings to Replit Secrets.
        </p>
      )}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <form className="auth-form" onSubmit={submit}>
        <AuthField label="Email address" value={email} onChange={setEmail} type="email" autoComplete="email" />
        <AuthField label="Password" value={password} onChange={setPassword} type="password" autoComplete="current-password" />
        <div className="auth-helper">
          <Link href="/forgot-password">Forgot password?</Link>
        </div>
        <button className="btn primary auth-submit" type="submit" disabled={busy || !auth.authConfigured}>
          {busy ? "Signing in…" : "Sign in"} <ArrowRight size={14} />
        </button>
      </form>
      <p className="auth-switch">
        New to ARTNEST? <Link href="/signup">Create an account</Link>
      </p>
    </AuthCard>
  );
}

export function SignUpPage() {
  const auth = useAuth();
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"buyer" | "student_creator">("student_creator");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await auth.signUp(email, password, name);
      if (role === "student_creator") await auth.setCreatorRole();
      await auth.refreshProfile();
      setLocation(role === "student_creator" ? "/dashboard" : "/explore");
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Make room for your work." description="Create an account to find your people and grow your creative practice.">
      {!auth.authConfigured && (
        <p className="auth-error" role="alert">
          Firebase is not configured. Add the Firebase web app settings to Replit Secrets.
        </p>
      )}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <form className="auth-form" onSubmit={submit}>
        <AuthField label="Your name" value={name} onChange={setName} autoComplete="name" />
        <AuthField label="Email address" value={email} onChange={setEmail} type="email" autoComplete="email" />
        <AuthField label="Password (6+ characters)" value={password} onChange={setPassword} type="password" autoComplete="new-password" />
        <label className="auth-field">
          <span>I’m joining as</span>
          <select className="select" value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
            <option value="student_creator">Student creator</option>
            <option value="buyer">Buyer</option>
          </select>
        </label>
        {role === "student_creator" && (
          <p className="auth-note">
            <Sparkles size={13} /> Student verification is reviewed separately; your profile starts as pending.
          </p>
        )}
        <button className="btn primary auth-submit" type="submit" disabled={busy || !auth.authConfigured}>
          {busy ? "Creating account…" : "Create account"} <ArrowRight size={14} />
        </button>
      </form>
      <p className="auth-switch">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </AuthCard>
  );
}

export function ForgotPasswordPage() {
  const auth = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setBusy(true);
    try {
      await auth.sendPasswordReset(email);
      setMessage("If an account uses that address, Firebase has sent a password reset email.");
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthCard title="Reset your password." description="We’ll ask Firebase to send a secure reset link to your email.">
      {message && <p className="auth-success" role="status">{message}</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <form className="auth-form" onSubmit={submit}>
        <AuthField label="Email address" value={email} onChange={setEmail} type="email" autoComplete="email" />
        <button className="btn primary auth-submit" type="submit" disabled={busy || !auth.authConfigured}>
          <Mail size={14} /> {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <button className="auth-text-button" onClick={() => setLocation("/login")}>
        <LockKeyhole size={13} /> Return to sign in
      </button>
    </AuthCard>
  );
}

export function ProtectedPage({
  children,
  creatorOnly = false,
}: {
  children: ReactNode;
  creatorOnly?: boolean;
}) {
  const auth = useAuth();
  const [, setLocation] = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (auth.loading) {
    return <div className="panel auth-gate">Checking your account…</div>;
  }
  if (!auth.session) {
    return (
      <div className="panel auth-gate">
        <div className="auth-mark"><LockKeyhole size={20} /></div>
        <h2>Sign in to continue.</h2>
        <p className="micro">Your account keeps your artwork, messages, and purchases private.</p>
        <button className="btn primary" onClick={() => setLocation(`/login?next=${encodeURIComponent(window.location.pathname)}`)}>
          Sign in <ArrowRight size={14} />
        </button>
      </div>
    );
  }
  if (auth.profileError) {
    return (
      <div className="panel auth-gate">
        <h2>Your profile could not load.</h2>
        <p className="micro">{auth.profileError}</p>
        <button className="btn" onClick={() => void auth.refreshProfile()}>Retry</button>
      </div>
    );
  }
  if (creatorOnly && auth.profile?.role !== "student_creator" && auth.profile?.role !== "admin") {
    const upgrade = async () => {
      setBusy(true);
      setError("");
      try {
        await auth.setCreatorRole();
      } catch (cause) {
        setError(authErrorMessage(cause));
      } finally {
        setBusy(false);
      }
    };
    return (
      <div className="panel auth-gate">
        <div className="auth-mark"><Sparkles size={20} /></div>
        <h2>Set up your creator profile.</h2>
        <p className="micro">Switch this account to a student creator profile to access studio tools.</p>
        {error && <p className="auth-error">{error}</p>}
        <button className="btn primary" onClick={() => void upgrade()} disabled={busy}>
          {busy ? "Setting up…" : "Create creator profile"} <ArrowRight size={14} />
        </button>
      </div>
    );
  }
  return children;
}

export function AccountRoutesExist() {
  return useRoute("/login")[0] || useRoute("/signup")[0];
}
