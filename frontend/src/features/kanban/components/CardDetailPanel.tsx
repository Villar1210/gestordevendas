// src/features/kanban/components/CardDetailPanel.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import { X, Plus, Trash2, CheckSquare, FileText } from "lucide-react";
import { useKanbanStore } from "../store/useKanbanStore";
import { useKanbanIntegration, Activity, Note } from "../hooks/useKanbanIntegration";
import { ACTIVITY_TYPE_OPTIONS, getActivityTypeOption } from "@/core/constants/activityTypes";

type Tab = "atividades" | "anotacoes" | "dados" | "documentos";

const TABS: Tab[] = ["atividades", "anotacoes", "dados", "documentos"];

const TAB_LABELS: Record<Tab, string> = {
  atividades: "Atividades",
  anotacoes: "Anotacoes",
  dados: "Dados do Cliente",
  documentos: "Documentos",
};

const TEMPERATURE_OPTIONS = [
  { value: "", label: "Nao definida" },
  { value: "quente", label: "🔥 Quente" },
  { value: "morno", label: "☀️ Morno" },
  { value: "frio", label: "❄️ Frio" },
];

interface CustomFieldRow {
  key: string;
  value: string;
}

function sortActivities(a: Activity, b: Activity): number {
  if (!a.scheduledAt && !b.scheduledAt) return 0;
  if (!a.scheduledAt) return 1;
  if (!b.scheduledAt) return -1;
  return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
}

