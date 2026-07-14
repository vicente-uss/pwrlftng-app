import { Platform } from 'react-native';

export const colors = {
  background: '#080808', canvas: '#050505', surface: '#111111', elevated: '#171717', border: '#1e1e1e',
  text: '#ffffff', muted: '#777777', dim: '#4b4b4b', subtle: '#333333', orange: '#e85500', success: '#22c55e', warning: '#b7791f', danger: '#ef4444',
};
export const condensed = Platform.select({ android: 'sans-serif-condensed', default: 'System' });
export const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const shortDays = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
