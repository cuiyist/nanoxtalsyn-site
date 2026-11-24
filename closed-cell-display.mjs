import {closedCrystalCell} from './closed-cell-geometry.mjs?v=0.52.0';

// Convert only the display coordinates; keep the original CIF and scope.
export function assembleCellView(model,vectors,repeats=1){
  const display=closedCrystalCell({...model,cellVectors:vectors},repeats);
  const atoms=display.atoms.map(a=>({...a,
    properties:{...a.properties,display_occupancy:Object.hasOwn(a,'occupancy')?a.occupancy:1,components:a.components}}));
  return {...display,atoms};
}
