// src/features/imoveis/components/book/arquivosBook.ts
// Regras de selecao do book (1 PDF OU 1 a 80 imagens JPG/JPEG), espelhando os
// limites do backend (domain/services/book-empreendimento.ts). O backend
// valida de novo e e a fonte da verdade - aqui e so para avisar antes de
// enviar 80 MB a toa.

export const BOOK_MAX_MB = 80; // BOOK_MAX_BYTES
export const BOOK_MAX_BYTES = BOOK_MAX_MB * 1024 * 1024;
export const BOOK_MAX_IMAGENS = 80; // BOOK_MAX_IMAGENS = BOOK_MAX_PAGINAS
export const BOOK_MAX_MB_POR_IMAGEM = 20; // BOOK_MAX_BYTES_POR_IMAGEM
export const BOOK_MAX_BYTES_POR_IMAGEM = BOOK_MAX_MB_POR_IMAGEM * 1024 * 1024;
export const BOOK_MAX_PIXELS_IMAGEM = 50_000_000; // BOOK_MAX_PIXELS_IMAGEM
export const BOOK_PROPORCAO_EXTREMA_IMAGEM = 8; // entre 1:8 e 8:1

export const BOOK_ACCEPT = "application/pdf,.pdf,image/jpeg,.jpg,.jpeg";
export const MSG_TIPO_INVALIDO = "Envie um PDF ou imagens JPG/JPEG.";

export type TipoArquivoBook = "pdf" | "jpeg" | "outro";

export interface ImagemBook {
  id: string;
  arquivo: File;
  url: string; // object URL (revogada ao remover/desmontar)
  largura?: number;
  altura?: number;
  problema?: string; // preenchido quando as dimensoes passam do limite
}

export type SelecaoBook =
  | { tipo: "vazio" }
  | { tipo: "pdf"; arquivo: File }
  | { tipo: "imagens"; imagens: ImagemBook[] };

