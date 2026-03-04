/**
 * Login Page — Password Gate
 * Shown when CLAWX_AUTH_PASSWORD is configured and user is not authenticated.
 */
import { useState, useCallback, useEffect } from 'react';
import { Shield, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface LoginPageProps {
    onLoginSuccess: () => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
    const { t } = useTranslation('settings');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim() || loading) return;

        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            const data = await res.json();

            if (data.success) {
                onLoginSuccess();
            } else {
                setError(data.error || 'Login failed');
                setPassword('');
            }
        } catch {
            setError(t('security.connectionError'));
        } finally {
            setLoading(false);
        }
    }, [password, loading, onLoginSuccess, t]);

    useEffect(() => {
        const input = document.getElementById('login-password');
        if (input) input.focus();
    }, []);

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
                        <Shield className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">{t('security.loginTitle')}</h1>
                    <p className="text-sm text-muted-foreground mt-1">{t('security.loginSubtitle')}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="relative">
                        <input
                            id="login-password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(''); }}
                            placeholder={t('security.loginPlaceholder')}
                            autoComplete="current-password"
                            disabled={loading}
                            className="w-full h-12 px-4 pr-12 rounded-xl bg-card border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all disabled:opacity-50"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            tabIndex={-1}
                        >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-destructive text-sm animate-in fade-in slide-in-from-top-1">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !password.trim()}
                        className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {t('security.loginLoading')}
                            </>
                        ) : (
                            t('security.loginButton')
                        )}
                    </button>
                </form>

                <p className="text-xs text-muted-foreground text-center mt-6">
                    {t('security.loginFooter')}
                </p>
            </div>
        </div>
    );
}
