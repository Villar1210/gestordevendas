import { comTravaPorTenant } from './trava-por-tenant';

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('comTravaPorTenant', () => {
  it('executa em sequencia as chamadas do MESMO tenant (sem sobreposicao)', async () => {
    const ordem: string[] = [];
    let ativos = 0;
    let maxAtivos = 0;
    const tarefa = (nome: string, ms: number) =>
      comTravaPorTenant('t1', async () => {
        ativos++;
        maxAtivos = Math.max(maxAtivos, ativos);
        ordem.push(`inicio-${nome}`);
        await esperar(ms);
        ordem.push(`fim-${nome}`);
        ativos--;
        return nome;
      });

    const resultados = await Promise.all([tarefa('a', 30), tarefa('b', 5), tarefa('c', 1)]);
    expect(resultados).toEqual(['a', 'b', 'c']);
    expect(maxAtivos).toBe(1);
    expect(ordem).toEqual(['inicio-a', 'fim-a', 'inicio-b', 'fim-b', 'inicio-c', 'fim-c']);
  });

  it('nao trava tenants diferentes entre si', async () => {
    let ativos = 0;
    let maxAtivos = 0;
    const tarefa = (tenant: string) =>
      comTravaPorTenant(tenant, async () => {
        ativos++;
        maxAtivos = Math.max(maxAtivos, ativos);
        await esperar(20);
        ativos--;
      });
    await Promise.all([tarefa('t1'), tarefa('t2')]);
    expect(maxAtivos).toBe(2);
  });

  it('libera a trava mesmo quando a funcao lanca erro', async () => {
    await expect(comTravaPorTenant('t3', async () => { throw new Error('falhou'); })).rejects.toThrow('falhou');
    await expect(comTravaPorTenant('t3', async () => 'ok')).resolves.toBe('ok');
  });

  it('simula o rodizio: chamadas simultaneas nao repetem o corretor', async () => {
    const corretores = ['c1', 'c2', 'c3'];
    let ultimo: string | null = null;
    const distribuir = () =>
      comTravaPorTenant('t4', async () => {
        const lido = ultimo; // leitura do "banco"
        await esperar(5); // latencia entre ler e gravar
        const idx = lido ? (corretores.indexOf(lido) + 1) % corretores.length : 0;
        ultimo = corretores[idx]; // gravacao
        return corretores[idx];
      });
    const escolhidos = await Promise.all([distribuir(), distribuir(), distribuir()]);
    expect(escolhidos).toEqual(['c1', 'c2', 'c3']);
  });
});
