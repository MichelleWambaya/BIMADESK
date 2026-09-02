import React, { useEffect, useState } from "react";
import { ExternalLink, Check, TriangleAlert, Wallet, Info } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAuth } from "@/contexts/AuthContext";

interface GatewayInfo {
  provider: string;
  username: string;
  sender_id: string | null;
  is_active: boolean;
  has_api_key: boolean;
  last_verified_at: string | null;
  last_error: string | null;
}

interface WalletInfo {
  balance_cents: number;
  sms_price_cents: number;
  whatsapp_price_cents: number;
  included_sms_monthly: number;
  included_sms_used: number;
  allows_own_gateway: boolean;
  own_gateway_active: boolean;
}

const kes = (cents: number) => `KES ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export function MessagingSection() {
  const { effectivePlan } = useSubscription();
  const { profile } = useAuth();
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [gateway, setGateway] = useState<GatewayInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [username, setUsername] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [senderId, setSenderId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  async function load() {
    const [w, g] = await Promise.all([supabase.rpc("my_wallet"), supabase.rpc("my_sms_gateway")]);
    const wr = Array.isArray(w.data) ? w.data[0] : w.data;
    const gr = Array.isArray(g.data) ? g.data[0] : g.data;
    if (wr) setWallet(wr as WalletInfo);
    if (gr) {
      setGateway(gr as GatewayInfo);
      setUsername(gr.username ?? "");
      setSenderId(gr.sender_id ?? "");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveGateway() {
    if (!username.trim()) return setMessage({ tone: "bad", text: "Username is required." });
    if (!gateway?.has_api_key && !apiKey.trim()) {
      return setMessage({ tone: "bad", text: "API key is required the first time." });
    }

    setSaving(true);
    setMessage(null);

    // Verified through an edge function rather than from the browser,
    // because the API key must not be sent anywhere except our own
    // server, and Africa's Talking has no browser-safe CORS endpoint.
    const { data, error } = await supabase.functions.invoke("verify-sms-gateway", {
      body: {
        username: username.trim(),
        apiKey: apiKey.trim() || null,
        senderId: senderId.trim() || null,
      },
    });

    setSaving(false);
    if (error) return setMessage({ tone: "bad", text: error.message });
    if (data?.error) return setMessage({ tone: "bad", text: data.error });

    setApiKey("");
    setMessage({ tone: "ok", text: "Connected. Your messages will now send through your own account." });
    load();
  }

  async function disconnect() {
    if (!profile?.organizationId) return;
    // Scoped explicitly rather than relying on RLS alone. RLS should stop
    // a broader delete, but a query whose literal meaning is "delete every
    // row" is one policy mistake away from doing exactly that.
    await supabase.from("sms_gateways").delete().eq("organization_id", profile.organizationId);
    setMessage({ tone: "ok", text: "Disconnected. Messages will use the shared sender again." });
    setGateway(null);
    load();
  }

  if (loading) {
    return <div className="wb-card p-5 h-40 animate-pulse bg-paper-sunk" />;
  }

  const allowed = wallet?.allows_own_gateway ?? false;
  const remaining = Math.max(0, (wallet?.included_sms_monthly ?? 0) - (wallet?.included_sms_used ?? 0));

  return (
    <div className="space-y-4 max-w-lg">
      {/* Wallet */}
      <div className="wb-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Wallet size={16} className="text-violet-600" />
          <p className="text-[14px] font-semibold">Message balance</p>
        </div>

        <p className="font-display text-2xl">{kes(wallet?.balance_cents ?? 0)}</p>

        <div className="mt-3 space-y-1.5 text-[12.5px] text-ink-soft">
          <div className="flex justify-between">
            <span>Included SMS left this month</span>
            <span className="font-semibold">
              {remaining} of {wallet?.included_sms_monthly ?? 0}
            </span>
          </div>
          <div className="flex justify-between">
            <span>SMS beyond that</span>
            <span>{kes(wallet?.sms_price_cents ?? 0)} each</span>
          </div>
          <div className="flex justify-between">
            <span>WhatsApp</span>
            <span>{kes(wallet?.whatsapp_price_cents ?? 0)} per conversation</span>
          </div>
          <div className="flex justify-between">
            <span>Email</span>
            <span>Free</span>
          </div>
        </div>

        <button className="wb-btn-primary !text-[12.5px] mt-4">Top up balance</button>

        <p className="text-[11.5px] text-ink-faint mt-3">
          WhatsApp costs more than SMS because Meta charges per conversation. Email costs nothing, so use it for
          anything that is not urgent.
        </p>
      </div>

      {/* Own gateway */}
      <div className="wb-card p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[14px] font-semibold">Send from your own name</p>
            <p className="text-[12.5px] text-ink-soft mt-1">
              Connect your own Africa's Talking account and your clients will see your business name as the sender
              instead of a shared number. You pay Africa's Talking directly, so SMS stops drawing on your balance
              here.
            </p>
          </div>
          {gateway?.is_active && (
            <span className="flex items-center gap-1 text-[10.5px] bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5 shrink-0">
              <Check size={10} /> Active
            </span>
          )}
        </div>

        {!allowed ? (
          <div className="mt-4 bg-paper-sunk rounded-[10px] p-3.5">
            <p className="text-[12.5px] text-ink-soft">
              Available on Growth and Agency. Your {effectivePlan?.name} plan uses the shared sender, which works
              fine, it just shows a generic number.
            </p>
          </div>
        ) : (
          <>
            {/* Registration walkthrough. Written as a numbered path rather
                than a link dump, because the sender ID step is the one
                people miss and it needs Safaricom approval, which takes
                days. Better to know that upfront. */}
            <ol className="mt-4 space-y-2.5 text-[12.5px] text-ink-soft">
              {[
                <>
                  Create a free account at{" "}
                  <a
                    href="https://account.africastalking.com/auth/register"
                    target="_blank"
                    rel="noreferrer"
                    className="text-violet-600 hover:underline inline-flex items-center gap-1"
                  >
                    africastalking.com <ExternalLink size={11} />
                  </a>
                </>,
                <>Create an app inside their dashboard, then open Settings, then API Key, and generate one.</>,
                <>
                  Apply for an Alphanumeric Sender ID with your business name. This needs Safaricom approval and
                  usually takes a few working days, so start it early.
                </>,
                <>Top up their account with airtime credit. They bill you directly for what you send.</>,
                <>Paste your username and API key below.</>,
              ].map((line, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-violet-100 text-violet-700 text-[10px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>

            <div className="mt-4 space-y-3">
              <div>
                <label className="wb-label">Africa's Talking username</label>
                <input
                  className="wb-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Often 'sandbox' while testing"
                />
              </div>

              <div>
                <label className="wb-label">API key</label>
                <input
                  className="wb-input"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={gateway?.has_api_key ? "Saved. Type a new key to replace it." : "Paste your API key"}
                />
                <p className="text-[11px] text-ink-faint mt-1">
                  Stored encrypted and never shown again after saving.
                </p>
              </div>

              <div>
                <label className="wb-label">Sender ID (optional)</label>
                <input
                  className="wb-input"
                  value={senderId}
                  onChange={(e) => setSenderId(e.target.value)}
                  placeholder="Your approved sender name"
                />
                <p className="text-[11px] text-ink-faint mt-1">
                  Leave blank until Safaricom approves yours. Messages still send, just from a shared number.
                </p>
              </div>

              {message && (
                <div
                  className={`flex items-start gap-2 text-[12px] rounded-[8px] p-2.5 ${
                    message.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-coral-50 text-coral-700"
                  }`}
                >
                  {message.tone === "ok" ? (
                    <Check size={13} className="mt-0.5 shrink-0" />
                  ) : (
                    <TriangleAlert size={13} className="mt-0.5 shrink-0" />
                  )}
                  <span>{message.text}</span>
                </div>
              )}

              {gateway?.last_error && !message && (
                <div className="flex items-start gap-2 text-[12px] bg-amber-50 text-amber-900 rounded-[8px] p-2.5">
                  <Info size={13} className="mt-0.5 shrink-0" />
                  <span>Last send failed: {gateway.last_error}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button className="wb-btn-primary !text-[12.5px]" disabled={saving} onClick={saveGateway}>
                  {saving ? "Checking" : gateway?.has_api_key ? "Update and verify" : "Connect and verify"}
                </button>
                {gateway?.has_api_key && (
                  <button className="wb-btn-ghost !text-[12.5px]" onClick={disconnect}>
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
