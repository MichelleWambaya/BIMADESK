import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, ShieldCheck, LogOut, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Modal } from "@/components/shared/Modal";
import { ChangePasswordForm } from "./ChangePasswordForm";

const AVATAR_COLORS = ["violet", "amber", "emerald", "coral"];
const COLOR_HEX: Record<string, string> = { violet: "#6D3CE5", amber: "#FF8A1E", emerald: "#12B76A", coral: "#FF5A3C" };

export function AccountSection() {
  const { session, profile, organization, updateProfile, updateOrganization, signOut, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [businessName, setBusinessName] = useState(organization?.name ?? "");
  const [avatarColor, setAvatarColor] = useState(profile?.avatarColor ?? "violet");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwner = profile?.role === "owner";
  const initial = (fullName || organization?.name || "?").slice(0, 1).toUpperCase();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await Promise.all([
      updateProfile({ fullName, phone, avatarColor }),
      isOwner ? updateOrganization({ name: businessName }) : Promise.resolve(),
    ]);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="space-y-4 max-w-lg">
      {/* Identity card, the "who am I signed in as" moment, similar to
          Gmail's account card at the top of its account manager. */}
      <div className="wb-card p-5 flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-white text-[22px] font-display shrink-0"
          style={{ backgroundColor: COLOR_HEX[avatarColor] }}
        >
          {initial}
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold truncate">{fullName || "Add your name"}</p>
          <p className="text-[12.5px] text-ink-faint truncate">{session?.user.email}</p>
          <p className="text-[11.5px] text-ink-faint mt-0.5">{organization?.name}, {isOwner ? "owner" : profile?.role === "admin_user" ? "admin" : "member"}</p>
        </div>
      </div>

      <form onSubmit={save} className="wb-card p-5 space-y-3.5">
        <p className="text-[12px] font-semibold text-ink-soft uppercase tracking-wide">Profile</p>
        <div>
          <label className="wb-label">Your name</label>
          <input className="wb-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        {isOwner && (
          <div>
            <label className="wb-label">Business name</label>
            <input className="wb-input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </div>
        )}
        <div>
          <label className="wb-label">Phone</label>
          <input className="wb-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="wb-label">Avatar color</label>
          <div className="flex gap-2">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAvatarColor(c)}
                className="w-8 h-8 rounded-full flex items-center justify-center border-2"
                style={{ backgroundColor: COLOR_HEX[c], borderColor: avatarColor === c ? "rgb(var(--color-ink))" : "transparent" }}
                aria-label={c}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button type="submit" className="wb-btn-primary" disabled={saving}>{saving ? "Saving" : "Save changes"}</button>
          {saved && <span className="text-[12px] text-emerald-600">Saved.</span>}
        </div>
      </form>

      <div className="wb-card divide-y divide-line">
        <p className="text-[12px] font-semibold text-ink-soft uppercase tracking-wide px-5 pt-4 pb-2">Security</p>
        <button className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-paper-sunk text-left" onClick={() => setChangingPassword(true)}>
          <KeyRound size={16} className="text-ink-faint" />
          <div className="flex-1">
            <p className="text-[13.5px] font-medium">Password</p>
            <p className="text-[11.5px] text-ink-faint">Change the password you sign in with</p>
          </div>
        </button>
        <div className="flex items-center gap-3 px-5 py-3.5">
          <ShieldCheck size={16} className="text-ink-faint" />
          <div className="flex-1">
            <p className="text-[13.5px] font-medium">Signed in as</p>
            <p className="text-[11.5px] text-ink-faint">{session?.user.email}</p>
          </div>
        </div>
        <button className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-paper-sunk text-left" onClick={handleSignOut}>
          <LogOut size={16} className="text-ink-faint" />
          <div className="flex-1">
            <p className="text-[13.5px] font-medium">Sign out</p>
            <p className="text-[11.5px] text-ink-faint">Sign out of BimaDesk on this device</p>
          </div>
        </button>
      </div>

      <div className="wb-card p-5 border-2 border-coral-100">
        <p className="text-[12px] font-semibold text-coral-600 uppercase tracking-wide mb-2">Danger zone</p>
        <p className="text-[12.5px] text-ink-soft mb-3">
          {isOwner
            ? "Deleting your account permanently deletes your entire workspace, including every client, policy, and teammate's access. This cannot be undone."
            : "Deleting your account removes your own access. Your organization and its data are not affected."}
        </p>
        <button className="wb-btn-secondary !border-coral-300 !text-coral-600" onClick={() => setDeleting(true)}>
          Delete account
        </button>
      </div>

      {changingPassword && (
        <Modal title="Change password" onClose={() => setChangingPassword(false)}>
          <ChangePasswordForm onDone={() => setChangingPassword(false)} />
        </Modal>
      )}

      {deleting && (
        <DeleteAccountDialog
          isOwner={isOwner}
          businessName={organization?.name ?? ""}
          onClose={() => setDeleting(false)}
          onDeleted={async () => {
            const { error } = await deleteAccount();
            if (!error) navigate("/", { replace: true });
            return error;
          }}
        />
      )}
    </div>
  );
}

function DeleteAccountDialog({
  isOwner,
  businessName,
  onClose,
  onDeleted,
}: {
  isOwner: boolean;
  businessName: string;
  onClose: () => void;
  onDeleted: () => Promise<string | null>;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requiredText = isOwner ? businessName : "DELETE";
  const canDelete = confirmText.trim() === requiredText.trim() && confirmText.trim().length > 0;

  async function confirm() {
    setDeleting(true);
    setError(null);
    const err = await onDeleted();
    if (err) {
      setDeleting(false);
      setError(err);
    }
  }

  return (
    <Modal title="Delete account" onClose={onClose}>
      <div className="space-y-3.5">
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-[8px] bg-coral-50 text-coral-600">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <p className="text-[12.5px]">
            {isOwner
              ? "This permanently deletes your entire workspace and everyone's access to it. There is no way to undo this."
              : "This permanently deletes your own account. There is no way to undo this."}
          </p>
        </div>
        <div>
          <label className="wb-label">
            Type {isOwner ? <span className="font-mono">{requiredText}</span> : "DELETE"} to confirm
          </label>
          <input className="wb-input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
        </div>
        {error && <p className="text-[12px] text-coral-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button className="wb-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="wb-btn-secondary !border-coral-500 !text-white !bg-coral-500 hover:!bg-coral-600"
            disabled={!canDelete || deleting}
            onClick={confirm}
          >
            {deleting ? "Deleting" : "Delete permanently"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
