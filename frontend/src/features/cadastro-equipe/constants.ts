// src/features/cadastro-equipe/constants.ts
// Ficha da equipe interna (RH, 25/11/2026) - opcoes iguais as do backend
// (src/modules/rh/infra/http/dtos/cadastro-equipe.dto.ts).
export const CARGOS = [
  "Consultor de Vendas",
  "Corretor Imobiliário",
  "Coordenador de Vendas",
  "Gerente de Vendas",
  "Gerente Regional",
  "Coordenador de Parcerias",
  "Supervisor de Parcerias",
];
export const ESTADOS_CIVIS = ["Solteiro(a)", "Casado(a)", "Divorciado(a)", "Viúvo(a)", "União estável"];
export const QTD_FILHOS = ["Nenhum", "1", "2", "3", "4", "5", "5 ou mais"];
export const ESCOLARIDADES = [
  "Ensino Fundamental Incompleto",
  "Ensino Fundamental Completo",
  "Ensino Médio Incompleto",
  "Ensino Médio Completo",
  "Ensino Técnico",
  "Ensino Superior Incompleto",
  "Ensino Superior Completo",
  "Pós-graduação / Especialização",
  "Mestrado / Doutorado",
];
export const TIPOS_PIX = ["CPF", "CNPJ", "E-mail", "Celular", "Aleatória"];
export const CAMISAS = ["PP", "P", "M", "G", "GG", "XG"];
export const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
export const BANCOS = [
  "Banco do Brasil",
  "Bradesco",
  "Itaú",
  "Santander",
  "Caixa Econômica Federal",
  "Nubank",
  "Inter",
  "C6 Bank",
  "BTG Pactual",
  "Sicoob",
  "Sicredi",
  "PagBank",
  "Mercado Pago",
  "Outro",
];

export const ETAPAS = ["Indicação e cargo", "Dados pessoais", "Endereço", "Escolaridade e CRECI", "Pagamento", "Revisão e aceite"];

export interface FichaEquipe {
  indicadoPor: string;
  cargo: string;
  jaTrabalhouNoGrupo: "" | "sim" | "nao";
  superiorId: string;
  nome: string;
  rg: string;
  rgUf: string;
  cpf: string;
  nomeMae: string;
  nomePai: string;
  dataNascimento: string;
  paisNascimento: string;
  estadoNascimento: string;
  cidadeNascimento: string;
  estadoCivil: string;
  nomeConjuge: string;
  quantidadeFilhos: string;
  email: string;
  telefone: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  cep: string;
  escolaridade: string;
  possuiCreci: "" | "sim" | "nao";
  creciTipo: string;
  creciNumero: string;
  creciValidade: string;
  creciSupervisor: string;
  banco: string;
  agencia: string;
  conta: string;
  tipoConta: string;
  tipoPix: string;
  chavePix: string;
  optaPj: "" | "sim" | "nao";
  cnpj: string;
  pjBanco: string;
  pjAgencia: string;
  pjConta: string;
  tamanhoCamisa: string;
  senha: string;
  senha2: string;
  aceiteLgpd: boolean;
}

export const FICHA_VAZIA: FichaEquipe = {
  indicadoPor: "",
  cargo: "",
  jaTrabalhouNoGrupo: "",
  superiorId: "",
  nome: "",
  rg: "",
  rgUf: "SP",
  cpf: "",
  nomeMae: "",
  nomePai: "",
  dataNascimento: "",
  paisNascimento: "Brasil",
  estadoNascimento: "",
  cidadeNascimento: "",
  estadoCivil: "",
  nomeConjuge: "",
  quantidadeFilhos: "",
  email: "",
  telefone: "",
  rua: "",
  numero: "",
  bairro: "",
  cidade: "",
  cep: "",
  escolaridade: "",
  possuiCreci: "",
  creciTipo: "",
  creciNumero: "",
  creciValidade: "",
  creciSupervisor: "",
  banco: "",
  agencia: "",
  conta: "",
  tipoConta: "",
  tipoPix: "",
  chavePix: "",
  optaPj: "",
  cnpj: "",
  pjBanco: "",
  pjAgencia: "",
  pjConta: "",
  tamanhoCamisa: "",
  senha: "",
  senha2: "",
  aceiteLgpd: false,
};

const dig = (s: string) => s.replace(/\D/g, "");
export const casado = (f: FichaEquipe) => f.estadoCivil === "Casado(a)" || f.estadoCivil === "União estável";

