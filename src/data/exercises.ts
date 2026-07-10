import { Exercise } from '@/types/training';

export const EXERCISES: Exercise[] = [
  {
    id: 'squat',
    name: 'Squat',
    primaryMuscle: 'Cuádriceps',
    secondaryMuscles: ['Glúteos', 'Isquiosurales', 'Core'],
    isUnilateral: false,
  },
  {
    id: 'bench-press',
    name: 'Bench Press',
    primaryMuscle: 'Pecho',
    secondaryMuscles: ['Tríceps', 'Deltoide anterior'],
    isUnilateral: false,
  },
  {
    id: 'deadlift',
    name: 'Deadlift',
    primaryMuscle: 'Espalda baja',
    secondaryMuscles: ['Glúteos', 'Isquiosurales', 'Trapecio'],
    isUnilateral: false,
  },
  {
    id: 'barbell-row',
    name: 'Remo con barra',
    primaryMuscle: 'Espalda',
    secondaryMuscles: ['Bíceps', 'Trapecio posterior'],
    isUnilateral: false,
  },
  {
    id: 'overhead-press',
    name: 'Press militar',
    primaryMuscle: 'Hombros',
    secondaryMuscles: ['Tríceps', 'Core'],
    isUnilateral: false,
  },
  {
    id: 'lat-pulldown',
    name: 'Jalón al pecho',
    primaryMuscle: 'Dorsal',
    secondaryMuscles: ['Bíceps', 'Redondo mayor'],
    isUnilateral: false,
  },
  {
    id: 'barbell-curl',
    name: 'Curl de bíceps con barra',
    primaryMuscle: 'Bíceps',
    secondaryMuscles: ['Antebrazo'],
    isUnilateral: false,
  },
  {
    id: 'triceps-extension',
    name: 'Extensión de tríceps',
    primaryMuscle: 'Tríceps',
    secondaryMuscles: [],
    isUnilateral: false,
  },
  {
    id: 'leg-extension',
    name: 'Extensión de cuádriceps',
    primaryMuscle: 'Cuádriceps',
    secondaryMuscles: [],
    isUnilateral: false,
  },
  {
    id: 'leg-curl',
    name: 'Curl femoral',
    primaryMuscle: 'Isquiosurales',
    secondaryMuscles: ['Gemelos'],
    isUnilateral: false,
  },
  {
    id: 'calf-raise',
    name: 'Elevación de gemelos',
    primaryMuscle: 'Gemelos',
    secondaryMuscles: [],
    isUnilateral: false,
  },
  {
    id: 'hip-thrust',
    name: 'Hip thrust',
    primaryMuscle: 'Glúteos',
    secondaryMuscles: ['Isquiosurales', 'Core'],
    isUnilateral: false,
  },
  {
    id: 'face-pull',
    name: 'Face pull',
    primaryMuscle: 'Deltoide posterior',
    secondaryMuscles: ['Trapecio', 'Manguito rotador'],
    isUnilateral: false,
  },
  {
    id: 'plank',
    name: 'Plancha abdominal',
    primaryMuscle: 'Core',
    secondaryMuscles: ['Glúteos'],
    isUnilateral: false,
  },
];

export function findExercise(exerciseId: string) {
  return EXERCISES.find((exercise) => exercise.id === exerciseId);
}
