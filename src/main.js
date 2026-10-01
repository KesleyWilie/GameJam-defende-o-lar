import './style.css';
import { mount } from './game.js';

const files = import.meta.glob('./assets/*.png', { eager: true, import: 'default' });

async function boot() {
  const images = {};
  await Promise.all(Object.entries(files).map(([path, url]) => new Promise((resolve, reject) => {
    const key = path.split('/').pop().replace(/\.png$/, '');
    const im = new Image();
    im.onload = () => { images[key] = im; resolve(); };
    im.onerror = () => reject(new Error('sprite falhou: ' + key));
    im.src = url;
  })));
  mount(document.getElementById('game'), images);
}

boot();
