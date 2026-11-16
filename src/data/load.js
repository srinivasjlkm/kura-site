import data from './site.json';
import { SIZE_NAMES } from '../../scripts/parse.mjs';
export const site = data;
export const projects = data.projects;
export const sizeName = (s) => SIZE_NAMES[s] || '';
export const SIZE_ORDER = ['S', 'M', 'L', 'XL'];
const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
export const url = (p = '') => base + String(p).replace(/^\//, '');
