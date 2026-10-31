import Link from 'next/link'
import Image from 'next/image'
import { supabaseAdmin } from '@/lib/supabase'
import NavBar from '@/components/NavBar'

async function getConfig() {
  const { data } = await supabaseAdmin
    .from('config_site')
    .select('preco, preco_semestral, preco_anual, produto_nome, imagem_url')
    .eq('id', 1)
    .single()
  return {
    preco: data?.preco ?? 31.99,
    precoSemestral: data?.preco_semestral ?? 134.90,
    precoAnual: data?.preco_anual ?? 289.90,
    nome: data?.produto_nome ?? 'SumblerControl',
    imagem: data?.imagem_url || '/assets/SumblerControl.png',
  }
}

export default async function Home() {
  const cfg = await getConfig()
  const precoStr = cfg.preco.toFixed(2).replace('.', ',')
  const precoSemStr = cfg.precoSemestral.toFixed(2).replace('.', ',')
  const precoAnualStr = cfg.precoAnual.toFixed(2).replace('.', ',')

  return (
    <div style={{ background: '#090F1A', color: '#F1F5FA', fontFamily: 'Inter, sans-serif' }}>

      {/* NAV */}
      <NavBar />

      {/* HERO */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '120px 24px 80px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-100px', left: '-100px', width: '600px', height: '600px', background: '#3B82F6', borderRadius: '50%', filter: 'blur(120px)', opacity: 0.08, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, right: '-50px', width: '400px', height: '400px', background: '#818CF8', borderRadius: '50%', filter: 'blur(120px)', opacity: 0.08, pointerEvents: 'none' }} />
        <div style={{ maxWidth: '800px', textAlign: 'center', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '999px', fontSize: '13px', color: '#3B82F6', fontWeight: '500', marginBottom: '28px' }}>
            <span style={{ width: '7px', height: '7px', background: '#22C55E', borderRadius: '50%', boxShadow: '0 0 8px #22C55E' }} />
            Windows 10 &amp; 11 — Compatível com todas as versões
          </div>
          <h1 style={{ fontSize: 'clamp(2.6rem, 6vw, 4.2rem)', fontWeight: '900', lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: '24px' }}>
            Desempenho começa com<br />
            <span style={{ background: 'linear-gradient(135deg, #3B82F6, #818CF8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>as ferramentas certas.</span>
          </h1>
          <p style={{ fontSize: '18px', color: '#647489', lineHeight: 1.7, maxWidth: '620px', margin: '0 auto 36px' }}>
            SumblerControl analisa, otimiza e monitora seu PC em tempo real. Identifica o que está travando sua performance e entrega os FPS que seu hardware sempre teve capacidade de dar.
          </p>
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '56px' }}>
            <Link href="/checkout" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '14px 28px', background: '#3B82F6', color: '#fff', borderRadius: '10px', textDecoration: 'none', fontSize: '15px', fontWeight: '700' }}>
              ⚡ Assinar por R$ {precoStr}/mês
            </Link>
            <a href="#features" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '14px 28px', background: 'transparent', color: '#F1F5FA', borderRadius: '10px', textDecoration: 'none', fontSize: '15px', fontWeight: '600', border: '1px solid #243044' }}>
              Ver recursos →
            </a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '32px', flexWrap: 'wrap' }}>
            {[['13', 'Abas de otimização'], ['22+', 'Tweaks de sistema'], ['65+', 'Serviços gerenciados'], ['0.5ms', 'Timer Resolution']].map(([v, l]) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: '900', color: '#3B82F6', lineHeight: 1 }}>{v}</div>
                <div style={{ fontSize: '13px', color: '#647489', marginTop: '4px' }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ width: '100%', maxWidth: '900px', marginTop: '72px', position: 'relative', zIndex: 2 }}>
          <div style={{ position: 'absolute', inset: '-20px', background: 'radial-gradient(ellipse at 50% 80%, rgba(59,130,246,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <Image src="/assets/SumblerControl.png" alt="SumblerControl painel" width={1200} height={675} style={{ width: '100%', height: 'auto', borderRadius: '18px', border: '1px solid #243044', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }} priority />
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: '96px 24px', background: '#090F1A' }} id="features">
        <div style={{ maxWidth: '1160px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <div style={{ display: 'inline-block', padding: '4px 12px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '999px', color: '#3B82F6', fontSize: '12px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px' }}>Recursos</div>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: '800', letterSpacing: '-0.02em', marginBottom: '16px' }}>Tecnologia real. Resultado visível.</h2>
            <p style={{ fontSize: '17px', color: '#647489', maxWidth: '560px', margin: '0 auto' }}>Cada funcionalidade resolve um problema real de performance — não são tweaks genéricos.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {[
              { icon: '⚡', title: 'Análise de Gargalo em Tempo Real', desc: 'Monitora CPU, GPU, RAM e VRAM simultaneamente e identifica qual componente está limitando seus FPS — com gráfico ao vivo.' },
              { icon: '🎯', title: 'Redução de Input Lag', desc: 'Timer Resolution de 0.5ms, USB suspend desativado e aceleração do mouse removida. Resposta medida em microssegundos.' },
              { icon: '📊', title: 'Overlay de FPS', desc: 'Overlay sempre visível com FPS, frametime e histórico — filtrável por processo. Leve, sem impacto no jogo.' },
              { icon: '🔧', title: '22+ Otimizações de Gaming', desc: 'GameMode, GPU Priority, HAGS, MSI Interrupts, IRQ Affinity, Power Plan Gamer e muito mais — cada toggle explicado.' },
              { icon: '💻', title: 'Benchmark Completo', desc: 'CPU com raytracer multi-thread, RAM com latência e largura de banda, e Disco com 512MB sem cache — com histórico.' },
              { icon: '🛡️', title: 'Gerenciador de Serviços', desc: '65+ serviços Windows por risco — verde (seguro), amarelo (cuidado), vermelho (não mexa). Libera RAM com segurança.' },
              { icon: '📈', title: 'Monitor de Frametime', desc: 'Gráfico de frametime em tempo real. Identifica stutters e spikes que o contador de FPS simples não mostra.' },
              { icon: '🌐', title: 'Diagnóstico de Rede', desc: 'Ping, jitter e packet loss medidos com precisão. Identifica instabilidades de conexão com recomendações de correção.' },
              { icon: '💾', title: 'Saúde do Disco', desc: 'Temperatura, horas de uso e indicadores S.M.A.R.T. para HDDs e SSDs NVMe e SATA. Previne perda de dados.' },
            ].map(f => (
              <div key={f.title} style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '12px', padding: '24px' }}>
                <div style={{ fontSize: '28px', marginBottom: '12px' }}>{f.icon}</div>
                <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '8px' }}>{f.title}</h3>
                <p style={{ fontSize: '14px', color: '#647489', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SCREENSHOTS */}
      <section style={{ padding: '96px 24px', background: '#0D1420' }} id="screenshots">
        <div style={{ maxWidth: '1160px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ display: 'inline-block', padding: '4px 12px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '999px', color: '#3B82F6', fontSize: '12px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px' }}>Screenshots</div>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: '800', letterSpacing: '-0.02em' }}>Interface profissional. Zero complicação.</h2>
          </div>
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <Image src="/assets/SumblerControl.png" alt="SumblerControl painel completo" width={1200} height={675} style={{ width: '100%', height: 'auto', borderRadius: '16px', border: '1px solid #243044', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }} />
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <h4 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '8px' }}>Painel Completo de Otimização</h4>
              <p style={{ fontSize: '14px', color: '#647489' }}>13 abas — Sistema, Monitor, Otimizações, Benchmark, Gargalo, Overlay FPS, Frametime, Rede, Disco, Serviços e mais.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PREÇO */}
      <section style={{ padding: '96px 24px', background: '#090F1A' }} id="preco">
        <div style={{ maxWidth: '1160px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ display: 'inline-block', padding: '4px 12px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '999px', color: '#3B82F6', fontSize: '12px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px' }}>Planos</div>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: '800', letterSpacing: '-0.02em', marginBottom: '12px' }}>Conheça os planos SumblerControl.</h2>
            <p style={{ fontSize: '17px', color: '#647489', maxWidth: '600px', margin: '0 auto' }}>Escolha entre diferentes opções de acesso e aproveite os recursos disponíveis para cuidar do desempenho do seu computador.</p>
          </div>

          {/* 3 cards de planos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'start' }}>

            {/* Plano Mensal */}
            <div style={{ background: '#111826', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '18px', padding: '32px 28px', position: 'relative' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Plano Mensal</h3>
              <p style={{ fontSize: '13px', color: '#647489', marginBottom: '16px' }}>
                De <span style={{ textDecoration: 'line-through', color: '#EF4444' }}>R$ 99,90</span> por apenas
              </p>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', marginBottom: '24px' }}>
                <span style={{ fontSize: '18px', fontWeight: '700', marginTop: '6px' }}>R$</span>
                <span style={{ fontSize: '60px', fontWeight: '900', lineHeight: 1, letterSpacing: '-0.04em' }}>{precoStr.split(',')[0]}</span>
                <div style={{ paddingBottom: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '18px', fontWeight: '700' }}>,{precoStr.split(',')[1]}</span>
                  <span style={{ fontSize: '13px', color: '#647489' }}>/mês</span>
                </div>
              </div>
              <ul style={{ listStyle: 'none', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['Análise de gargalo em tempo real', '22+ otimizações de gaming', 'Redução de input lag', 'Overlay de FPS e frametime', 'Benchmark completo', 'Gerenciador de serviços (65+)', 'Windows 10 e 11'].map(item => (
                  <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <span style={{ color: '#22C55E', fontWeight: '700', flexShrink: 0 }}>✓</span>{item}
                  </li>
                ))}
              </ul>
              <Link href="/checkout?plano=mensal" style={{ display: 'block', width: '100%', padding: '13px', background: '#3B82F6', color: '#fff', borderRadius: '10px', textDecoration: 'none', fontWeight: '700', fontSize: '14px', textAlign: 'center' }}>
                ⚡ Assinar Agora
              </Link>
              <p style={{ textAlign: 'center', fontSize: '12px', color: '#647489', marginTop: '10px' }}>Cancele a qualquer momento</p>
            </div>

            {/* Plano Semestral — Mais Popular */}
            <div style={{ background: '#111826', border: '2px solid #3B82F6', borderRadius: '18px', padding: '32px 28px', position: 'relative', boxShadow: '0 0 40px rgba(59,130,246,0.15)' }}>
              <div style={{ position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)', background: '#3B82F6', color: '#fff', fontSize: '11px', fontWeight: '700', padding: '4px 14px', borderRadius: '999px', whiteSpace: 'nowrap' }}>⭐ Mais Popular</div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Plano Semestral</h3>
              <p style={{ fontSize: '13px', color: '#647489', marginBottom: '16px' }}>
                De <span style={{ textDecoration: 'line-through', color: '#EF4444' }}>R$ 197,90</span> por apenas
              </p>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', marginBottom: '24px' }}>
                <span style={{ fontSize: '18px', fontWeight: '700', marginTop: '6px' }}>R$</span>
                <span style={{ fontSize: '60px', fontWeight: '900', lineHeight: 1, letterSpacing: '-0.04em' }}>{precoSemStr.split(',')[0]}</span>
                <div style={{ paddingBottom: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '18px', fontWeight: '700' }}>,{precoSemStr.split(',')[1]}</span>
                  <span style={{ fontSize: '13px', color: '#647489' }}>/semestre</span>
                </div>
              </div>
              <ul style={{ listStyle: 'none', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['Análise de gargalo em tempo real', '22+ otimizações de gaming', 'Redução de input lag', 'Overlay de FPS e frametime', 'Benchmark completo', 'Gerenciador de serviços (65+)', 'Windows 10 e 11', '6 meses de acesso'].map(item => (
                  <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <span style={{ color: '#22C55E', fontWeight: '700', flexShrink: 0 }}>✓</span>{item}
                  </li>
                ))}
              </ul>
              <Link href="/checkout?plano=semestral" style={{ display: 'block', width: '100%', padding: '13px', background: '#3B82F6', color: '#fff', borderRadius: '10px', textDecoration: 'none', fontWeight: '700', fontSize: '14px', textAlign: 'center' }}>
                ⚡ Assinar Agora
              </Link>
              <p style={{ textAlign: 'center', fontSize: '12px', color: '#647489', marginTop: '10px' }}>Cancele a qualquer momento</p>
            </div>

            {/* Plano Anual — Melhor Valor */}
            <div style={{ background: '#111826', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '18px', padding: '32px 28px', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)', background: '#22C55E', color: '#000', fontSize: '11px', fontWeight: '700', padding: '4px 14px', borderRadius: '999px', whiteSpace: 'nowrap' }}>💰 Melhor Valor</div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Plano Anual</h3>
              <p style={{ fontSize: '13px', color: '#647489', marginBottom: '16px' }}>
                De <span style={{ textDecoration: 'line-through', color: '#EF4444' }}>R$ 349,90</span> por apenas
              </p>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px', marginBottom: '24px' }}>
                <span style={{ fontSize: '18px', fontWeight: '700', marginTop: '6px' }}>R$</span>
                <span style={{ fontSize: '60px', fontWeight: '900', lineHeight: 1, letterSpacing: '-0.04em' }}>{precoAnualStr.split(',')[0]}</span>
                <div style={{ paddingBottom: '6px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '18px', fontWeight: '700' }}>,{precoAnualStr.split(',')[1]}</span>
                  <span style={{ fontSize: '13px', color: '#647489' }}>/ano</span>
                </div>
              </div>
              <ul style={{ listStyle: 'none', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['Análise de gargalo em tempo real', '22+ otimizações de gaming', 'Redução de input lag', 'Overlay de FPS e frametime', 'Benchmark completo', 'Gerenciador de serviços (65+)', 'Windows 10 e 11', '12 meses de acesso'].map(item => (
                  <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <span style={{ color: '#22C55E', fontWeight: '700', flexShrink: 0 }}>✓</span>{item}
                  </li>
                ))}
              </ul>
              <Link href="/checkout?plano=anual" style={{ display: 'block', width: '100%', padding: '13px', background: '#22C55E', color: '#000', borderRadius: '10px', textDecoration: 'none', fontWeight: '700', fontSize: '14px', textAlign: 'center' }}>
                ⚡ Assinar Agora
              </Link>
              <p style={{ textAlign: 'center', fontSize: '12px', color: '#647489', marginTop: '10px' }}>Cancele a qualquer momento</p>
            </div>

          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '96px 24px', background: '#0D1420' }} id="faq">
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ display: 'inline-block', padding: '4px 12px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '999px', color: '#3B82F6', fontSize: '12px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px' }}>FAQ</div>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: '800', letterSpacing: '-0.02em' }}>Perguntas frequentes</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              ['Vou realmente sentir diferença de FPS?', 'Em PCs com configurações padrão do Windows, timer em 15ms e serviços desnecessários, o ganho é visível — mais FPS, frametime estável e input lag reduzido.'],
              ['Funciona no Windows 10 e 11?', 'Sim. Compatível com Windows 10 (1903+) e Windows 11 em todas as versões, incluindo 22H2, 23H2 e 24H2.'],
              ['Como recebo o download após assinar?', 'Após a confirmação do PIX você recebe o link de download automaticamente por e-mail e na sua área de conta.'],
              ['As otimizações são reversíveis?', 'Sim. Cada toggle pode ser desativado individualmente. O app também cria um ponto de restauração antes de mudanças críticas.'],
              ['Posso cancelar a qualquer momento?', 'Sim. Sem fidelidade, sem multa. Cancele quando quiser.'],
            ].map(([q, a]) => (
              <details key={q as string} style={{ background: '#111826', border: '1px solid #1E2939', borderRadius: '10px', padding: '18px 20px' }}>
                <summary style={{ fontWeight: '600', fontSize: '15px', cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {q} <span style={{ color: '#647489', fontSize: '18px' }}>+</span>
                </summary>
                <p style={{ marginTop: '12px', fontSize: '14px', color: '#647489', lineHeight: 1.7 }}>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ padding: '96px 24px', background: '#090F1A', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: '800', letterSpacing: '-0.02em', marginBottom: '14px' }}>
            Seu hardware merece mais do que o Windows oferece por padrão.
          </h2>
          <p style={{ fontSize: '17px', color: '#647489', marginBottom: '32px' }}>Junte-se aos gamers que já desbloquearam a performance real do seu PC.</p>
          <Link href="/checkout" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '16px 32px', background: '#3B82F6', color: '#fff', borderRadius: '10px', textDecoration: 'none', fontSize: '16px', fontWeight: '700' }}>
            ⚡ Assinar por R$ {precoStr}/mês
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#090F1A', borderTop: '1px solid #1E2939', padding: '40px 24px' }}>
        <div style={{ maxWidth: '1160px', margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' }}>
            <div style={{ width: '28px', height: '28px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#3B82F6" strokeWidth="2"/><circle cx="12" cy="12" r="4" stroke="#3B82F6" strokeWidth="2"/></svg>
            </div>
            SumblerControl
          </div>
          <div style={{ display: 'flex', gap: '24px' }}>
            {['Termos de Uso', 'Política de Privacidade', 'FAQ'].map(l => (
              <a key={l} href="#" style={{ fontSize: '13px', color: '#647489', textDecoration: 'none' }}>{l}</a>
            ))}
          </div>
          <p style={{ fontSize: '12px', color: '#243044' }}>© 2026 SumblerControl. Todos os direitos reservados.</p>
        </div>
      </footer>

    </div>
  )
}
