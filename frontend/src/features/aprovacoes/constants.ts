// src/features/aprovacoes/constants.ts
// Espelha os valores aceitos pelo backend (public-signup.dto.ts /
// aprovar-cadastro.dto.ts). CARGO_HIERARQUICO_OPTIONS/ROLES_COM_HIERARQUIA
// moraram aqui, mas foram promovidas para core/constants/cargoHierarquico.ts
// quando passaram a ser usadas tambem pela aba "Permissoes/Cargos" do
// Painel Administrativo (features/configuracoes) - reaproveitadas daqui.

// Badge de status do contrato de prestacao de servico (aba "Aprovados") -
// reaproveita os mesmos 4 status do E-doc (rascunho/aguardando_assinaturas/
// concluido/cancelado, ver features/edoc/constants.ts) + "sem_contrato",
// que so aparece se a geracao automatica falhou silenciosamente (ver
// try/catch em AprovarCadastroUseCase) - nunca deveria acontecer, mas vale
// mostrar em vez de esconder o problema.
export function getStatusContratoLabel(status: string): { label: string; badgeClassName: string } {
  if (status === "sem_contrato") {
    return { label: "Sem contrato", badgeClassName: "bg-red-100 text-red-700" };
  }
  const labels: Record<string, string> = {
    rascunho: "Rascunho",
    aguardando_assinaturas: "Aguardando Assinatura",
    concluido: "Assinado",
    cancelado: "Cancelado",
  };
  const classes: Record<string, string> = {
    rascunho: "bg-slate-100 text-slate-700",
    aguardando_assinaturas: "bg-amber-100 text-amber-700",
    concluido: "bg-green-100 text-green-700",
    cancelado: "bg-red-100 text-red-700",
  };
  return {
    label: labels[status] ?? status,
    badgeClassName: classes[status] ?? "bg-slate-100 text-slate-700",
  };
}

export function getTipoClienteLabel(tipoCliente: string | null): string {
  if (tipoCliente === "comprador") return "Comprador";
  if (tipoCliente === "proprietario") return "Proprietario";
  if (tipoCliente === "ambos") return "Comprador e Proprietario";
  return "-";
}
