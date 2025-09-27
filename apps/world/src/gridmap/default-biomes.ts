import { GridBiome } from './interfaces';

export const DEFAULT_BIOMES: GridBiome[] = [
  {
    coordinates: [
      {
        x: -1,
        y: -1,
      },
      {
        x: 1,
        y: 0,
      },
    ],
    color: '#4f64c9',
    name: 'water',
    id: 0,
  },
  {
    name: 'deep water',
    color: '#4c5aa4',
    coordinates: [
      {
        x: 0,
        y: -1,
      },
      {
        x: 0.5,
        y: -0.5,
      },
    ],
    id: 5,
  },
  {
    coordinates: [
      {
        x: -1,
        y: 0,
      },
      {
        x: 1,
        y: 0.1,
      },
    ],
    color: '#f8d796',
    name: 'beach',
    id: 1,
  },
  {
    coordinates: [
      {
        x: -1,
        y: 0.1,
      },
      {
        x: 1,
        y: 0.5,
      },
    ],
    color: '#61a84d',
    name: 'plain',
    id: 2,
  },
  {
    coordinates: [
      {
        x: 0,
        y: 0.2,
      },
      {
        x: 1,
        y: 0.5,
      },
    ],
    color: '#3b8632',
    name: 'forest',
    id: 3,
  },
  {
    coordinates: [
      {
        x: -1,
        y: 0.5,
      },
      {
        x: 1,
        y: 1,
      },
    ],
    color: '#533e1a',
    name: 'mountain',
    id: 4,
  },
  {
    name: 'ice sea',
    color: '#a8a8fd',
    coordinates: [
      {
        x: 0.5,
        y: -1,
      },
      {
        x: 1,
        y: -0.5,
      },
    ],
    id: 6,
  },
  {
    name: 'shore',
    color: '#3b55bc',
    coordinates: [
      {
        x: -1,
        y: -0.1,
      },
      {
        x: 1,
        y: 0,
      },
    ],
    id: 7,
  },
  {
    name: 'rock',
    color: '#70706e',
    coordinates: [
      {
        x: -1,
        y: 0.6,
      },
      {
        x: 1,
        y: 1,
      },
    ],
    id: 8,
  },
  {
    name: 'snow',
    color: '#e2e1de',
    coordinates: [
      {
        x: -1,
        y: 0.8,
      },
      {
        x: 1,
        y: 1,
      },
    ],
    id: 9,
  },
  {
    name: 'savanna',
    color: '#98cb2a',
    coordinates: [
      {
        x: -1,
        y: 0.3,
      },
      {
        x: -0.3,
        y: 0.5,
      },
    ],
    id: 10,
  },
];
