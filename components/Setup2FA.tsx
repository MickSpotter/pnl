import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, ShieldCheck, AlertCircle } from 'lucide-react';

export default function Setup2FA() {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const enrollMFA = async () => {
    setError(null);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
    });

    if (error) {
      setError(error.message);
      return;
    }

    setFactorId(data.id);
    setQrCode(data.totp.uri);
  };

  const verifyAndEnable = async () => {
    if (!factorId) return;
    setError(null);

    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      setError(challenge.error.message);
      return;
    }

    const verify = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: verifyCode,
    });

    if (verify.error) {
      setError('Invalid code. Try again.');
    } else {
      setIsSuccess(true);
      setQrCode(null);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
        <ShieldCheck className="w-6 h-6" />
        <div>
          <h3 className="font-medium">2FA Activated</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-6 h-6 text-zinc-400" />
        <h2 className="text-lg font-medium text-zinc-200">Two-Factor Authentication</h2>
      </div>

      {!qrCode ? (
        <div>
          <button 
            onClick={enrollMFA}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            Setup 2FA
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center animate-in fade-in duration-300">
          <div className="bg-white p-4 rounded-xl mb-6">
            <QRCodeSVG value={qrCode} size={200} />
          </div>
          <input 
            type="text" 
            placeholder="000000" 
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 text-center text-2xl tracking-[0.5em] font-mono rounded-lg py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all mb-4"
            maxLength={6}
          />
          {error && (
            <div className="flex items-center gap-2 text-rose-400 text-sm mb-4">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
          <button 
            onClick={verifyAndEnable}
            disabled={verifyCode.length !== 6}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-zinc-950 font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            Confirm
          </button>
        </div>
      )}
    </div>
  );
}