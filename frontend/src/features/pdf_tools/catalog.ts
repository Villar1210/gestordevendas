// src/features/pdf_tools/catalog.ts
// Catalogo unico das Ferramentas PDF: dirige o hub (cards, busca, chips) e a
// area de trabalho generica ([ferramenta]/page.tsx). Para acrescentar uma
// ferramenta nova basta um item aqui + (se tiver opcoes) um painel em
// components/options/ registrado em ToolOptionsPanel.tsx.
import {
  BookOpen,
  Combine,
  FilePlus2,
  FileText,
  FileType,
  Hash,
  ImagePlus,
  Images,
  LayoutGrid,
  Lock,
  LockOpen,
  Minimize2,
  RotateCw,
  Scissors,
  Stamp,
  type LucideIcon,
} from "lucide-react";
import type { OptionValues } from "./types";

export type PdfToolCategoryId =
  | "organizar"
  | "otimizar"
  | "converter-para"
  | "converter-de"
  | "editar"
  | "seguranca"
  | "ler";

export type CapabilityKey = "office" | "compress" | "security" | "raster";

export interface PdfToolCategory {
  id: PdfToolCategoryId;
  label: string;
  // Classes completas (sem interpolacao) para o Tailwind detectar no build.
  tile: string; // fundo suave + cor do icone
  ring: string; // anel do card no hover/foco
  dot: string; // marcador da secao no hub
  accentText: string;
  accentBorder: string; // borda/destaque da dropzone ao arrastar
  accentSoft: string; // fundo suave da dropzone ao arrastar
}

export const PDF_TOOL_CATEGORIES: PdfToolCategory[] = [
  {
    id: "organizar",
    label: "Organizar",
    tile: "bg-violet-50 text-violet-600",
    ring: "hover:ring-violet-200 focus-visible:ring-violet-300",
    dot: "bg-violet-500",
    accentText: "text-violet-700",
    accentBorder: "border-violet-400",
    accentSoft: "bg-violet-50/60",
  },
  {
    id: "otimizar",
    label: "Otimizar",
    tile: "bg-emerald-50 text-emerald-600",
    ring: "hover:ring-emerald-200 focus-visible:ring-emerald-300",
    dot: "bg-emerald-500",
    accentText: "text-emerald-700",
    accentBorder: "border-emerald-400",
    accentSoft: "bg-emerald-50/60",
  },
  {
    id: "converter-para",
    label: "Converter para PDF",
    tile: "bg-amber-50 text-amber-600",
    ring: "hover:ring-amber-200 focus-visible:ring-amber-300",
    dot: "bg-amber-500",
    accentText: "text-amber-700",
    accentBorder: "border-amber-400",
    accentSoft: "bg-amber-50/60",
  },
  {
    id: "converter-de",
    label: "Converter de PDF",
    tile: "bg-sky-50 text-sky-600",
    ring: "hover:ring-sky-200 focus-visible:ring-sky-300",
    dot: "bg-sky-500",
    accentText: "text-sky-700",
    accentBorder: "border-sky-400",
    accentSoft: "bg-sky-50/60",
  },
  {
    id: "editar",
    label: "Editar",
    tile: "bg-indigo-50 text-indigo-600",
    ring: "hover:ring-indigo-200 focus-visible:ring-indigo-300",
    dot: "bg-indigo-500",
    accentText: "text-indigo-700",
    accentBorder: "border-indigo-400",
    accentSoft: "bg-indigo-50/60",
  },
  {
    id: "seguranca",
    label: "Segurança",
    tile: "bg-rose-50 text-rose-600",
    ring: "hover:ring-rose-200 focus-visible:ring-rose-300",
    dot: "bg-rose-500",
    accentText: "text-rose-700",
    accentBorder: "border-rose-400",
    accentSoft: "bg-rose-50/60",
  },
  {
    id: "ler",
    label: "Ler",
    tile: "bg-blue-50 text-blue-700",
    ring: "hover:ring-blue-200 focus-visible:ring-blue-300",
    dot: "bg-blue-600",
    accentText: "text-blue-700",
    accentBorder: "border-blue-400",
    accentSoft: "bg-blue-50/60",
  },
];

