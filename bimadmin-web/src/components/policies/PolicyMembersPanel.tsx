import React, { useEffect, useState, useCallback } from "react";
import { UserPlus, Users, ChevronDown, ChevronRight, X, Building2, User } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { todayISO } from "@/lib/date";

interface Member {
  id: string;
  parent_member_id: string | null;
  relationship: string;
  full_name: string;
  date_of_birth: string | null;
  national_id: string | null;
  phone: string | null;
  member_number: string | null;
  employee_number: string | null;
  status: string;
  effective_from: string;
  effective_to: string | null;
}

const DEPENDANT_RELATIONSHIPS = ["spouse", "child", "parent", "sibling", "other"] as const;

const RELATIONSHIP_LABEL: Record<string, string> = {
  principal: "Principal",
  spouse: "Spouse",
  child: "Child",
  parent: "Parent",
  sibling: "Sibling",
  other: "Other",
};

/** Age from a date of birth, used to warn about child age limits rather
 *  than to block anything, since the actual cutoff varies by insurer. */
function ageFrom(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age;
}

export function PolicyMembersPanel({
  policyId,
  clientType,
  clientName,
}: {
  policyId: string;
  clientType: "individual" | "company";
  clientName: string;
}) {
  const isCorporate = clientType === "company";

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addingFor, setAddingFor] = useState<string | null | "principal">(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("policy_members")
      .select("*")
      .eq("policy_id", policyId)
      .neq("status", "removed")
      .order("created_at");
    setMembers((data ?? []) as Member[]);
    setLoading(false);
  }, [policyId]);

  useEffect(() => {
    load();
  }, [load]);

  const principals = members.filter((m) => m.parent_member_id === null);
  const dependantsOf = (id: string) => members.filter((m) => m.parent_member_id === id);

  async function remove(member: Member) {
    const deps = dependantsOf(member.id);
    const warning =
      member.parent_member_id === null && deps.length > 0
        ? `\n\nThis will also remove their ${deps.length} dependant${deps.length === 1 ? "" : "s"}, since dependants are only covered through the principal.`
        : "";

    if (!window.confirm(`Remove ${member.full_name} from this policy?${warning}`)) return;

    const { error } = await supabase.rpc("remove_policy_member", {
      p_member_id: member.id,
      p_effective_date: todayISO(),
      p_reason: null,
    });
    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    load();
  }

  if (loading) {
    return <div className="h-20 rounded-[12px] bg-paper-sunk animate-pulse" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {isCorporate ? (
            <Building2 size={15} className="text-ink-faint shrink-0" />
          ) : (
            <User size={15} className="text-ink-faint shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold">
              {isCorporate ? "Scheme members" : "Covered members"}
            </p>
            <p className="text-[11.5px] text-ink-faint">
              {isCorporate
                ? `${principals.length} ${principals.length === 1 ? "employee" : "employees"}, ${members.length - principals.length} dependants`
                : `${members.length - principals.length} dependant${members.length - principals.length === 1 ? "" : "s"}`}
            </p>
          </div>
        </div>

        {/* Retail policies take exactly one principal, so the button is
            hidden once that slot is filled. Corporate schemes take many. */}
        {(isCorporate || principals.length === 0) && (
          <button
            onClick={() => setAddingFor("principal")}
            className="wb-btn-secondary !text-[12px] shrink-0"
          >
            <UserPlus size={13} />
            {isCorporate ? "Add employee" : "Add principal"}
          </button>
        )}
      </div>

      {error && <p className="text-[12px] text-coral-500">{error}</p>}

      {addingFor === "principal" && (
        <MemberForm
          policyId={policyId}
          parentId={null}
          isCorporate={isCorporate}
          onCancel={() => setAddingFor(null)}
          onSaved={() => {
            setAddingFor(null);
            load();
          }}
        />
      )}

      {principals.length === 0 && addingFor !== "principal" && (
        <p className="text-[12.5px] text-ink-faint py-3">
          {isCorporate
            ? `No employees on this scheme yet. Add the first one to start building ${clientName}'s member list.`
            : "Nobody is recorded as covered yet."}
        </p>
      )}

      <div className="space-y-2">
        {principals.map((p) => {
          const deps = dependantsOf(p.id);
          const isOpen = expanded.has(p.id) || !isCorporate;

          return (
            <div key={p.id} className="border border-line rounded-[12px] overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2.5 bg-paper-sunk/50">
                {isCorporate && (
                  <button
                    onClick={() =>
                      setExpanded((s) => {
                        const next = new Set(s);
                        next.has(p.id) ? next.delete(p.id) : next.add(p.id);
                        return next;
                      })
                    }
                    className="shrink-0 text-ink-faint hover:text-ink"
                    aria-label={isOpen ? "Collapse" : "Expand"}
                  >
                    {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </button>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium truncate">{p.full_name}</p>
                  <p className="text-[11px] text-ink-faint truncate">
                    {[
                      isCorporate ? "Employee" : "Principal",
                      p.employee_number && `Staff ${p.employee_number}`,
                      p.member_number && `Member ${p.member_number}`,
                      deps.length > 0 && `${deps.length} dependant${deps.length === 1 ? "" : "s"}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                <button
                  onClick={() => setAddingFor(p.id)}
                  className="text-[11.5px] text-violet-600 hover:underline shrink-0"
                >
                  Add dependant
                </button>
                <button
                  onClick={() => remove(p)}
                  className="text-ink-faint hover:text-coral-500 shrink-0"
                  aria-label={`Remove ${p.full_name}`}
                >
                  <X size={14} />
                </button>
              </div>

              {isOpen && (
                <div className="divide-y divide-line">
                  {deps.map((d) => {
                    const age = ageFrom(d.date_of_birth);
                    return (
                      <div key={d.id} className="flex items-center gap-2 px-3 py-2 pl-8">
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] truncate">{d.full_name}</p>
                          <p className="text-[11px] text-ink-faint">
                            {RELATIONSHIP_LABEL[d.relationship] ?? d.relationship}
                            {age != null && ` · ${age}`}
                          </p>
                        </div>

                        {/* A warning, not a block. Most Kenyan medical
                            schemes drop children at 18, or 25 if in
                            full time education, but the exact rule is per
                            insurer so the app flags rather than decides. */}
                        {d.relationship === "child" && age != null && age >= 18 && (
                          <span className="text-[10.5px] text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 shrink-0">
                            Check age limit
                          </span>
                        )}

                        <button
                          onClick={() => remove(d)}
                          className="text-ink-faint hover:text-coral-500 shrink-0"
                          aria-label={`Remove ${d.full_name}`}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    );
                  })}

                  {addingFor === p.id && (
                    <div className="p-3 pl-8">
                      <MemberForm
                        policyId={policyId}
                        parentId={p.id}
                        isCorporate={isCorporate}
                        onCancel={() => setAddingFor(null)}
                        onSaved={() => {
                          setAddingFor(null);
                          load();
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MemberForm({
  policyId,
  parentId,
  isCorporate,
  onCancel,
  onSaved,
}: {
  policyId: string;
  parentId: string | null;
  isCorporate: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const isPrincipal = parentId === null;
  const [fullName, setFullName] = useState("");
  const [relationship, setRelationship] = useState<string>(isPrincipal ? "principal" : "spouse");
  const [dob, setDob] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [phone, setPhone] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const FRIENDLY: Record<string, string> = {
    MEMBER_RETAIL_SINGLE_PRINCIPAL:
      "This is an individual client's policy, so it can only have one principal member. Add family as dependants instead.",
    MEMBER_NESTING_TOO_DEEP: "A dependant cannot have their own dependants.",
    MEMBER_DEPENDANT_NEEDS_PRINCIPAL: "Choose who this person is a dependant of.",
  };

  async function save() {
    if (!fullName.trim()) return setError("Enter a full name.");
    setSaving(true);
    setError(null);

    const { error } = await supabase.rpc("add_policy_member", {
      p_policy_id: policyId,
      p_full_name: fullName.trim(),
      p_relationship: relationship,
      p_parent_member_id: parentId,
      p_date_of_birth: dob || null,
      p_national_id: nationalId.trim() || null,
      p_phone: phone.trim() || null,
      p_effective_from: effectiveFrom,
      p_employee_number: employeeNumber.trim() || null,
      p_member_number: null,
      p_reason: null,
    });

    setSaving(false);
    if (error) {
      const key = Object.keys(FRIENDLY).find((k) => error.message.includes(k));
      return setError(key ? FRIENDLY[key] : error.message);
    }
    onSaved();
  }

  return (
    <div className="bg-paper-raised border border-line rounded-[12px] p-3 space-y-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="sm:col-span-2">
          <label className="wb-label">Full name</label>
          <input className="wb-input" value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
        </div>

        {!isPrincipal && (
          <div>
            <label className="wb-label">Relationship</label>
            <select className="wb-input" value={relationship} onChange={(e) => setRelationship(e.target.value)}>
              {DEPENDANT_RELATIONSHIPS.map((r) => (
                <option key={r} value={r}>
                  {RELATIONSHIP_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
        )}

        {isPrincipal && isCorporate && (
          <div>
            <label className="wb-label">Staff number</label>
            <input className="wb-input" value={employeeNumber} onChange={(e) => setEmployeeNumber(e.target.value)} />
          </div>
        )}

        <div>
          <label className="wb-label">Date of birth</label>
          <input type="date" className="wb-input" value={dob} onChange={(e) => setDob(e.target.value)} />
        </div>

        <div>
          <label className="wb-label">National ID</label>
          <input className="wb-input" value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
        </div>

        <div>
          <label className="wb-label">Phone</label>
          <input className="wb-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <div>
          <label className="wb-label">Covered from</label>
          <input
            type="date"
            className="wb-input"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
          <p className="text-[10.5px] text-ink-faint mt-1">
            Mid term additions usually change the premium. Confirm with the insurer.
          </p>
        </div>
      </div>

      {error && <p className="text-[12px] text-coral-500">{error}</p>}

      <div className="flex justify-end gap-2">
        <button className="wb-btn-ghost !text-[12px]" onClick={onCancel}>
          Cancel
        </button>
        <button className="wb-btn-primary !text-[12px]" onClick={save} disabled={saving}>
          {saving ? "Adding" : "Add member"}
        </button>
      </div>
    </div>
  );
}
