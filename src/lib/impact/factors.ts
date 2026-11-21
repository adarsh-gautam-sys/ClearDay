import type { ImpactCategory, PurifierSetup } from "../schemas";

export interface ImpactFactor {
  label: string;
  indoorPm25ReductionFraction: number;
  dailyCo2KgSaved: number;
  dailyPm25GramsAvoided: number;
  methodologyNote: string;
  sourceCitation: string;
}

/**
 * Deterministic environmental & exposure factors grounded in US EPA, WHO,
 * DEFRA GHG conversion tables, and Berkeley Earth PM2.5 equivalence.
 */
export const IMPACT_FACTORS: Record<ImpactCategory, ImpactFactor> = {
  hepa_filtration: {
    label: "True HEPA Room Filtration",
    indoorPm25ReductionFraction: 0.58,
    dailyCo2KgSaved: 0,
    dailyPm25GramsAvoided: 0,
    methodologyNote:
      "EPA indoor air quality studies measure 50–65% PM2.5 reduction in sealed rooms sized to CADR.",
    sourceCitation: "US EPA Guide to Air Cleaners in the Home",
  },
  diy_corsi_box: {
    label: "DIY MERV-13 Box Fan Filter",
    indoorPm25ReductionFraction: 0.48,
    dailyCo2KgSaved: 0,
    dailyPm25GramsAvoided: 0,
    methodologyNote:
      "Lab tests of single-filter & Corsi-Rosenthal MERV-13 fan boxes achieve 45–55% PM2.5 drop.",
    sourceCitation: "UC Davis / EPA DIY Air Cleaner Testing",
  },
  draft_sealing: {
    label: "Threshold & Window Gap Sealing",
    indoorPm25ReductionFraction: 0.16,
    dailyCo2KgSaved: 0.45,
    dailyPm25GramsAvoided: 0,
    methodologyNote:
      "Weatherstripping / damp-towel door sealing lowers winter smog infiltration and heating loss by ~15%.",
    sourceCitation: "US DOE Weatherization & ASHRAE 62.2",
  },
  exhaust_cooking: {
    label: "Vented Exhaust + Lid-On Cooking",
    indoorPm25ReductionFraction: 0.24,
    dailyCo2KgSaved: 0.35,
    dailyPm25GramsAvoided: 0.3,
    methodologyNote:
      "Hood venting + electric kettle/induction prep cuts indoor NO₂ and cooking aerosol spikes ~24%.",
    sourceCitation: "Lawrence Berkeley National Lab Cooking Study",
  },
  no_indoor_combustion: {
    label: "Zero Incense, Candles & Indoor Smoke",
    indoorPm25ReductionFraction: 0.14,
    dailyCo2KgSaved: 0.1,
    dailyPm25GramsAvoided: 0.25,
    methodologyNote:
      "Eliminates acute indoor PM2.5 spikes that remain trapped inside sealed winter rooms.",
    sourceCitation: "WHO Guidelines for Indoor Air Quality",
  },
  window_timing: {
    label: "Inversion-Aware Ventilation Timing",
    indoorPm25ReductionFraction: 0.12,
    dailyCo2KgSaved: 0,
    dailyPm25GramsAvoided: 0,
    methodologyNote:
      "Purging only during midday boundary-layer mixing avoids pulling morning/night peak smog indoors.",
    sourceCitation: "Open-Meteo Diurnal Boundary Layer Analysis",
  },
  damp_cleaning: {
    label: "Damp Mopping vs Dry Sweeping",
    indoorPm25ReductionFraction: 0.09,
    dailyCo2KgSaved: 0,
    dailyPm25GramsAvoided: 0,
    methodologyNote:
      "Captures settled soot without resuspending fine particles into breathing-zone air.",
    sourceCitation: "US EPA Indoor Particulate Control",
  },
  car_to_transit: {
    label: "Swap Solo Car Trip for Metro / Bus",
    indoorPm25ReductionFraction: 0.04,
    dailyCo2KgSaved: 3.1,
    dailyPm25GramsAvoided: 0.65,
    methodologyNote:
      "Replacing a 16 km daily round-trip (~0.192 kg CO₂/km car minus ~0.05 kg transit + exhaust/tire PM).",
    sourceCitation: "UK DEFRA 2024 & EPA Tailpipe Factors",
  },
  two_wheeler_to_transit: {
    label: "Swap Two-Wheeler for Transit / Mask",
    indoorPm25ReductionFraction: 0.06,
    dailyCo2KgSaved: 1.4,
    dailyPm25GramsAvoided: 0.55,
    methodologyNote:
      "Avoids high tailpipe-level commuter inhalation and cuts urban two-stroke/four-stroke hydrocarbon emissions.",
    sourceCitation: "ICCT Urban Two-Wheeler Emissions Inventory",
  },
  carpool_school_run: {
    label: "Neighborhood School-Run Carpool",
    indoorPm25ReductionFraction: 0,
    dailyCo2KgSaved: 2.2,
    dailyPm25GramsAvoided: 0.45,
    methodologyNote:
      "Consolidating 3 households per school run removes 2 idling morning vehicles during peak inversion.",
    sourceCitation: "US EPA School Idling & Trip Consolidation",
  },
  electric_heating_swap: {
    label: "Clean Electric Heating / No Biomass",
    indoorPm25ReductionFraction: 0.34,
    dailyCo2KgSaved: 2.8,
    dailyPm25GramsAvoided: 3.4,
    methodologyNote:
      "Replacing wood/coal/kerosene space heat avoids heavy residential PM2.5 smoke indoors and downwind.",
    sourceCitation: "WHO Residential Heating & Solid Fuel Review",
  },
  community_carpool: {
    label: "Community Bulk Errands & Zero-Burn Pledge",
    indoorPm25ReductionFraction: 0,
    dailyCo2KgSaved: 1.9,
    dailyPm25GramsAvoided: 1.2,
    methodologyNote:
      "Shared errands + banning leaf/trash burning curb neighborhood ground-level inversion plumes.",
    sourceCitation: "UNEP Clean Air Community Action Framework",
  },
};

export const BASELINE_INFILTRATION_BY_PURIFIER: Record<PurifierSetup, number> = {
  none: 0.65,
  diy_box: 0.45,
  hepa: 0.38,
};

export const WINTER_SEASON_DAYS = 90;
export const PM25_PER_CIGARETTE_UG_M3 = 22;
export const CAR_WEEKLY_CO2_KG = 88.5;
