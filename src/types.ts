/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum TyphoonCategory {
  TD = "热带低压",
  TS = "热带风暴",
  STS = "强热带风暴",
  TY = "台风",
  STY = "强台风",
  SuperTY = "超强台风",
  ET = "温带气旋",
  DS = "已消散"
}

export interface StationReading {
  name: string;
  windSpeed: number;
  pressure: number;
  precipitation: number;
  maxWindSpeed: number;
  accumPrecip: number;
  casualties: number;
  warning: string;
}

export interface TyphoonState {
  lat: number;
  lon: number;
  vmax: number; // m/s
  pmin: number;
  direction: number; // degrees
  speed: number; // km/h
  rmw: number; // km
  r7: { ne: number; se: number; sw: number; nw: number };
  r10: { ne: number; se: number; sw: number; nw: number };
  r12: { ne: number; se: number; sw: number; nw: number };
  category: TyphoonCategory;
  simHour: number;
  maxR7Limit?: number;
  landed: boolean;
  dissipated: boolean;
  extrTransition: number; // 0 - 1
  ewrcState: "none" | "forming" | "max_decay" | "completed" | "recovering_success" | "recovering_failure" | "penalty_failure";
  ewrcProgress: number; // 0 - 1
  ewrcDuration?: number;
  ewrcWeakenAmount?: number;
  ewrcColdWakeHours?: number;
  ewrcL12LandHours?: number;
  ewrcPenaltyTotalHours?: number;
  ewrcFailurePenaltyHours?: number;
  ewrcIsFailure?: boolean;
  ewrcStartVmax?: number;
  ewrcExtraAdjust?: number;
  ewrcRecoveryDuration?: number;
  ewrcCount?: number;
  rapidIntensifying: boolean;
  forcedRapidIntensification?: boolean;
  isEyeClogged?: boolean;
  cloggedRecoveryHours?: number;
  cloggedRecoveryTotalHours?: number;
  dryAirPenaltyHours?: number;
  dryAirPenaltyTotalHours?: number;
  shearPenaltyHours?: number;
  shearPenaltyTotalHours?: number;
  upwellingHours?: number; // accumulated slow/spinning hours
  consecutiveUpwellingHours?: number;
  upwellingPersistentPenaltyHours?: number;
  tdHours?: number;
  landTdHours?: number;
  superTyLandHours?: number;
  landHours?: number;
  landContactHours?: number;
  r10LandContactHours?: number;
  vmax6Hours?: number; // accumulated hours at wind force <= 6
  etHours?: number;
  casualties?: number;
  forecastPath?: Array<{ lat: number; lon: number; vmax: number; pmin: number;
  simHour: number; category: TyphoonCategory; speed: number }>;
  stationReadings?: StationReading[];
  highElevationHours?: number;
  landfallElevation?: number;
  isCoreDisrupted?: boolean;
  passedTaiwanCentral?: boolean;
  passedLuzonMountains?: boolean;
  exitLandSimHour?: number;
  maxLandElevationPassed?: number;
  structuralDamageHours?: number;
  warmWaterHoursAfterSea?: number;
  isStructureDamaged?: boolean;
  structuralDamagePenaltyFactor?: number;
  upwellingLogged?: boolean;
  ewrcCooldownHours?: number;
  shear?: number;
  shearDir?: number;
  upwellingIntensity?: number;
  eyeType?: "none" | "small_round" | "large_round" | "irregular" | "gap" | "eccentric" | "broken";
  structuralState?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  lastJoyU?: number;
  lastJoyV?: number;
  isManualSteering?: boolean;
  lastVelocityU?: number;
  lastVelocityV?: number;
  forcedDecayStartVmax?: number;
  forcedDecayTargetVmax?: number;
  forcedDecayElapsedHours?: number;
  forcedDecayDuration?: number;
  forcedDecayIsContinuous?: boolean;
  osmLandName?: string;
  landfallRecords?: Array<{ lat: number; lon: number; vmax: number; simHour: number; region: string }>;
  configSnapshot?: SimulationConfig;
  forcedShear?: number;
  forcedEWRC?: "success" | "failure";
  forcedDryAir?: "core" | "periphery";
  manualForcedDecay?: {
    startVmax?: number;
    targetVmax: number;
    elapsedHours?: number;
    duration: number;
  };
}

