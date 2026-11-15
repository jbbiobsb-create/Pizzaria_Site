# Kome no Japao - GDD v4 economy sim (standalone, single source of truth for costs).
# Run:  python3 -I final4.py          (table + asserts)
#       python3 -I final4.py --js     (also prints the TREE / TOOLS JS literals used in GDD4.md)
# Greedy buyer (cheapest unlocked item first), 1 s steps, averaged layer mixes.
import math, sys

P0 = 0.20      # yen per px2 of Arroz Solto
HR = 0.08      # on-foot helper: fraction of A(min(tier,ESCAV)) each
PR = 0.25      # piloted legacy machine: fraction of that machine's own A
M = 9.43e6     # mountain px2
BAG = 11       # index of bagger
ESC = 8

# id, cost, A (px2/s at 100% hold), pow
T = [('pata', 0, 15, 1), ('hashi', 120, 25, 1), ('tigela', 600, 44, 1.3), ('pa', 2800, 72, 2),
     ('duaspas', 10000, 112, 2.5), ('carrinho', 32000, 172, 3), ('trator', 90000, 250, 4),
     ('empilhadeira', 270000, 360, 5.5), ('escav', 800000, 500, 8), ('pacabo', 2700000, 660, 9),
     ('caminhao', 6500000, 860, 11), ('bagger', 13000000, 1900, 16)]
# per tier: (volume factor from hardness, average val of what is being dug)
MIX = [(1, 1), (1, 1), (1, 1), (.9, 1.3), (1, 1.5), (1, 1.6), (.8, 2.2), (.85, 2.6), (1, 2.9), (1, 3.0), (1, 3.3), (.9, 3.6)]
MIX_TITAN = (1, 4.2)
MACH = {'trator': 6, 'empilhadeira': 7, 'escav': 8, 'pacabo': 9, 'caminhao': 10}
G12 = 14000000  # cost base for gate-12 nodes
ANG = {'colheita': -90, 'comercio': -18, 'equipe': 54, 'maquinas': 126, 'sorte': 198}