export function CardDetailPanel() {
  const cardDetailPanel = useKanbanStore((state) => state.cardDetailPanel);
  const closeCardDetailPanel = useKanbanStore((state) => state.closeCardDetailPanel);
  const {
    handleUpdateCard,
    handleCreateActivity,
    handleListActivities,
    handleToggleActivityDone,
    handleCreateNote,
    handleListNotes,
  } = useKanbanIntegration();

  const [activeTab, setActiveTab] = useState<Tab>("atividades");

  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityType, setActivityType] = useState("ligacao");
  const [activitySubject, setActivitySubject] = useState("");
  const [activityScheduledAt, setActivityScheduledAt] = useState("");
  const [savingActivity, setSavingActivity] = useState(false);

  const [notes, setNotes] = useState<Note[]>([]);
  const [noteBody, setNoteBody] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [phone, setPhone] = useState("");
  const [temperatura, setTemperatura] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cep, setCep] = useState("");
  const [customFieldRows, setCustomFieldRows] = useState<CustomFieldRow[]>([]);
  const [savingClientData, setSavingClientData] = useState(false);

  const card = cardDetailPanel.card;

  useEffect(() => {
    if (!cardDetailPanel.isOpen || !card) return;

    setActiveTab("atividades");
    setTitle(card.title);
    setValue(String(card.value));
    setPhone(card.phone ?? "");
    setTemperatura(card.temperatura ?? "");
    setEmail(card.email ?? "");
    setEndereco(card.endereco ?? "");
    setNumero(card.numero ?? "");
    setComplemento(card.complemento ?? "");
    setBairro(card.bairro ?? "");
    setCep(card.cep ?? "");
    setCustomFieldRows(
      Object.entries(card.customFields ?? {}).map(([key, val]) => ({
        key,
        value: String(val),
      })),
    );

    handleListActivities(card.id).then((list) => setActivities([...list].sort(sortActivities)));
    handleListNotes(card.id).then(setNotes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardDetailPanel.isOpen, card?.id]);

  if (!cardDetailPanel.isOpen || !card) return null;

  async function handleScheduleActivity(e: FormEvent) {
    e.preventDefault();
    if (!card) return;
    setSavingActivity(true);
    try {
      const created = await handleCreateActivity(card.id, {
        type: activityType,
        subject: activitySubject.trim() || undefined,
        scheduledAt: activityScheduledAt || undefined,
      });
      if (created) {
        setActivities((prev) => [...prev, created].sort(sortActivities));
        setActivitySubject("");
        setActivityScheduledAt("");
      }
    } finally {
      setSavingActivity(false);
    }
  }

  async function handleToggleDone(activityId: string) {
    // Atualizacao otimista: o checkbox e controlado, entao sem isso ele
    // "volta" visualmente ate a resposta da API chegar.
    setActivities((prev) =>
      prev.map((a) => (a.id === activityId ? { ...a, done: !a.done } : a)),
    );
    const updated = await handleToggleActivityDone(activityId);
    if (updated) {
      setActivities((prev) => prev.map((a) => (a.id === activityId ? updated : a)));
    } else {
      setActivities((prev) =>
        prev.map((a) => (a.id === activityId ? { ...a, done: !a.done } : a)),
      );
    }
  }

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    if (!card || !noteBody.trim()) return;
    setSavingNote(true);
    try {
      const created = await handleCreateNote(card.id, noteBody.trim());
      if (created) {
        setNotes((prev) => [created, ...prev]);
        setNoteBody("");
      }
    } finally {
      setSavingNote(false);
    }
  }

  function handleAddCustomField() {
    setCustomFieldRows((rows) => [...rows, { key: "", value: "" }]);
  }

  function handleRemoveCustomField(index: number) {
    setCustomFieldRows((rows) => rows.filter((_, i) => i !== index));
  }

  function handleCustomFieldChange(index: number, field: "key" | "value", newVal: string) {
    setCustomFieldRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: newVal } : row)),
    );
  }

  async function handleSaveClientData(e: FormEvent) {
    e.preventDefault();
    if (!card) return;
    setSavingClientData(true);

    const customFields: Record<string, unknown> = {};
    for (const row of customFieldRows) {
      if (row.key.trim()) customFields[row.key.trim()] = row.value;
    }

    try {
      await handleUpdateCard(card.id, {
        title,
        value: Number(value) || 0,
        phone: phone.trim() || null,
        temperatura: temperatura || null,
        email: email.trim() || null,
        endereco: endereco.trim() || null,
        numero: numero.trim() || null,
        complemento: complemento.trim() || null,
        bairro: bairro.trim() || null,
        cep: cep.trim() || null,
        customFields,
      });
    } finally {
      setSavingClientData(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={closeCardDetailPanel}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-800">{card.title}</h2>
          <button
            onClick={closeCardDetailPanel}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 px-4">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition ${
                activeTab === tab
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "atividades" && (
            <div>
              <form onSubmit={handleScheduleActivity} className="mb-6 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {ACTIVITY_TYPE_OPTIONS.map((t) => {
                    const Icon = t.icon;
                    const active = activityType === t.value;
                    return (
                      <button
                        type="button"
                        key={t.value}
                        onClick={() => setActivityType(t.value)}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          active
                            ? "border-blue-600 bg-blue-50 text-blue-600"
                            : "border-slate-200 text-slate-500 hover:border-slate-300"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" /> {t.label}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  placeholder="Assunto (opcional)"
                  value={activitySubject}
                  onChange={(e) => setActivitySubject(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
                <div className="flex gap-2">
                  <input
                    type="datetime-local"
                    value={activityScheduledAt}
                    onChange={(e) => setActivityScheduledAt(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                  <button
                    type="submit"
                    disabled={savingActivity}
                    className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
                  >
                    Agendar
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                {activities.length === 0 && (
                  <p className="text-sm text-slate-400">Nenhuma atividade ainda.</p>
                )}
                {activities.map((activity) => {
                  const typeInfo = getActivityTypeOption(activity.type);
                  const Icon = typeInfo?.icon ?? CheckSquare;
                  return (
                    <div
                      key={activity.id}
                      className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"
                    >
                      <input
                        type="checkbox"
                        checked={activity.done}
                        onChange={() => handleToggleDone(activity.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                      />
                      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm ${
                            activity.done ? "text-slate-400 line-through" : "text-slate-800"
                          }`}
                        >
                          {typeInfo?.label ?? activity.type}
                          {activity.subject ? ` - ${activity.subject}` : ""}
                        </p>
                        {activity.scheduledAt && (
                          <p className="text-xs text-slate-400">
                            {new Date(activity.scheduledAt).toLocaleString("pt-BR")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "anotacoes" && (
            <div>
              <form onSubmit={handleAddNote} className="mb-6 flex gap-2">
                <textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="Escreva uma anotacao..."
                  rows={2}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
                <button
                  type="submit"
                  disabled={savingNote || !noteBody.trim()}
                  className="self-start rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  Adicionar nota
                </button>
              </form>

              <div className="space-y-3">
                {notes.length === 0 && (
                  <p className="text-sm text-slate-400">Nenhuma anotacao ainda.</p>
                )}
                {notes.map((note) => (
                  <div key={note.id} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-sm text-slate-800">{note.body}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {new Date(note.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "dados" && (
            <form onSubmit={handleSaveClientData} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-slate-500">Nome</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-500">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-500">Temperatura</label>
                  <select
                    value={temperatura}
                    onChange={(e) => setTemperatura(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    {TEMPERATURE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-500">Telefone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 91234-5678"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-500">E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-500">Endereco</label>
                <input
                  type="text"
                  value={endereco}
                  onChange={(e) => setEndereco(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-500">Numero</label>
                  <input
                    type="text"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-500">Complemento</label>
                  <input
                    type="text"
                    value={complemento}
                    onChange={(e) => setComplemento(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-500">Bairro</label>
                  <input
                    type="text"
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-500">CEP</label>
                  <input
                    type="text"
                    value={cep}
                    onChange={(e) => setCep(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm text-slate-500">Campos personalizados</label>
                  <button
                    type="button"
                    onClick={handleAddCustomField}
                    className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar campo
                  </button>
                </div>
                <div className="space-y-2">
                  {customFieldRows.map((row, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Chave"
                        value={row.key}
                        onChange={(e) => handleCustomFieldChange(index, "key", e.target.value)}
                        className="w-1/2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      />
                      <input
                        type="text"
                        placeholder="Valor"
                        value={row.value}
                        onChange={(e) => handleCustomFieldChange(index, "value", e.target.value)}
                        className="w-1/2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomField(index)}
                        className="text-slate-400 hover:text-red-500"
                        aria-label="Remover campo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={savingClientData}
                className="w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {savingClientData ? "Salvando..." : "Salvar"}
              </button>
            </form>
          )}

          {activeTab === "documentos" && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
              <FileText className="h-8 w-8" />
              <p className="text-sm">Em breve - upload de documentos</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
