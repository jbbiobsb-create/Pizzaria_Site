// carrinho.html foi unificado com checkout.html ("Fechar pedido"). Este módulo só redireciona
// (links antigos, atalho "Sacola" do PWA e páginas em cache do service worker).
location.replace('checkout.html' + location.search + location.hash);
