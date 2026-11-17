import os,shutil
here=os.path.dirname(os.path.abspath(__file__)); eng=os.path.join(here,'..','engine','engine'); fab=os.path.join(here,'..','fabrica')
def rd(p): return open(p,encoding='utf-8').read()
parts=[('engine/'+m+'.js',rd(os.path.join(eng,m+'.js'))) for m in ['core','pix','shiba','fx','terrain','rig','audio','nature','ui']]
parts.append(('engine/assets.js',rd(os.path.join(here,'engine','assets.js'))))
parts.append(('fabrica/gen.js',rd(os.path.join(fab,'gen.js'))))
if os.path.exists(os.path.join(fab,'pacotes.js')): parts.append(('pacotes.js',rd(os.path.join(fab,'pacotes.js'))))
game=os.path.join(here,'..','kome','kome')
if os.path.isdir(game):
    for m in ['tools-hand','machines-mid','machines-mine','bagger','colheitadeira','game-world']:
        f=os.path.join(game,'game',m+'.js')
        if os.path.exists(f) and os.path.getsize(f)>0: parts.append(('jogo/'+m+'.js','try{\n'+rd(f)+'\n}catch(e){console.warn("jogo/%s",e)}'%m))
    import glob
    cont='window.KomeConteudo=[];\n'
    for f in sorted(glob.glob(os.path.join(game,'conteudo','*.js'))):
        cont+='try{(function(ficha){\n'+rd(f)+'\n})(function(o){KomeConteudo.push(o)});}catch(e){console.warn(e)}\n'
    parts.append(('jogo/conteudo.js',cont))
for m in ['base','editor','rigs','io','map','library','creature','builders','gamelib','magic','guide','rascunhos','ui']: parts.append(('estudio/'+m+'.js',rd(os.path.join(here,'src',m+'.js'))))
scripts=''.join('<script>\n/* ===== %s ===== */\n%s\n</script>\n'%(n,c.replace('</script','<\\/script')) for n,c in parts)
html=rd(os.path.join(here,'src','page.html')).replace('<!--SCRIPTS-->',scripts)
open(os.path.join(here,'Pixxel_Estudio.html'),'w',encoding='utf-8').write(html)
print('ok',len(html)//1024,'KB')