# id, name, branch, gate(tools owned), frac of next tool cost, depth, lane, req, fx, big(0 small,1 big,2 keystone), see
N = [
 # ---- COLHEITA (Kome's own dig) ----
 ('c1', 'Patinhas Fortes', 'colheita', 1, .33, 1, 0, [], dict(dig=1.3), 1, 'patas do Kome crescem 20% e ganham almofadinhas rosa; 5 grãos por batida em vez de 3'),
 ('c3', 'Patada Sísmica', 'colheita', 4, .30, 2, 0, ['c1'], dict(stomp=1, dig=1.15), 2, 'KEYSTONE: a cada 6 s cavando Kome pula e abre cratera de 3r, anel de poeira, shake 4 px'),
 ('c_spd', 'Patas Ligeiras', 'colheita', 4, .12, 2, -1, ['c1'], dict(spd=1.2), 0, 'Kome corre com rastro de 3 afterimages e poeirinha nos pés'),
 ('cA', 'Almofadinhas Calejadas', 'colheita', 5, .16, 3, 0, ['c3'], dict(dig=1.1), 0, 'animação de uso 10% mais rapida; +2 grãos por batida no jato'),
 ('c_reach', 'Braço Comprido', 'colheita', 6, .12, 3, -1, ['c_spd'], dict(reach=1.15), 0, 'cabo/braco/lança da ferramenta desenhado 15% mais longo'),
 ('c6', 'Kome Workaholic', 'colheita', 6, .22, 3, 1, ['c3'], dict(auto=.4), 1, 'solto o dedo, Kome continua cavando sozinho com olheiras e uma gota de suor'),
 ('cB', 'Diesel Premium', 'colheita', 7, .20, 4, 0, ['cA'], dict(dig=1.1), 0, 'fumaça do escape vira azul e mais densa; motor sobe meio tom'),
 ('combo1', 'Ritmo de Taiko', 'colheita', 7, .30, 4, 1, ['c6'], dict(comboCap=1.75), 1, 'barra de combo ganha 2º segmento; taiko entra na música acima de x1,5'),
 ('cC', 'Lâminas Afiadas', 'colheita', 8, .22, 5, 0, ['cB'], dict(dig=1.1), 0, 'brilho "ting" percorre a lâmina/garfo/dente a cada 4 s; corte solta faíscas brancas'),
 ('c7', 'Fúria do Kome', 'colheita', 9, .30, 5, 1, ['combo1'], dict(furia=1.33), 2, 'KEYSTONE: 10 s em combo max -> 5 s de iene x2: Kome uiva, aura vermelha, tela com speedlines'),
 ('cD', 'Turbo Intercooler', 'colheita', 9, .20, 6, 0, ['cC'], dict(dig=1.12), 0, 'turbina visível no capô girando; apito de turbo ao segurar'),
 ('c8', 'Combo Mestre', 'colheita', 10, .40, 6, 1, ['c7'], dict(comboCap=2), 1, 'barra de combo com 3º segmento arco-iris; números de iene pulsam no ritmo'),
 # ---- COMERCIO (sell price) ----
 ('m1', 'Barraquinha', 'comercio', 2, .42, 1, 0, [], dict(sell=1.5), 1, 'barraca com noren, obaa-san e fila de 3 clientes no pátio'),
 ('m_a', 'Balança Honesta', 'comercio', 3, .25, 2, 0, ['m1'], dict(sell=1.15), 0, 'balança de pratos na barraca, tilinta a cada venda'),
 ('m_b', 'Noren Novo', 'comercio', 5, .25, 3, 0, ['m_a'], dict(sell=1.15), 0, 'noren troca pra índigo com o rosto do Kome; fila cresce pra 5'),
 ('m_c', 'Feira de Niigata', 'comercio', 6, .22, 4, 0, ['m_b'], dict(sell=1.15), 0, 'bandeiras nobori ao longo do pátio balançando ao vento'),
 ('m5', 'Fábrica de Onigiri', 'comercio', 7, .50, 5, 0, ['m_c'], dict(sell=1.3), 1, 'fábrica no pátio; chaminé solta baforadas em forma de onigiri'),
 ('m_d', 'Embalagem Kawaii', 'comercio', 8, .34, 6, 0, ['m5'], dict(sell=1.15), 0, 'sacos e pops de iene passam a ter carinha sorrindo'),
 ('m7a', 'Selo Premium', 'comercio', 9, .26, 5, 1, ['m5'], dict(val=1.12), 0, 'camada prensada ganha brilho perolado; pops de prensado/mochi com selo vermelho'),
 ('m_e', 'Ekiben de Estação', 'comercio', 9, .36, 6, -1, ['m5'], dict(sell=1.15), 0, 'plataforma de estação com quiosque de ekiben ao lado do trilho'),
 ('m8', 'Trem de Arroz', 'comercio', 9, .60, 7, 0, ['m_d'], dict(sell=1.3), 2, 'KEYSTONE: trem (loco + 3 vagões) cruza o fundo a cada 20 s; tocar o apito na passagem = +3 s de renda'),
 ('m7b', 'Selo Ouro', 'comercio', 10, .26, 6, 1, ['m7a'], dict(val=1.12), 0, 'mochi ganha veios dourados; estilhacos de mochi brilham'),
 ('m_f', 'Exportação', 'comercio', 10, .36, 7, -1, ['m_e'], dict(sell=1.15), 0, 'contêineres coloridos empilhados no pátio, guindaste portuário pequeno'),
 ('m9', 'Destilaria de Sake', 'comercio', 10, .52, 8, 0, ['m8'], dict(sell=1.15), 0, 'destilaria com barris komodaru; tanuki bêbado dorme na porta'),
 ('m11', 'Porto de Niigata', 'comercio', 11, .50, 8, -1, ['m_f'], dict(sell=1.15), 0, 'navio cargueiro no horizonte recebe o trem; gaivotas'),
 ('m10', 'Marca "Kome no Japão"', 'comercio', 12, 3.0, 9, 0, ['m9', 'm11'], dict(sell=1.25), 1, 'outdoor gigante com o rosto do Kome; pops de iene viram dourados com logo'),
 # ---- EQUIPE (on-foot helpers + chores) ----
 ('a1', 'Shiba Ajudante', 'equipe', 4, .15, 1, 0, [], dict(help=1), 1, 'Goma chega cavando com tigela ao lado do Kome'),
 ('a2', 'Segundo Shiba', 'equipe', 5, .18, 2, 0, ['a1'], dict(help=1), 0, 'Kuro (preto e canela) entra na fila'),
 ('a3', 'Kakashi', 'equipe', 5, .26, 2, 1, ['a1'], dict(crows=0, hv=1.2), 0, 'espantalho com o chapéu do Kome; corvos fogem em revoada'),
 ('a4', 'Turma Shiba', 'equipe', 6, .18, 3, 0, ['a2'], dict(help=2), 0, 'Shiro + Mame: 4 shibas trabalhando'),
 ('e1', 'Marmita (bentô)', 'equipe', 6, .28, 3, -1, ['a2'], dict(hm=1.25), 0, 'shibas param 1 s pra comer onigiri e correm 25% mais rápido, com notinha músical'),
 ('a5', 'Kei-truck', 'equipe', 7, .28, 3, 1, ['a3'], dict(autosack=1, sack=1.33, hv=1.3), 2, 'KEYSTONE: kei-truck branco vai e volta recolhendo os sacos sozinho e bascula na barraca'),
 ('a11', 'Shiba Novato', 'equipe', 7, .14, 4, 0, ['a4'], dict(help=1), 0, 'Pochi, filhote de capacete grande demais'),
 ('a7', 'Silo', 'equipe', 7, .36, 4, 1, ['a5'], dict(silo=1), 1, 'silo com visor de nível no pátio; libera renda offline'),
 ('a6', 'Pás pros Shibas', 'equipe', 8, .30, 4, -1, ['e1'], dict(hm=1.25), 0, 'tigelas dos ajudantes viram pás; torrões maiores'),
 ('a8', 'Mais Shibas', 'equipe', 8, .40, 5, 0, ['a11'], dict(help=2), 0, '7 shibas; passam a cantar "wan-wan-ho!" em coro'),
 ('e3', 'Apito do Capataz', 'equipe', 8, .18, 5, 1, ['a7'], dict(hv=1.15), 0, 'um shiba de apito marca o ritmo; ajudantes cavam sincronizados'),
 ('a9', 'Esteira', 'equipe', 9, .44, 6, 1, ['e3'], dict(hv=1.3), 1, 'esteira do pé da montanha ao silo com grãos rolando'),
 ('e4', 'Capacetes', 'equipe', 10, .20, 5, -1, ['a6'], dict(hm=1.11), 0, 'todos os ajudantes de capacete amarelo e colete refletivo'),
 ('a10', 'Capatazes', 'equipe', 10, .46, 6, 0, ['a8'], dict(help=1), 0, 'capataz em mini-escavadeira amarela'),
 ('e5', 'Rádio da Obra', 'equipe', 11, .28, 7, 1, ['a9', 'a10'], dict(hv=1.15), 0, 'antena no pátio; balões "copiado!" e enka baixinho no rádio'),
 # ---- MAQUINAS / BAGGER (legacy pilots + megamachine) ----
 ('p1', 'Piloto pro Trator', 'maquinas', 8, .26, 1, 0, [], dict(pilot='trator'), 1, 'Goma sobe no trator estacionado e empurra ondas sozinha (placa PRECISA-SE some)'),
 ('p2', 'Piloto pra Empilhadeira', 'maquinas', 9, .22, 2, 0, ['p1'], dict(pilot='empilhadeira'), 1, 'Kuro pilota a empilhadeira e empilha paletes no pátio'),
 ('p3', 'Piloto pra Escavadeira', 'maquinas', 10, .30, 3, 0, ['p2'], dict(pilot='escav'), 1, 'Shiro opera a escavadeira num terraço próprio'),
 ('e2a', 'Oficina', 'maquinas', 10, .22, 3, 1, ['p2'], dict(pm=1.15), 0, 'galpao-oficina; máquinas pilotadas ganham pintura nova e brilho'),
 ('bg1', 'Projeto Bagger 1/3: Esteiras', 'maquinas', 11, .485, 4, -1, ['p3'], dict(part=1), 1, 'comboio traz as 3 esteiras; guindastes e soldadores no pátio'),
 ('p4', 'Frota da Pá de Cabo', 'maquinas', 11, .36, 4, 0, ['p3'], dict(pilot='pacabo'), 1, '2 caminhões amarelos de shibas entram no ciclo; a pá de cabo nunca para'),
 ('e2b', 'Turno da Noite', 'maquinas', 11, .32, 4, 1, ['e2a'], dict(pm=1.13), 0, 'torres de luz; faróis e giroflex nas máquinas pilotadas à noite'),
 ('bg2', 'Projeto Bagger 2/3: Torre e Contrapeso', 'maquinas', 11, .77, 5, -1, ['bg1'], dict(part=1), 1, 'torre e contrapeso sobem; silhueta já tapa o sol da tarde'),
 ('b0', 'Buzina', 'maquinas', 12, .0000293, 6, -1, ['bg2'], dict(horn=1), 0, 'botão BUZINA: onda de choque visível, corvos e shibas pulam'),
 ('p5', 'Piloto pro Caminhão', 'maquinas', 12, .80, 5, 0, ['p4'], dict(pilot='caminhao'), 1, 'o 797 do Kome entra na frota com Pochi no volante (só se vê o capacete)'),
 ('b1', 'Roda Turbo', 'maquinas', 12, .60, 7, -1, ['b0'], dict(dig=1.2), 0, 'roda gira 20% mais rápido; caçambas viram borrão, "tchac" mais agudo'),
 ('b2', 'Lança Longa', 'maquinas', 12, .75, 6, 0, ['b0'], dict(boom=1.3), 0, 'lança estica de 560 pra 730 px com treliça nova'),
 ('bK', 'Mordida Perfeita+', 'maquinas', 12, 1.0, 8, 0, ['b1', 'b2'], dict(mordida=1), 2, 'KEYSTONE: faixa perfeita 0,35-0,75 e x1,6; arco fica dourado e 3 perfeitas seguidas disparam "x3 NESTA MORDIDA"'),
 ('b3', 'Caçambas de Titânio', 'maquinas', 12, 1.3, 8, -1, ['b1'], dict(powMul=1.5, titan=1), 1, 'caçambas azul-titânio; o Núcleo Koshihikari solta lascas douradas a 100%'),
 ('b4', 'Esteira Tronco Dupla', 'maquinas', 12, 1.7, 7, 1, ['b2', 'a9'], dict(sell=1.15), 0, 'segunda esteira paralela até os silos; fluxo de grãos dobra de espessura'),
 # ---- SORTE & EVENTOS ----
 ('s1', 'Sacos Maiores', 'sorte', 3, .30, 1, 0, [], dict(sack=1.5), 1, 'sprite do saco 30% maior com laço vermelho'),
 ('s2', 'Grao Dourado', 'sorte', 3, .40, 2, 0, ['s1'], dict(crit=.04, critMult=5), 1, 'grãos dourados no jato; pop crítico amarelo com "kin!"'),
 ('s3', 'Onigiri da Sorte', 'sorte', 4, .20, 2, 1, ['s1'], dict(oni=.08), 1, 'onigiri voador com asinhas cruza a tela a cada 45-70 s'),
 ('s4', 'Faro de Shiba', 'sorte', 5, .30, 3, 0, ['s2'], dict(gold=10, glow=1), 2, 'KEYSTONE: bolsões brilham através da superfície; nariz do Kome fareja e aponta'),
 ('s5', 'Sacos de Seda', 'sorte', 6, .26, 3, -1, ['s2'], dict(sack=1.3), 0, 'sacos roxos de seda; estouram com confete'),
 ('s6', 'Mural Maior', 'sorte', 7, .18, 3, 1, ['s3'], dict(mis=.08), 0, 'mural de missões de madeira no pátio; baús de missão maiores'),
 ('s7', 'Peneira de Ouro', 'sorte', 8, .26, 4, 0, ['s4'], dict(crit=.05), 0, 'críticos soltam chuva de 6 moedas; ajudantes também'),
 ('s8', 'Sacos Dourados', 'sorte', 8, .36, 4, -1, ['s5'], dict(sack=1.3), 0, 'sacos dourados com brilho e raio de luz ao estourar'),
 ('s9', 'Onigiri Duplo', 'sorte', 9, .16, 4, 1, ['s3'], dict(oni=.12), 0, 'onigiris passam em dupla; o segundo é de ume com ponto vermelho'),
 ('s10', 'Veio de Ouro', 'sorte', 9, .30, 5, 0, ['s7'], dict(gold=12), 0, 'bolsões ligados por veios dourados visíveis no corte da montanha'),
 ('s11', 'Chá da Obaa-san', 'sorte', 9, .22, 5, 1, ['s9'], dict(vis=.05), 0, 'mesinha de chá no pátio; visitantes ficam +5 s e pagam mais'),
 ('s12', 'DESLIZAMENTO!', 'sorte', 10, .18, 5, -1, ['s8'], dict(slide=1), 1, 'avalanche >40.000 px² vira evento: banner, câmera treme, iene x1,5 por 3 s'),
]
SYN = [('e1', 'm5', dict(hm=1.08), 'Marmita + Fábrica: bentô de fábrica, ajudantes +8%; marmitas viram caixinhas com logo'),
       ('s2', 'combo1', dict(critCombo=3), 'Grao Dourado + Ritmo de Taiko: cada crítico da +3 de combo e uma batida de taiko'),
       ('a3', 's4', dict(crowPoint=1), 'Kakashi + Faro: corvos amansados circulam sobre o bolsão mais próximo')]
