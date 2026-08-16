import type { ParameterPreset } from '../types/simulation';

export const PRESETS: ParameterPreset[] = [
  {
    id: 'nephrops',
    name: 'Nephrops norvegicus (Norway Lobster)',
    description: 'Complete 4-run study from Gaten et al. (2013) comparing flat vs pointy rhabdoms across light-adapted (FL/PL) and dark-adapted (FA/PA) morphologies.',
    category: 'Decapoda',
    citation: 'Gaten et al. (2013), Adv. Mar. Biol. 107:148',
    parameters: [
      {
        speciesName: 'nephropsfl',
        rhabdomLength: 180,
        rhabdomWidth: 25,
        eyeDiameter: 7800,
        facetWidth: 50,
        apertureDiameter: 3200,
        cytoplasmRefractiveIndex: 1.34,
        rhabdomRefractiveIndex: 1.37,
        blurCircleExtent: 18,
        proximalRhabdomAngle: 0,
      },
      {
        speciesName: 'nephropspl',
        rhabdomLength: 180,
        rhabdomWidth: 25,
        eyeDiameter: 7800,
        facetWidth: 50,
        apertureDiameter: 3200,
        cytoplasmRefractiveIndex: 1.34,
        rhabdomRefractiveIndex: 1.37,
        blurCircleExtent: 18,
        proximalRhabdomAngle: 12.5,
      },
      {
        speciesName: 'nephropsfa',
        rhabdomLength: 180,
        rhabdomWidth: 25,
        eyeDiameter: 6760,
        facetWidth: 50,
        apertureDiameter: 3060,
        cytoplasmRefractiveIndex: 1.34,
        rhabdomRefractiveIndex: 1.37,
        blurCircleExtent: 10,
        proximalRhabdomAngle: 0,
      },
      {
        speciesName: 'nephropspa',
        rhabdomLength: 180,
        rhabdomWidth: 25,
        eyeDiameter: 6760,
        facetWidth: 50,
        apertureDiameter: 3060,
        cytoplasmRefractiveIndex: 1.34,
        rhabdomRefractiveIndex: 1.37,
        blurCircleExtent: 10,
        proximalRhabdomAngle: 12.5,
      },
    ],
  },
  {
    id: 'acanthephyra',
    name: 'Acanthephyra purpurea (Deep-Sea Shrimp)',
    description: 'Deep sea pelagic shrimp optical simulation comparing different blur circle extents (1, 3, 6) across the clear zone.',
    category: 'Caridea',
    citation: 'Moss (2025)',
    parameters: [
      {
        speciesName: 'acanthephyra',
        rhabdomLength: 127,
        rhabdomWidth: 15.8,
        eyeDiameter: 2480,
        facetWidth: 22.5,
        apertureDiameter: 870,
        cytoplasmRefractiveIndex: 1.34,
        rhabdomRefractiveIndex: 1.37,
        blurCircleExtent: 1,
        proximalRhabdomAngle: 0,
      },
      {
        speciesName: 'acanthephyra_bce3',
        rhabdomLength: 127,
        rhabdomWidth: 15.8,
        eyeDiameter: 2480,
        facetWidth: 22.5,
        apertureDiameter: 870,
        cytoplasmRefractiveIndex: 1.34,
        rhabdomRefractiveIndex: 1.37,
        blurCircleExtent: 3,
        proximalRhabdomAngle: 0,
      },
      {
        speciesName: 'acanthephyra_bce6',
        rhabdomLength: 127,
        rhabdomWidth: 15.8,
        eyeDiameter: 2480,
        facetWidth: 22.5,
        apertureDiameter: 870,
        cytoplasmRefractiveIndex: 1.34,
        rhabdomRefractiveIndex: 1.37,
        blurCircleExtent: 6,
        proximalRhabdomAngle: 0,
      },
    ],
  },
  {
    id: 'astacodes',
    name: 'Astacodes sp. (Cretaceous Spiny Lobster)',
    description: 'Cretaceous palinurid known only from fossils, modelled here from fossil eye dimensions. Small reflecting superposition eye: 7 facets across the eyeshine patch and a 4.12 deg ommatidial angle, the coarsest angular sampling of the bundled examples.',
    category: 'Achelata',
    parameters: [
      {
        // These are the measurements shipped in example_data. Earlier versions of
        // this preset carried scaled-down placeholder values (100/10/1000/20/500)
        // that matched no measured eye.
        speciesName: 'astacodes',
        rhabdomLength: 84,
        rhabdomWidth: 16,
        eyeDiameter: 890,
        facetWidth: 32,
        apertureDiameter: 445,
        cytoplasmRefractiveIndex: 1.34,
        rhabdomRefractiveIndex: 1.37,
        // The published row carried a blur circle of 18 rhabdoms, copied from the
        // Nephrops template line sitting directly above it in the original source.
        // This eye has only 7 facets across the eyeshine patch, so 18 is unreachable.
        // 4 reproduces the Nephrops blur circle diameter it was copied from
        // (24.72 deg against 24.98 deg).
        blurCircleExtent: 4,
        proximalRhabdomAngle: 0,
      },
    ],
  },
];
