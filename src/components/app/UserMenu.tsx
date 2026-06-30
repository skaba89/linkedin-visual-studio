"use client";

import { useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import {
  Loader2,
  LogIn,
  LogOut,
  User as UserIcon,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";

/**
 * UserMenu — Bouton de connexion/déconnexion affiché dans la sidebar.
 *
 * Affiche 3 états :
 *  - loading : spinner pendant la résolution de session
 *  - unauthenticated : bouton "Se connecter" qui ouvre la modale de login
 *  - authenticated : nom/email + bouton "Se déconnecter"
 *
 * R-011 — Sans ce composant, l'utilisateur n'avait aucun moyen de se connecter
 * à HERMÈS (NextAuth est configuré mais aucun lien vers /api/auth/signin
 * n'existait dans l'UI). Tous les clics sur "Connecter LinkedIn" échouaient
 * avec "Connexion requis" car aucune session n'était jamais établie.
 */
export default function UserMenu() {
  const { data: session, status } = useSession();
  const [showLoginModal, setShowLoginModal] = useState(false);

  if (status === "loading") {
    return (
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2 text-[11px] text-[#7B8A9A]">
          <Loader2 className="w-3 h-3 animate-spin text-[#00D4FF]" />
          <span>Chargement…</span>
        </div>
      </div>
    );
  }

  if (status === "authenticated" && session?.user) {
    return (
      <>
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-[#0A66C2]/20 border border-[#0A66C2]/30 flex items-center justify-center flex-shrink-0">
              <UserIcon className="w-3.5 h-3.5 text-[#0A66C2]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-[#F0F4F8] truncate">
                {session.user.name || session.user.email}
              </div>
              {session.user.name && (
                <div className="text-[10px] text-[#7B8A9A] truncate">
                  {session.user.email}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium text-[#7B8A9A] hover:text-[#F0F4F8] hover:bg-white/[0.04] transition-all cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            <span>Se déconnecter</span>
          </button>
        </div>
        {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
      </>
    );
  }

  return (
    <>
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <button
          onClick={() => setShowLoginModal(true)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[12px] font-medium text-[#00D4FF] bg-[#00D4FF]/10 hover:bg-[#00D4FF]/20 transition-all cursor-pointer"
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>Se connecter</span>
        </button>
      </div>
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
    </>
  );
}

/**
 * LoginModal — Formulaire de connexion par email + mot de passe.
 *
 * Utilise NextAuth `signIn("credentials", ...)` qui POST vers
 * /api/auth/callback/credentials. En cas de succès, NextAuth pose le cookie
 * `__Secure-next-auth.session-token` et recharge la page (callbackUrl: "/").
 */
function LoginModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("demo@hermes.app");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pré-remplit le mot de passe démo si l'email est celui du compte démo
  // (aide les utilisateurs à tester l'app sans chercher le mot de passe).
  useEffect(() => {
    if (email === "demo@hermes.app" && !password) {
      setPassword("Demo-Hermes-2024");
    }
  }, [email, password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        setError("Email ou mot de passe incorrect.");
        setLoading(false);
        return;
      }

      if (result?.ok) {
        // Reload to refresh the session and any server-rendered content
        window.location.reload();
      } else {
        setError("Une erreur est survenue. Réessayez.");
        setLoading(false);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur de connexion au serveur.",
      );
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-[#0F1520] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-[#00D4FF]/15 border border-[#00D4FF]/20 flex items-center justify-center mx-auto mb-3">
            <LogIn className="w-6 h-6 text-[#00D4FF]" />
          </div>
          <h2 className="text-[16px] font-semibold text-[#F0F4F8] mb-1">
            Connexion à HERMÈS
          </h2>
          <p className="text-[12px] text-[#7B8A9A]">
            Connectez-vous pour accéder à vos agents et lier votre compte LinkedIn.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-[#7B8A9A] mb-1.5 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/40"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-[#7B8A9A] mb-1.5 block">
              Mot de passe
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full bg-[#18212F] border border-white/[0.06] rounded-lg px-3 py-2 pr-10 text-[13px] text-[#F0F4F8] placeholder:text-[#7B8A9A]/50 focus:outline-none focus:border-[#00D4FF]/40"
                placeholder="••••••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#7B8A9A] hover:text-[#F0F4F8] cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-[12px] text-[#E5263A] bg-[#E5263A]/10 border border-[#E5263A]/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold text-white bg-[#00D4FF] hover:bg-[#00D4FF]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Connexion…</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Se connecter</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-white/[0.04]">
          <p className="text-[10px] text-[#7B8A9A] text-center leading-relaxed">
            <strong className="text-[#7B8A9A]">Compte démo :</strong>
            <br />
            <code className="text-[#00D4FF]">demo@hermes.app</code>
            <br />
            <code className="text-[#00D4FF]">Demo-Hermes-2024</code>
          </p>
        </div>

        <button
          onClick={onClose}
          className="mt-3 w-full text-[11px] text-[#7B8A9A] hover:text-[#F0F4F8] cursor-pointer"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
