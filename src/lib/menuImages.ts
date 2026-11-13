import katsuImg from '../assets/images/menu_nasi_ayam_katsu_1794536773887.jpg';
import mieGorengImg from '../assets/images/menu_mie_goreng_1794536774163.jpg';
import jusManggaImg from '../assets/images/menu_jus_mangga_1794536775563.jpg';
import jusAlpukatImg from '../assets/images/menu_jus_alpukat_1794536775737.jpg';
import dimsumImg from '../assets/images/menu_dimsum_1794536775443.jpg';

const PRESET_IMAGES: Record<string, string> = {
  'preset:katsu': katsuImg,
  'preset:mie-goreng': mieGorengImg,
  'preset:jus-mangga': jusManggaImg,
  'preset:jus-alpukat': jusAlpukatImg,
  'preset:dimsum': dimsumImg,
};

export const MENU_IMAGE_PRESETS = [
  { key: 'preset:katsu', label: 'Nasi Ayam Katsu', src: katsuImg },
  { key: 'preset:mie-goreng', label: 'Mie Goreng', src: mieGorengImg },
  { key: 'preset:jus-mangga', label: 'Jus Mangga', src: jusManggaImg },
  { key: 'preset:jus-alpukat', label: 'Jus Alpukat', src: jusAlpukatImg },
  { key: 'preset:dimsum', label: 'Dimsum', src: dimsumImg },
];

export function resolveMenuImage(imageUrl?: string): string | null {
  if (!imageUrl) return null;
  if (PRESET_IMAGES[imageUrl]) return PRESET_IMAGES[imageUrl];
  if (imageUrl.startsWith('data:') || imageUrl.startsWith('http') || imageUrl.startsWith('/')) {
    return imageUrl;
  }
  return null;
}