export function formatarMb(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} MB`;
}

// Tipo pelo CONTEUDO (mesma regra do backend: "%PDF-" / FF D8 FF), com a
// extensao so como desempate quando o navegador nao deixa ler o arquivo.
export async function detectarTipo(f: File): Promise<TipoArquivoBook> {
  try {
    const b = new Uint8Array(await f.slice(0, 5).arrayBuffer());
    if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return "pdf";
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
    return "outro";
  } catch {
    const nome = f.name.toLowerCase();
    if (f.type === "application/pdf" || nome.endsWith(".pdf")) return "pdf";
    if (f.type === "image/jpeg" || /\.jpe?g$/.test(nome)) return "jpeg";
    return "outro";
  }
}

// Mesma imagem escolhida duas vezes (nome + tamanho + data).
export const chaveArquivo = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

export function problemaDimensoes(largura: number, altura: number): string | undefined {
  if (!largura || !altura) return undefined;
  if (largura * altura > BOOK_MAX_PIXELS_IMAGEM) {
    return `Resolução alta demais (${Math.round((largura * altura) / 1_000_000)} megapixels; máximo 50).`;
  }
  const p = largura / altura;
  if (p > BOOK_PROPORCAO_EXTREMA_IMAGEM || p < 1 / BOOK_PROPORCAO_EXTREMA_IMAGEM) {
    return "Proporção extrema (muito comprida ou muito estreita).";
  }
  return undefined;
}

export type ResultadoSelecao = { ok: true; selecao: SelecaoBook; aviso?: string } | { ok: false; erro: string };

// Id local de cada imagem (chave do React; crypto.randomUUID exige https).
let contadorId = 0;

const nomeCurto =(n: string) => (n.length > 40 ? `${n.slice(0, 37)}...` : n);

// Junta os arquivos escolhidos agora com a selecao atual. Nao cria object
// URLs: devolve as novas imagens com url "" e quem chama cria (e revoga).
export async function combinarSelecao(atual: SelecaoBook, novos: File[]): Promise<ResultadoSelecao> {
  if (novos.length === 0) return { ok: true, selecao: atual };
  const tipos = await Promise.all(novos.map(detectarTipo));

  const invalido = novos.findIndex((_, i) => tipos[i] === "outro");
  if (invalido >= 0) {
    const extra = novos.length > 1 ? " Nenhum arquivo foi adicionado." : "";
    return { ok: false, erro: `"${nomeCurto(novos[invalido].name)}" não é aceito. ${MSG_TIPO_INVALIDO}${extra}` };
  }

  const pdfs = novos.filter((_, i) => tipos[i] === "pdf");
  const jpegs = novos.filter((_, i) => tipos[i] === "jpeg");

  if (pdfs.length && jpegs.length) {
    return { ok: false, erro: "Não misture PDF e imagens. Envie 1 PDF OU as imagens JPG das páginas." };
  }

  if (pdfs.length) {
    if (pdfs.length > 1) return { ok: false, erro: "Envie só 1 PDF por vez." };
    if (atual.tipo === "imagens") {
      return { ok: false, erro: "Você já escolheu imagens. Para usar um PDF, clique em Remover todas e escolha o PDF." };
    }
    const pdf = pdfs[0];
    if (pdf.size > BOOK_MAX_BYTES) {
      return { ok: false, erro: `O PDF tem ${formatarMb(pdf.size)}; o máximo é ${BOOK_MAX_MB} MB.` };
    }
    // Outro PDF no lugar do atual: troca.
    return { ok: true, selecao: { tipo: "pdf", arquivo: pdf } };
  }

  // So imagens
  if (atual.tipo === "pdf") {
    return { ok: false, erro: "Você já escolheu um PDF. Para usar imagens, clique em Trocar arquivo e escolha as imagens." };
  }
  const existentes = atual.tipo === "imagens" ? atual.imagens : [];
  const chaves = new Set(existentes.map((i) => chaveArquivo(i.arquivo)));
  // O lote escolhido de uma vez entra ordenado pelo nome (ordem natural:
  // pagina_2 antes de pagina_10) - o seletor do Windows nem sempre devolve
  // na ordem. Vai para o fim da lista atual; as setas ajustam depois.
  const lote = [...jpegs].sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true, sensitivity: "base" }));
  const unicos: File[] = [];
  for (const f of lote) {
    const k = chaveArquivo(f);
    if (chaves.has(k)) continue;
    chaves.add(k);
    unicos.push(f);
  }
  const repetidas = jpegs.length - unicos.length;

  const grande = unicos.find((f) => f.size > BOOK_MAX_BYTES_POR_IMAGEM);
  if (grande) {
    return {
      ok: false,
      erro: `"${nomeCurto(grande.name)}" tem ${formatarMb(grande.size)}; cada imagem pode ter no máximo ${BOOK_MAX_MB_POR_IMAGEM} MB.`,
    };
  }
  const total = existentes.length + unicos.length;
  if (total > BOOK_MAX_IMAGENS) {
    return {
      ok: false,
      erro: `O book pode ter no máximo ${BOOK_MAX_IMAGENS} imagens (ficariam ${total}).`,
    };
  }
  const bytes = [...existentes.map((i) => i.arquivo), ...unicos].reduce((s, f) => s + f.size, 0);
  if (bytes > BOOK_MAX_BYTES) {
    return {
      ok: false,
      erro: `As imagens somariam ${formatarMb(bytes)}; o máximo é ${BOOK_MAX_MB} MB no total. Reduza ou remova algumas.`,
    };
  }

  const novas: ImagemBook[] = unicos.map((arquivo) => ({ id: `img-${++contadorId}`, arquivo, url: "" }));
  const aviso =
    repetidas > 0
      ? `${repetidas} ${repetidas === 1 ? "imagem já estava" : "imagens já estavam"} na lista e não ${repetidas === 1 ? "foi adicionada" : "foram adicionadas"} de novo.`
      : undefined;
  return { ok: true, selecao: { tipo: "imagens", imagens: [...existentes, ...novas] }, aviso };
}

export function totalBytes(s: SelecaoBook): number {
  if (s.tipo === "pdf") return s.arquivo.size;
  if (s.tipo === "imagens") return s.imagens.reduce((t, i) => t + i.arquivo.size, 0);
  return 0;
}