HOUSE = [('h1', 200000, 7, None, dict(help=1)), ('h2', 3000000, 9, 'h1', dict(sell=1.25)), ('h3', 12000000, 11, 'h2', {}),
         ('h4', 28000000, 12, 'h3', {}), ('h5', 48000000, 12, 'h4', dict(pocket2=1.3)), ('h6', 70000000, 12, 'h5', dict(end=1))]


def nice(x):
    if x < 1000: return int(round(x / 10) * 10)
    e = 10 ** (int(math.log10(x)) - 1)
    return int(round(x / e) * e)


def cost_of(n):
    base = T[n[3]][1] if n[3] <= 11 else G12
    return 293 if n[0] == 'b0' else (40 if n[0] == 'c1' else nice(n[4] * base))


def pos_of(n):
    a = math.radians(ANG[n[2]]); d = n[5] * 1.25; l = n[6] * 1.0
    return round(d * math.cos(a) - l * math.sin(a), 1), round(d * math.sin(a) + l * math.cos(a), 1)


def build():
    ups = [dict(id=n[0], cost=cost_of(n), gate=n[3], req=list(n[7]), fx=dict(n[8])) for n in N]
    for h in HOUSE: ups.append(dict(id=h[0], cost=h[1], gate=h[2], req=[h[3]] if h[3] else [], fx=dict(h[4])))
    return ups