export interface Typhoon {
  id: string;
  name: string;
  lat: number;
  lon: number;
  vmax: number;
  pmin: number;
  direction: number;
  speed: number;
  rmw: number;
  r7: { ne: number; se: number; sw: number; nw: number };
  r10: { ne: number; se: number; sw: number; nw: number };
  r12: { ne: number; se: number; sw: number; nw: number };
  active: boolean;
  category: TyphoonCategory;
  landed: boolean;
  dissipated: boolean;
  extrTransition: number; // 0 - 1
  ewrcState: "none" | "forming" | "max_decay" | "completed" | "recovering_success" | "recovering_failure" | "penalty_failure";
  ewrcProgress: number;
  ewrcDuration?: number;
  ewrcWeakenAmount?: number;
  ewrcColdWakeHours?: number;
  ewrcL12LandHours?: number;
  ewrcStartVmax?: number;
  ewrcExtraAdjust?: number;
  ewrcRecoveryDuration?: number;
  ewrcPenaltyTotalHours?: number;
  ewrcFailurePenaltyHours?: number;
  ewrcIsFailure?: boolean;
  rapidIntensifying: boolean;
  forcedRapidIntensification?: boolean;
  isEyeClogged?: boolean;
  cloggedRecoveryHours?: number;
  cloggedRecoveryTotalHours?: number;
  dryAirPenaltyHours?: number;
  dryAirPenaltyTotalHours?: number;
  shearPenaltyHours?: number;
  shearPenaltyTotalHours?: number;
  history: TyphoonState[];
  forecastPath?: Array<{ lat: number; lon: number; vmax: number; pmin: number;
  simHour: number; category: TyphoonCategory; speed: number }>;
  maxR7Limit?: number; // maximum r7 limit in km
  upwellingHours?: number; // accumulated slow/spinning hours
  tdHours?: number;
  landTdHours?: number;
  superTyLandHours?: number;
  landHours?: number;
  landContactHours?: number;
  r10LandContactHours?: number;
  vmax6Hours?: number; // accumulated hours at wind force <= 6
  etHours?: number;
  casualties?: number;
  simHour?: number;
  stationReadings?: StationReading[];
  highElevationHours?: number;
  landfallElevation?: number;
  isCoreDisrupted?: boolean;
  passedTaiwanCentral?: boolean;
  passedLuzonMountains?: boolean;
  exitLandSimHour?: number;
  maxLandElevationPassed?: number;
  structuralDamageHours?: number;
  warmWaterHoursAfterSea?: number;
  isStructureDamaged?: boolean;
  structuralDamagePenaltyFactor?: number;
  upwellingLogged?: boolean;
  ewrcCooldownHours?: number;
  ewrcCount?: number;
  consecutiveUpwellingHours?: number;
  upwellingPersistentPenaltyHours?: number;
  shear?: number;
  shearDir?: number;
  upwellingIntensity?: number;
  eyeType?: "none" | "small_round" | "large_round" | "irregular" | "gap" | "eccentric" | "broken";
  structuralState?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  lastJoyU?: number;
  lastJoyV?: number;
  isManualSteering?: boolean;
  lastVelocityU?: number;
  lastVelocityV?: number;
  forcedDecayStartVmax?: number;
  forcedDecayTargetVmax?: number;
  forcedDecayElapsedHours?: number;
  forcedDecayDuration?: number;
  forcedDecayIsContinuous?: boolean;
  osmLandName?: string;
  landfallRecords?: Array<{ lat: number; lon: number; vmax: number; simHour: number; region: string }>;
  configSnapshot?: SimulationConfig;
  forcedShear?: number;
  forcedEWRC?: "success" | "failure";
  forcedDryAir?: "core" | "periphery";
  manualForcedDecay?: {
    startVmax?: number;
    targetVmax: number;
    elapsedHours?: number;
    duration: number;
  };
}

