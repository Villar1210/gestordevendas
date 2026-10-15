// Limites de tamanho/valor da ficha tecnica (L5) - usada tambem pelo
// confirmar do book (ConfirmarBookDto.ficha).
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfirmarFichaTecnicaDto } from './confirmar-ficha-tecnica.dto';
import { ConfirmarBookDto } from './book-empreendimento.dto';

const base = { itensLazer: ['Piscina'], tipologias: [{ nome: '2 dorms', areaPrivativa: 45.5, dormitorios: 2 }] };

async function erros(dados: Record<string, unknown>): Promise<string[]> {
  const resultado = await validate(plainToInstance(ConfirmarFichaTecnicaDto, { ...base, ...dados }));
  const props: string[] = [];
  const percorrer = (lista: typeof resultado, prefixo = '') =>
    lista.forEach((e) => {
      props.push(prefixo + e.property);
      if (e.children?.length) percorrer(e.children, `${prefixo}${e.property}.`);
    });
  percorrer(resultado);
  return props;
}

describe('ConfirmarFichaTecnicaDto - limites', () => {
  it('ficha normal passa', async () => {
    expect(await erros({ descricao: 'Texto', areaTerreno: 5000, totalUnidades: 320, vagas: 0 })).toEqual([]);
  });

  it('recusa textos grandes demais', async () => {
    expect(await erros({ descricao: 'x'.repeat(5001) })).toContain('descricao');
    expect(await erros({ itensLazer: ['x'.repeat(121)] })).toContain('itensLazer');
    expect(await erros({ itensLazer: Array.from({ length: 101 }, () => 'Piscina') })).toContain('itensLazer');
    expect(await erros({ tipologias: [{ nome: 'x'.repeat(151) }] })).toContain('tipologias.0.nome');
  });

  it('recusa numeros negativos ou acima do limite', async () => {
    expect(await erros({ totalUnidades: -1 })).toContain('totalUnidades');
    expect(await erros({ vagas: 2147483648 })).toContain('vagas');
    expect(await erros({ gabarito: 2147483647 })).toEqual([]);
    expect(await erros({ areaTerreno: -10 })).toContain('areaTerreno');
    expect(await erros({ areaTerreno: 1e12 })).toContain('areaTerreno');
    expect(await erros({ tipologias: [{ nome: 'A', dormitorios: -2 }] })).toContain('tipologias.0.dormitorios');
  });

  it('vale tambem dentro do confirmar do book', async () => {
    const dto = plainToInstance(ConfirmarBookDto, {
      bookId: '11111111-1111-4111-8111-111111111111',
      empreendimentoId: '22222222-2222-4222-8222-222222222222',
      ficha: { ...base, descricao: 'x'.repeat(5001) },
      paginas: [],
    });
    const r = await validate(dto);
    expect(r.map((e) => e.property)).toContain('ficha');
  });
});
