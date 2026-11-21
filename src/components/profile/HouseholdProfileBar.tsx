"use client";

import type {
  CommuteMode,
  CookingFuel,
  HeatingSource,
  HouseholdProfile,
  PurifierSetup,
  Vulnerability,
} from "@/lib/schemas";

interface HouseholdProfileBarProps {
  profile: HouseholdProfile;
  onChange: (next: HouseholdProfile) => void;
}

const VULNERABILITIES: ReadonlyArray<{ id: Vulnerability; label: string }> = [
  { id: "children", label: "Children" },
  { id: "elderly", label: "Elderly" },
  { id: "asthma", label: "Asthma" },
  { id: "pets", label: "Pets" },
];

export function HouseholdProfileBar({
  profile,
  onChange,
}: HouseholdProfileBarProps) {
  function toggleVulnerability(item: Vulnerability) {
    const exists = profile.vulnerabilities.includes(item);
    const nextVulns = exists
      ? profile.vulnerabilities.filter((v) => v !== item)
      : [...profile.vulnerabilities, item];
    onChange({ ...profile, vulnerabilities: nextVulns });
  }

  return (
    <section
      aria-label="Household and lifestyle configuration"
      className="border-b border-[#D8D2C5] bg-[#ECE8DF]/75 px-4 py-3 sm:px-6"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        {/* Scope + Vulnerabilities */}
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <span className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-wider text-[#52525B]">
              Scope
            </span>
            <div
              role="group"
              aria-label="Guidance scope"
              className="inline-flex rounded-lg border border-[#D8D2C5] bg-[#F6F4EF] p-0.5 shadow-beautiful-sm"
            >
              <button
                type="button"
                aria-pressed={profile.scope === "household"}
                onClick={() => onChange({ ...profile, scope: "household" })}
                className={
                  profile.scope === "household"
                    ? "rounded-md bg-[#18181B] px-2.5 py-1 text-xs font-semibold text-[#FCFBF8]"
                    : "rounded-md px-2.5 py-1 text-xs font-medium text-[#52525B] hover:text-[#18181B]"
                }
              >
                Household
              </button>
              <button
                type="button"
                aria-pressed={profile.scope === "community"}
                onClick={() => onChange({ ...profile, scope: "community" })}
                className={
                  profile.scope === "community"
                    ? "rounded-md bg-[#18181B] px-2.5 py-1 text-xs font-semibold text-[#FCFBF8]"
                    : "rounded-md px-2.5 py-1 text-xs font-medium text-[#52525B] hover:text-[#18181B]"
                }
              >
                Community
              </button>
            </div>
          </div>

          <div>
            <span className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-wider text-[#52525B]">
              Sensitive Groups
            </span>
            <div className="flex flex-wrap gap-1.5">
              {VULNERABILITIES.map((item) => {
                const active = profile.vulnerabilities.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleVulnerability(item.id)}
                    className={
                      active
                        ? "rounded-md border border-[#0F6E6E] bg-[#E6F4F1] px-2.5 py-1 text-xs font-semibold text-[#0F6E6E]"
                        : "rounded-md border border-[#D8D2C5] bg-[#FCFBF8] px-2.5 py-1 text-xs font-medium text-[#52525B] hover:bg-[#F6F4EF]"
                    }
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selectors: Commute, Purifier, Cooking, Heating */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div>
            <label
              htmlFor="profile-commute"
              className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-wider text-[#52525B]"
            >
              Commute
            </label>
            <select
              id="profile-commute"
              value={profile.commute}
              onChange={(e) =>
                onChange({ ...profile, commute: e.target.value as CommuteMode })
              }
              className="w-full rounded-lg border border-[#D8D2C5] bg-[#FCFBF8] px-2 py-1.5 text-xs font-medium text-[#18181B] shadow-beautiful-sm"
            >
              <option value="solo_car">Solo Car</option>
              <option value="two_wheeler">Two-Wheeler</option>
              <option value="transit">Metro / Bus</option>
              <option value="carpool">Carpool</option>
              <option value="walk_cycle">Walk / Cycle</option>
              <option value="remote">Work Remote</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="profile-purifier"
              className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-wider text-[#52525B]"
            >
              Air Filtration
            </label>
            <select
              id="profile-purifier"
              value={profile.purifier}
              onChange={(e) =>
                onChange({
                  ...profile,
                  purifier: e.target.value as PurifierSetup,
                })
              }
              className="w-full rounded-lg border border-[#D8D2C5] bg-[#FCFBF8] px-2 py-1.5 text-xs font-medium text-[#18181B] shadow-beautiful-sm"
            >
              <option value="none">No Purifier</option>
              <option value="diy_box">DIY MERV-13 Box</option>
              <option value="hepa">HEPA Purifier</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="profile-cooking"
              className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-wider text-[#52525B]"
            >
              Cooking
            </label>
            <select
              id="profile-cooking"
              value={profile.cookingFuel}
              onChange={(e) =>
                onChange({
                  ...profile,
                  cookingFuel: e.target.value as CookingFuel,
                })
              }
              className="w-full rounded-lg border border-[#D8D2C5] bg-[#FCFBF8] px-2 py-1.5 text-xs font-medium text-[#18181B] shadow-beautiful-sm"
            >
              <option value="gas">Gas Stove</option>
              <option value="electric">Electric / Induction</option>
              <option value="biomass">Solid Fuel / Biomass</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="profile-heating"
              className="mb-1 block font-mono text-[10px] font-medium uppercase tracking-wider text-[#52525B]"
            >
              Winter Heat
            </label>
            <select
              id="profile-heating"
              value={profile.heating}
              onChange={(e) =>
                onChange({
                  ...profile,
                  heating: e.target.value as HeatingSource,
                })
              }
              className="w-full rounded-lg border border-[#D8D2C5] bg-[#FCFBF8] px-2 py-1.5 text-xs font-medium text-[#18181B] shadow-beautiful-sm"
            >
              <option value="electric">Electric</option>
              <option value="gas">Gas Heater</option>
              <option value="solid_fuel">Wood / Coal</option>
              <option value="none">No Active Heat</option>
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}