export function getCategory(id: PdfToolCategoryId): PdfToolCategory {
  return PDF_TOOL_CATEGORIES.find((c) => c.id === id) ?? PDF_TOOL_CATEGORIES[0];
}

// upload: envia arquivo(s) multipart. create: editor (JSON). reader: leitor local.
export type PdfToolKind = "upload" | "create" | "reader";

export interface PdfTool {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
  category: PdfToolCategoryId;
  kind: PdfToolKind;
  // Atributo accept do <input type=file> e extensoes validadas no cliente.
  accept: string;
  extensions: string[];
  acceptLabel: string;
  multiple: boolean;
  minFiles: number;
  maxFiles: number;
  // Arquivos podem ser reordenados (ordem final = ordem enviada).
  reorderable: boolean;
  endpoint: string;
  fileField: "files" | "file";
  capability?: CapabilityKey;
  actionLabel: string; // verbo do botao primario
  progressLabel: string;
  doneLabel: string;
  defaultOptions: OptionValues;
  keywords: string;
}

const PDF_ACCEPT = { accept: ".pdf,application/pdf", extensions: [".pdf"], acceptLabel: "PDF" };

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_TOTAL_SIZE_BYTES = 80 * 1024 * 1024;

export const PDF_TOOLS: PdfTool[] = [
  {
    slug: "juntar",
    title: "Juntar PDF",
    description: "Una vários PDFs em um único documento, na ordem que você escolher.",
    icon: Combine,
    category: "organizar",
    kind: "upload",
    ...PDF_ACCEPT,
    multiple: true,
    minFiles: 2,
    maxFiles: 20,
    reorderable: true,
    endpoint: "/pdf-tools/merge",
    fileField: "files",
    actionLabel: "Juntar PDF",
    progressLabel: "Juntando os arquivos…",
    doneLabel: "Seus PDFs foram unidos",
    defaultOptions: {},
    keywords: "unir mesclar combinar merge",
  },
  {
    slug: "dividir",
    title: "Dividir PDF",
    description: "Separe um PDF por intervalos, extraia páginas ou gere um arquivo por página.",
    icon: Scissors,
    category: "organizar",
    kind: "upload",
    ...PDF_ACCEPT,
    multiple: false,
    minFiles: 1,
    maxFiles: 1,
    reorderable: false,
    endpoint: "/pdf-tools/split",
    fileField: "file",
    actionLabel: "Dividir PDF",
    progressLabel: "Dividindo o PDF…",
    doneLabel: "Seu PDF foi dividido",
    defaultOptions: { mode: "ranges", ranges: "", pages: "" },
    keywords: "separar extrair paginas split",
  },
  {
    slug: "organizar",
    title: "Organizar páginas",
    description: "Reordene, gire ou exclua páginas arrastando as miniaturas.",
    icon: LayoutGrid,
    category: "organizar",
    kind: "upload",
    ...PDF_ACCEPT,
    multiple: false,
    minFiles: 1,
    maxFiles: 1,
    reorderable: false,
    endpoint: "/pdf-tools/organize",
    fileField: "file",
    actionLabel: "Salvar PDF organizado",
    progressLabel: "Montando o novo PDF…",
    doneLabel: "Seu PDF foi organizado",
    defaultOptions: {},
    keywords: "reordenar excluir remover ordenar paginas",
  },
  {
    slug: "girar",
    title: "Girar PDF",
    description: "Gire todas as páginas ou só as que você indicar.",
    icon: RotateCw,
    category: "organizar",
    kind: "upload",
    ...PDF_ACCEPT,
    multiple: false,
    minFiles: 1,
    maxFiles: 1,
    reorderable: false,
    endpoint: "/pdf-tools/rotate",
    fileField: "file",
    actionLabel: "Girar PDF",
    progressLabel: "Girando as páginas…",
    doneLabel: "Seu PDF foi girado",
    defaultOptions: { angle: 90, pages: "" },
    keywords: "rotacionar virar orientacao",
  },
  {
    slug: "comprimir",
    title: "Comprimir PDF",
    description: "Reduza o tamanho do arquivo para enviar por e-mail ou WhatsApp.",
    icon: Minimize2,
    category: "otimizar",
    kind: "upload",
    ...PDF_ACCEPT,
    multiple: false,
    minFiles: 1,
    maxFiles: 1,
    reorderable: false,
    endpoint: "/pdf-tools/compress",
    fileField: "file",
    capability: "compress",
    actionLabel: "Comprimir PDF",
    progressLabel: "Comprimindo o PDF…",
    doneLabel: "Seu PDF foi comprimido",
    defaultOptions: { level: "recomendada" },
    keywords: "reduzir diminuir tamanho otimizar compactar",
  },
  {
    slug: "office-para-pdf",
    title: "Word, Excel ou PowerPoint para PDF",
    description: "Converta documentos, planilhas e apresentações em PDF.",
    icon: FileType,
    category: "converter-para",
    kind: "upload",
    accept: ".doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp",
    extensions: [".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp"],
    acceptLabel: "Word, Excel, PowerPoint ou OpenDocument",
    multiple: false,
    minFiles: 1,
    maxFiles: 1,
    reorderable: false,
    endpoint: "/pdf-tools/office-to-pdf",
    fileField: "file",
    capability: "office",
    actionLabel: "Converter para PDF",
    progressLabel: "Convertendo o documento…",
    doneLabel: "Seu documento virou PDF",
    defaultOptions: {},
    keywords: "word excel powerpoint docx xlsx pptx converter",
  },
  {
    slug: "imagens-para-pdf",
    title: "Imagens para PDF",
    description: "Transforme fotos JPG ou PNG em um PDF, uma imagem por página.",
    icon: ImagePlus,
    category: "converter-para",
    kind: "upload",
    accept: ".jpg,.jpeg,.png,image/jpeg,image/png",
    extensions: [".jpg", ".jpeg", ".png"],
    acceptLabel: "JPG ou PNG",
    multiple: true,
    minFiles: 1,
    maxFiles: 50,
    reorderable: true,
    endpoint: "/pdf-tools/images-to-pdf",
    fileField: "files",
    actionLabel: "Converter para PDF",
    progressLabel: "Montando o PDF com as imagens…",
    doneLabel: "Suas imagens viraram PDF",
    defaultOptions: { pageSize: "A4", orientation: "auto", margin: "pequena" },
    keywords: "foto jpg png imagem converter",
  },
  {
    slug: "criar",
    title: "Criar PDF",
    description: "Escreva um texto com títulos e listas e gere um PDF formatado.",
    icon: FilePlus2,
    category: "converter-para",
    kind: "create",
    ...PDF_ACCEPT,
    multiple: false,
    minFiles: 0,
    maxFiles: 0,
    reorderable: false,
    endpoint: "/pdf-tools/create",
    fileField: "file",
    actionLabel: "Criar PDF",
    progressLabel: "Gerando o PDF…",
    doneLabel: "Seu PDF foi criado",
    defaultOptions: { title: "", content: "", pageSize: "A4", fontSize: 12 },
    keywords: "novo escrever texto documento editor",
  },
  {
    slug: "pdf-para-imagem",
    title: "PDF para JPG ou PNG",
    description: "Converta as páginas do PDF em imagens na resolução que precisar.",
    icon: Images,
    category: "converter-de",
    kind: "upload",
    ...PDF_ACCEPT,
    multiple: false,
    minFiles: 1,
    maxFiles: 1,
    reorderable: false,
    endpoint: "/pdf-tools/pdf-to-images",
    fileField: "file",
    capability: "raster",
    actionLabel: "Converter em imagens",
    progressLabel: "Gerando as imagens…",
    doneLabel: "Suas imagens estão prontas",
    defaultOptions: { format: "jpg", dpi: 150, pages: "" },
    keywords: "jpg png imagem foto exportar",
  },
  {
    slug: "extrair-texto",
    title: "Extrair texto",
    description: "Copie todo o texto de um PDF para colar onde quiser.",
    icon: FileText,
    category: "converter-de",
    kind: "upload",
    ...PDF_ACCEPT,
    multiple: false,
    minFiles: 1,
    maxFiles: 1,
    reorderable: false,
    endpoint: "/pdf-tools/extract-text",
    fileField: "file",
    actionLabel: "Extrair texto",
    progressLabel: "Lendo o texto do PDF…",
    doneLabel: "Texto extraído",
    defaultOptions: {},
    keywords: "txt copiar texto ler conteudo",
  },
  {
    slug: "numeros-de-pagina",
    title: "Números de página",
    description: "Numere as páginas com a posição e o formato que preferir.",
    icon: Hash,
    category: "editar",
    kind: "upload",
    ...PDF_ACCEPT,
    multiple: false,
    minFiles: 1,
    maxFiles: 1,
    reorderable: false,
    endpoint: "/pdf-tools/page-numbers",
    fileField: "file",
    actionLabel: "Numerar páginas",
    progressLabel: "Numerando as páginas…",
    doneLabel: "Suas páginas foram numeradas",
    defaultOptions: { position: "inferior-centro", format: "n", startAt: 1, skipFirst: false },
    keywords: "numerar paginacao rodape",
  },
  {
    slug: "marca-dagua",
    title: "Marca d'água",
    description: "Carimbe um texto como CONFIDENCIAL ou RASCUNHO em todas as páginas.",
    icon: Stamp,
    category: "editar",
    kind: "upload",
    ...PDF_ACCEPT,
    multiple: false,
    minFiles: 1,
    maxFiles: 1,
    reorderable: false,
    endpoint: "/pdf-tools/watermark",
    fileField: "file",
    actionLabel: "Aplicar marca d'água",
    progressLabel: "Aplicando a marca d'água…",
    doneLabel: "Marca d'água aplicada",
    defaultOptions: { text: "CONFIDENCIAL", opacity: 0.25, size: "medio", diagonal: true },
    keywords: "carimbo watermark confidencial rascunho",
  },
  {
    slug: "proteger",
    title: "Proteger PDF",
    description: "Coloque senha no PDF para que só quem tiver a senha consiga abrir.",
    icon: Lock,
    category: "seguranca",
    kind: "upload",
    ...PDF_ACCEPT,
    multiple: false,
    minFiles: 1,
    maxFiles: 1,
    reorderable: false,
    endpoint: "/pdf-tools/protect",
    fileField: "file",
    capability: "security",
    actionLabel: "Proteger PDF",
    progressLabel: "Protegendo o PDF…",
    doneLabel: "Seu PDF agora tem senha",
    defaultOptions: { password: "", confirm: "", allowPrint: true, allowCopy: false },
    keywords: "senha criptografar bloquear seguranca",
  },
  {
    slug: "desbloquear",
    title: "Desbloquear PDF",
    description: "Remova a senha de um PDF que você tem permissão para abrir.",
    icon: LockOpen,
    category: "seguranca",
    kind: "upload",
    ...PDF_ACCEPT,
    multiple: false,
    minFiles: 1,
    maxFiles: 1,
    reorderable: false,
    endpoint: "/pdf-tools/unlock",
    fileField: "file",
    capability: "security",
    actionLabel: "Desbloquear PDF",
    progressLabel: "Removendo a senha…",
    doneLabel: "Seu PDF foi desbloqueado",
    defaultOptions: { password: "" },
    keywords: "remover senha destravar desproteger",
  },
  {
    slug: "leitor",
    title: "Leitor de PDF",
    description: "Abra e leia PDFs com miniaturas, zoom e tela cheia. O arquivo não sai do seu computador.",
    icon: BookOpen,
    category: "ler",
    kind: "reader",
    ...PDF_ACCEPT,
    multiple: false,
    minFiles: 1,
    maxFiles: 1,
    reorderable: false,
    endpoint: "",
    fileField: "file",
    actionLabel: "Abrir PDF",
    progressLabel: "",
    doneLabel: "",
    defaultOptions: {},
    keywords: "visualizar abrir ler ver",
  },
];

export const READER_TOOL = PDF_TOOLS.find((t) => t.slug === "leitor") as PdfTool;

export function getToolBySlug(slug: string): PdfTool | undefined {
  return PDF_TOOLS.find((t) => t.slug === slug);
}

export function toolHref(tool: PdfTool): string {
  return `/dashboard/ferramentas-pdf/${tool.slug}`;
}

// Busca sem acento e sem diferenciar maiusculas.
export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