export interface SimulationConfig {
  uiStyle?: "default" | "professional" | "ios" | "light";
  subtropicalHighEnabled: boolean;
  subtropicalHighStrength: number; // 0% - 200% (0 - 2)
  subtropicalHighLat: number; // 18 - 45
  subtropicalHighLon: number; // 120 - 150
  subtropicalHighWestExtent: number; // 110 - 140
  subtropicalHighNSSize?: number; // 0.5 - 2.0 (North-South size multiplier)
  westerliesEnabled: boolean;
  westerliesStrength: number; // 0% - 200% (0 - 2)
  westerliesLat: number; // 28 - 45
  westerliesTroughLon: number; // 110 - 140
  westerliesTroughDepth: number; // 0 - 2
  betaDriftEnabled: boolean;
  betaDriftScale: number; // 0 - 2
  monsoonTroughEnabled: boolean;
  eastWaveEnabled: boolean;
  shearPreset?: string; // 'global_low', 'january', 'february', ..., 'december'
  shearScale: number; // 0 - 2
  shear?: number;
  dryAirStrength?: number;
  sstBase?: number;
  sstPivotLat?: number;
  humidityScale: number; // 0 - 2
  outflowScale: number; // 0 - 2
  dryAirEnabled: boolean;
  randomNoise: number; // 0 - 1
  sstAnomaly: number; //
  sstNorthSouthGradient?: number; // 0% - 100% (0 - 1.0)
  ohcScale: number; // 0 - 2
  warmPoolEnabled: boolean;
  coldEddyEnabled: boolean;
  airSeaCoupling: number; // 0 - 1
  ewrcTrigger: "auto" | "off" | "force";
  rapidIntensifyEnabled: boolean;
  landDecayEnabled: boolean;
  terrainDecayEnabled: boolean;
  categoryColors?: Record<string, string>;
  landfallDecayAdjustment: number;
  landProximityDecayAdjustment: number;
  landTdDissipateMode?: "6h" | "never";
  etEnabled: boolean;
  fujiwharaEnabled: boolean;
  seed: string;
  joystickSensitivity: number;
  joystickStrength: number;
  joystickDx: number; // joystick current horizontal offset -1 to 1
  joystickDy: number; // joystick current vertical offset -1 to 1
  joystickDragging?: boolean;
  soundEnabled: boolean;
  soundVolume: number;
  soundMode?: "mahjong" | "mouse";
  cityDensity?: number; // 0 to 100
  followMainTyphoon: boolean;
  maxIntensityLimitEnabled?: boolean;
  maxIntensityLimit?: number; // m/s
  intensificationRate?: number; // 0 - 2
  upwellingFactor?: number; // -1 to 1 or -50 to 50
  stationLabels?: boolean;
  capsuleSize?: number;
  showTopBar?: boolean;
  coastlineSource?: string;
  steeringBiasU?: number;
  steeringBiasV?: number;
  speed?: number;
}

export interface ActiveLayers {
  baseMap: "dark" | "satellite" | "terrain" | "light" | "googleSatellite" | "googleStreet" | "blueMarble" | "bingSatellite" | "none";
  border: boolean;
  coastline: boolean;
  sst: boolean;
  ohc: boolean;
  windShear?: boolean;
  shear?: boolean;
  strongDryAir?: boolean;
  strongWindShear?: boolean;
  pressure: boolean;
  height500: boolean;
  subHigh: boolean;
  westerlies: boolean;
  wind850: boolean;
  wind500: boolean;
  wind200: boolean;
  steering: boolean;
  track: boolean;
  windRadii: boolean;
  forecast: boolean;
  forecastCone: boolean;
  radar: boolean;
  clouds: boolean;
  precipitation: boolean;
  precipitationAccumulated?: boolean;
  maxWindSpeedAccumulated?: boolean;
  weatherStations?: boolean;
  capsuleSize?: number;
  stationLabels?: boolean;
  cursor?: boolean;
  showTopBar?: boolean;
  showCenterPoint?: boolean;
  showNews?: boolean;
  rasterResolution: number;
}

export interface EventLog {
  id: string;
  time: Date;
  simHour: number;
  type: "info" | "success" | "warning" | "danger";
  message: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "danger";
}