// Campos obrigatorios que faltam (ou estao invalidos) em cada etapa.
export function errosDaEtapa(etapa: number, f: FichaEquipe): Record<string, string> {
  const e: Record<string, string> = {};
  const req = (k: keyof FichaEquipe, msg = "Obrigatório") => {
    if (!String(f[k] ?? "").trim()) e[k] = msg;
  };
  if (etapa === 0) {
    req("indicadoPor");
    req("cargo", "Escolha o cargo");
    req("superiorId", "Escolha na lista");
    req("jaTrabalhouNoGrupo", "Responda sim ou não");
  }
  if (etapa === 1) {
    req("nome");
    if (f.nome.trim() && f.nome.trim().split(/\s+/).length < 2) e.nome = "Nome completo (nome e sobrenome)";
    req("rg");
    if (dig(f.cpf).length !== 11) e.cpf = "CPF com 11 números";
    req("nomeMae");
    req("nomePai");
    req("dataNascimento");
    req("paisNascimento");
    req("estadoNascimento");
    req("cidadeNascimento");
    req("estadoCivil");
    if (casado(f)) req("nomeConjuge");
    req("quantidadeFilhos");
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "E-mail inválido";
    if (![10, 11].includes(dig(f.telefone).length)) e.telefone = "Celular com DDD";
  }
  if (etapa === 2) {
    req("rua");
    req("numero");
    req("bairro");
    req("cidade");
    if (dig(f.cep).length !== 8) e.cep = "CEP com 8 números";
  }
  if (etapa === 3) {
    req("escolaridade");
    req("possuiCreci", "Responda sim ou não");
    if (f.possuiCreci === "sim") {
      req("creciTipo");
      req("creciNumero");
      req("creciValidade");
    }
  }
  if (etapa === 4) {
    req("banco");
    if (!/^[\d-]{1,10}$/.test(f.agencia.trim())) e.agencia = "Só números";
    if (!/^[\dXx-]{2,20}$/.test(f.conta.trim())) e.conta = "Ex.: 00000-0";
    req("tipoConta");
    req("tipoPix");
    req("chavePix");
    req("optaPj", "Responda sim ou não");
    if (f.optaPj === "sim") {
      if (dig(f.cnpj).length !== 14) e.cnpj = "CNPJ com 14 números";
      req("pjBanco");
      if (!/^[\d-]{1,10}$/.test(f.pjAgencia.trim())) e.pjAgencia = "Só números";
      if (!/^[\dXx-]{2,20}$/.test(f.pjConta.trim())) e.pjConta = "Ex.: 00000-0";
    }
  }
  if (etapa === 5) {
    req("tamanhoCamisa", "Escolha o tamanho");
    if (f.senha.length < 8) e.senha = "Mínimo 8 caracteres";
    if (f.senha2 !== f.senha) e.senha2 = "As senhas não conferem";
    if (!f.aceiteLgpd) e.aceiteLgpd = "Necessário para enviar";
  }
  return e;
}

export function paraEnvio(f: FichaEquipe) {
  const sim = (v: string) => v === "sim";
  return {
    indicadoPor: f.indicadoPor,
    cargo: f.cargo,
    jaTrabalhouNoGrupo: sim(f.jaTrabalhouNoGrupo),
    superiorId: f.superiorId,
    nome: f.nome,
    rg: f.rg,
    rgUf: f.rgUf,
    cpf: f.cpf,
    nomeMae: f.nomeMae,
    nomePai: f.nomePai,
    dataNascimento: f.dataNascimento,
    paisNascimento: f.paisNascimento,
    estadoNascimento: f.estadoNascimento,
    cidadeNascimento: f.cidadeNascimento,
    estadoCivil: f.estadoCivil,
    ...(casado(f) ? { nomeConjuge: f.nomeConjuge } : {}),
    quantidadeFilhos: f.quantidadeFilhos,
    email: f.email,
    telefone: f.telefone,
    rua: f.rua,
    numero: f.numero,
    bairro: f.bairro,
    cidade: f.cidade,
    cep: f.cep,
    escolaridade: f.escolaridade,
    possuiCreci: sim(f.possuiCreci),
    ...(sim(f.possuiCreci) ? { creciTipo: f.creciTipo, creciNumero: f.creciNumero, creciValidade: f.creciValidade } : {}),
    ...(f.creciSupervisor.trim() ? { creciSupervisor: f.creciSupervisor } : {}),
    banco: f.banco,
    agencia: f.agencia,
    conta: f.conta,
    tipoConta: f.tipoConta,
    tipoPix: f.tipoPix,
    chavePix: f.chavePix,
    optaPj: sim(f.optaPj),
    ...(sim(f.optaPj) ? { cnpj: f.cnpj, pjBanco: f.pjBanco, pjAgencia: f.pjAgencia, pjConta: f.pjConta } : {}),
    tamanhoCamisa: f.tamanhoCamisa,
    senha: f.senha,
    aceiteLgpd: f.aceiteLgpd,
  };
}
