// src/shared/domain/constants/dashboard-roles.ts
// Roles com acesso ao dashboard interno (Kanban, Imoveis, WhatsApp, Equipe,
// RH). "Corretor" cobre corretor_house; "Corretor Parceiro" e uma role
// separada mas tambem tem acesso (decisao explicita - ver CLAUDE.md,
// "Correcao: controle de acesso por role no dashboard"). Cliente e
// Imobiliaria Parceira NAO estao aqui de proposito - ver mesma secao.
export const DASHBOARD_ROLES = ['Administrador', 'Corretor', 'Corretor Parceiro'];
