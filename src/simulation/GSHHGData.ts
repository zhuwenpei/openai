/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GSHHGLandMass {
  id: number;
  name?: string;
  isMountain: boolean;
  maxElevation: number;
  polygon: [number, number][];
  bbox?: { minLat: number; maxLat: number; minLon: number; maxLon: number };
}

// All original coastlines deleted
const INITIAL_GSHHG_F_LANDMASSES: GSHHGLandMass[] = [];
let loadedLandMasses: GSHHGLandMass[] = [];

export async function loadGSHHGFullData(): Promise<GSHHGLandMass[]> {
  return [];
}

export function getGSHHGFullLandMasses(): GSHHGLandMass[] {
  return [];
}
