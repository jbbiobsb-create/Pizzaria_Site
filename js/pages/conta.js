// Página "Minha conta" (versão mínima: layout + atalhos). O conteúdo completo é montado à parte.
import { montarLayout, montarFooter } from '../ui.js';

montarLayout({ pagina: 'conta', subheader: false });
montarFooter();
