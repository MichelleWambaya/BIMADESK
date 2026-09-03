import { Users, User, Store, Building2, UsersRound } from "lucide-react";
import type { ClientType } from "@/types";

/**
 * What each client type means, in one place.
 *
 * The five types were previously handled as "company or not", which broke
 * in two ways once the list grew: a sacco was treated as an individual,
 * and a family had no member schedule. The questions that actually differ
 * between types are worth naming rather than re-deriving with an equality
 * check at each call site.
 */
export const CLIENT_TYPES: {
  key: ClientType;
  label: string;
  description: string;
  icon: typeof User;
  /** Named by an entity name rather than a person's first and last. */
  isEntity: boolean;
  /** Holds a schedule of covered people. */
  hasMembers: boolean;
  /** Has MANY principal members, each with their own dependants. A family
   *  has members but only one principal, which is a different shape. */
  hasManyPrincipals: boolean;
}[] = [
  {
    key: "individual",
    label: "Individual",
    description: "One person, insured in their own name",
    icon: User,
    isEntity: false,
    hasMembers: false,
    hasManyPrincipals: false,
  },
  {
    key: "family",
    label: "Family",
    description: "One policyholder covering a household",
    icon: Users,
    isEntity: false,
    hasMembers: true,
    hasManyPrincipals: false,
  },
  {
    key: "sole_proprietor",
    label: "Sole proprietor",
    description: "Trades under a business name, but insured as a person",
    icon: Store,
    // Legally a person, so KYC wants an ID rather than a certificate of
    // incorporation. It carries a business name for display only.
    isEntity: false,
    hasMembers: false,
    hasManyPrincipals: false,
  },
  {
    key: "company",
    label: "Company",
    description: "Limited company, with staff on the scheme",
    icon: Building2,
    isEntity: true,
    hasMembers: true,
    hasManyPrincipals: true,
  },
  {
    key: "group",
    label: "Sacco or group",
    description: "Sacco, welfare group, or association with many members",
    icon: UsersRound,
    isEntity: true,
    hasMembers: true,
    hasManyPrincipals: true,
  },
];

const byKey = new Map(CLIENT_TYPES.map((t) => [t.key, t]));

/** Falls back to individual for an unrecognised value, which is what any
 *  pre-existing row or a messy import will contain. */
export function clientTypeInfo(type: ClientType | string | undefined) {
  return byKey.get((type ?? "individual") as ClientType) ?? byKey.get("individual")!;
}

export const clientTypeLabel = (t: ClientType | string | undefined) => clientTypeInfo(t).label;
export const isEntityClient = (t: ClientType | string | undefined) => clientTypeInfo(t).isEntity;
export const hasMemberSchedule = (t: ClientType | string | undefined) => clientTypeInfo(t).hasMembers;
export const hasManyPrincipals = (t: ClientType | string | undefined) => clientTypeInfo(t).hasManyPrincipals;

/** Heading for the members panel, which differs by shape. */
export function memberSectionLabel(t: ClientType | string | undefined) {
  const info = clientTypeInfo(t);
  if (info.hasManyPrincipals) return "Members and dependants";
  if (info.hasMembers) return "Family members";
  return "Covered people";
}
