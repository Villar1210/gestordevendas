import { FilaTaxa } from './fila-taxa';

describe('FilaTaxa (1 req/s do Nominatim)', () => {
  it('espera o intervalo entre chamadas, em ordem FIFO', async () => {
    const fila = new FilaTaxa(60);
    const inicios: number[] = [];
    const ordem: number[] = [];
    const t0 = Date.now();
    await Promise.all(
      [1, 2, 3].map((n) =>
        fila.agendar(async () => {
          inicios.push(Date.now() - t0);
          ordem.push(n);
        }),
      ),
    );
    expect(ordem).toEqual([1, 2, 3]);
    expect(inicios[1] - inicios[0]).toBeGreaterThanOrEqual(55);
    expect(inicios[2] - inicios[1]).toBeGreaterThanOrEqual(55);
  });

  it('erro de uma tarefa nao trava a fila', async () => {
    const fila = new FilaTaxa(0);
    await expect(fila.agendar(async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    await expect(fila.agendar(async () => 7)).resolves.toBe(7);
  });

  it('cancelamento (signal) durante a espera rejeita sem executar', async () => {
    const fila = new FilaTaxa(10_000);
    await fila.agendar(async () => 1);
    const controle = new AbortController();
    const tarefa = jest.fn(async () => 2);
    const p = fila.agendar(tarefa, controle.signal);
    controle.abort(new Error('desligamento'));
    await expect(p).rejects.toThrow('desligamento');
    expect(tarefa).not.toHaveBeenCalled();
  });
});