def run(uptime=.85, active=True, verbose=True, label='active'):
    ups = build()
    t = 0; money = 0; tier = 0; own = set(); dug = 0; earned = 0; npurch = 0
    S = dict(hv=1, dig=1, crit=1, pocket=1.28, sell=1, sack=1, oni=0, help=0, hm=1, furia=1, combo=1.25, val=1, auto=0,
             titan=0, pocket2=1, autosack=0, pm=1, mis=.05, vis=.03, mordida=0)
    pilots = set(); syn_done = set()
    last = 0; maxgap = 0; log = []; baggerT = None; dugAtBagger = None; maxauto = 0

    def rates():
        A = T[tier][2]; vf, val = MIX[tier]
        if tier == BAG and S['titan']: vf, val = MIX_TITAN
        if 3 <= tier < BAG: val *= S['val']
        up = uptime if active else uptime + (1 - uptime) * S['auto']
        skill = 1
        if active and tier == 10: skill = 1.10                       # truck "carga coroada" average
        if active and tier == BAG: skill = 1.33 if S['mordida'] else 1.25   # Mordida average
        kpx = A * S['dig'] * vf * up * skill
        nach = min(30, 2 * (tier + 1) + (2 if tier == BAG else 0)) if active else tier + 1   # selos: +1% each
        price = val * P0 * S['sell'] * S['pocket'] * S['pocket2'] * (1 + .01 * nach)
        combo = S['combo'] if active else 1 + (S['combo'] - 1) * .3
        ky = kpx * price * combo * S['crit'] * S['furia']
        sackp = .093 * S['sack'] if (active or S['autosack']) else 0
        onip = S['oni'] if active else 0
        vis = S['vis'] if active and tier >= 4 else 0
        mis = S['mis'] if active else .02
        ky *= 1 + sackp + onip + vis + mis
        hpx = S['help'] * HR * T[min(tier, ESC)][2] * S['hm'] * vf
        mpx = sum(PR * T[MACH[m]][2] for m in pilots) * S['pm'] * vf
        hy = (hpx + mpx) * price * S['hv'] * S['crit']
        return kpx, ky, hpx + mpx, hy

    def apply(fx):
        for k, v in fx.items():
            if k in ('dig', 'sell', 'sack', 'hm', 'val', 'hv', 'pm'): S[k] *= v
            elif k == 'help': S['help'] += v
            elif k == 'pilot': pilots.add(v)
            elif k == 'crit': S['crit'] = 1 + v * 4
            elif k == 'gold': S['pocket'] = {10: 1.36, 12: 1.44}[v]
            elif k == 'comboCap': S['combo'] = 1 + (v - 1) / 2
            elif k in ('furia', 'auto', 'titan', 'oni', 'pocket2', 'autosack', 'mis', 'vis', 'mordida'): S[k] = v

    while t < 12 * 3600:
        kpx, ky, hpx, hy = rates()
        money += ky + hy; earned += ky + hy; dug += kpx + hpx; t += 1
        cands = []
        if tier < BAG:
            nt = T[tier + 1]
            if tier + 1 < BAG or ('bg1' in own and 'bg2' in own): cands.append(('T:' + nt[0], nt[1], None))
        for u in ups:
            if u['id'] in own or u['gate'] > tier + 1: continue
            if any(r not in own for r in u['req']): continue
            cands.append((u['id'], u['cost'], u))
        if not cands: break
        c = min(cands, key=lambda c: c[1])
        if money >= c[1]:
            money -= c[1]; gap = t - last; maxgap = max(maxgap, gap); last = t; npurch += 1
            if c[2] is None:
                tier += 1
                if tier == BAG: baggerT = t; dugAtBagger = dug
            else:
                own.add(c[0]); apply(c[2]['fx'])
                for a, b, fx, _ in SYN:
                    if a in own and b in own and (a, b) not in syn_done: syn_done.add((a, b)); apply(fx)
            kpx, ky, hpx, hy = rates()
            au = hy / (ky + hy) if ky + hy else 0
            maxauto = max(maxauto, au)
            log.append((t, c[0], c[1], ky + hy, au, gap, dug / M))
            if c[2] and c[2]['fx'].get('end'): break
    if verbose:
        for l in log:
            print('%3d:%02d %-14s %12s  inc/s %9.0f  auto %3.0f%%  gap %4ds  dug %5.1f%%' % (
                l[0] // 60, l[0] % 60, l[1], f'{l[2]:,}', l[3], l[4] * 100, l[5], l[6] * 100))
        print('\nTIER SUMMARY')
        idx = [i for i, l in enumerate(log) if l[1].startswith('T:')]
        print('| Time | Tool | Y/s at buy -> end of window | Bought in window (wait s) | Next tool wait | Auto % (max) | Dug % |')
        print('|---|---|---|---|---|---|---|')
        segs = [(-1, None)] + [(i, log[i]) for i in idx]
        for n, (i, r) in enumerate(segs):
            j = segs[n + 1][0] if n + 1 < len(segs) else len(log)
            win = log[i + 1:j]
            inc0 = r[3] if r else P0 * 15 * .85 * 1.25 * 1.07
            inc1 = win[-1][3] if win else inc0
            au = max([w[4] for w in win] + [r[4] if r else 0])
            nxt = ('%d s' % log[j][5]) if j < len(log) else 'END %d:%02d' % (log[-1][0] // 60, log[-1][0] % 60)
            print('| %d:%02d | %s | %s -> %s | %s | %s | %.0f | %.1f |' % (
                (r[0] if r else 0) // 60, (r[0] if r else 0) % 60, r[1][2:] if r else 'pata', f'{inc0:,.0f}', f'{inc1:,.0f}',
                ', '.join('%s %d' % (w[1], w[5]) for w in win), nxt, au * 100, (r[6] if r else 0) * 100))
    bp = (t - (baggerT or t)) / 60
    print('END[%s] t=%.1f min  purchases=%d (1 per %.0f s)  maxgap=%ds  dug=%.2fM (%.0f%%)  earned=%.1fM  bagger at %.1f min (dug %.0f%%)  bagger phase %.1f min  max auto %.0f%%' % (
        label, t / 60, npurch, t / npurch, maxgap, dug / 1e6, dug / M * 100, earned / 1e6, (baggerT or 0) / 60,
        (dugAtBagger or 0) / M * 100, bp, maxauto * 100))
    return dict(t=t, maxgap=maxgap, dug=dug / M, bag=(dugAtBagger or 0) / M, bp=bp, maxauto=maxauto, n=npurch)


def js():
    print('\nconst TREE=[')
    for n in N:
        x, y = pos_of(n)
        fx = '{' + ','.join('%s:%s' % (k, ("'%s'" % v) if isinstance(v, str) else v) for k, v in n[8].items()) + '}'
        print(" {id:'%s',n:'%s',c:%d,branch:'%s',pos:{x:%s,y:%s},req:[%s],tier:%d,size:%d,fx:%s,\n   see:'%s'}," % (
            n[0], n[1], cost_of(n), n[2], x, y, ','.join("'%s'" % r for r in n[7]), n[3], n[9], fx, n[10]))
    print('];')
    ps = [pos_of(n) for n in N]
    md = min(math.dist(a, b) for i, a in enumerate(ps) for b in ps[i + 1:])
    print('// nodes', len(N), 'min node distance (grid units)', round(md, 2))
    for b in ANG: print('//', b, sum(1 for n in N if n[2] == b))


if __name__ == '__main__':
    r = run()
    run(uptime=.6, verbose=False, label='casual 60% hold')
    run(uptime=.3, active=False, verbose=False, label='lazy 30% hold')
    print('total cost', f"{sum(u['cost'] for u in build()) + sum(x[1] for x in T):,}")
    ok = [('60<=t<=90 min', 60 <= r['t'] / 60 <= 90), ('maxgap<=180 s', r['maxgap'] <= 180), ('bagger phase>=9 min', r['bp'] >= 9),
          ('dug at bagger<=50%', r['bag'] <= .50), ('85%<=dug at end<=95%', .85 <= r['dug'] <= .95),
          ('auto share<=45%', r['maxauto'] <= .45), ('45<=s per purchase<=60', 45 <= r['t'] / r['n'] <= 60)]
    for n, v in ok: print('ASSERT %-24s %s' % (n, 'OK' if v else 'FAIL'))
    if '--js' in sys.argv: js()
    sys.exit(0 if all(v for _, v in ok) else 1)
