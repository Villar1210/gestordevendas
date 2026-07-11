// src/features/edoc/components/FieldPositionEditor.tsx
// Client-only (importado via next/dynamic com ssr:false no
// CreateEnvelopeModal) - mesmo motivo do PdfViewer.tsx. Renderiza uma
// pagina do PDF por vez, com navegacao, e uma caixa arrastavel/
// redimensionavel (react-rnd) por campo sobre a pagina atual.
//
// Fatia 3 (papeis + rubrica): um destinatario/remetente pode ter varios
// campos - 1 rubrica por pagina (todas compartilhando a MESMA posicao,
// arrastar qualquer uma propaga para as demais) + 1 assinatura completa
// (tipicamente na ultima pagina). Testemunha so tem assinatura - a opcao
// de rubrica nem aparece para esse papel (ver CLAUDE.md, regra do campo).
// Cada campo e identificado de forma unica por (recipientIndex, tipo),
// ja que so existe no maximo 1 assinatura e 1 "grupo" de rubrica por
// destinatario.
"use client";

import { useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Rnd } from "react-rnd";
import { ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { FIELD_TIPO_DEFAULTS, getRoleOption } from "../constants";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export interface FieldPosition {
  recipientIndex: number;
  tipo: "assinatura" | "rubrica";
  pageNumber: number;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}

export interface FieldPositionRecipient {
  name: string;
  role: string;
}

const PAGE_WIDTH = 640;

interface FieldPositionEditorProps {
  documentUrl: string;
  recipients: FieldPositionRecipient[];
  fields: FieldPosition[];
  onChange: (fields: FieldPosition[]) => void;
}

export function FieldPositionEditor({
  documentUrl,
  recipients,
  fields,
  onChange,
}: FieldPositionEditorProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const pageContainerRef = useRef<HTMLDivElement | null>(null);

  // Atualiza TODOS os campos do mesmo (recipientIndex, tipo) de uma vez -
  // para rubrica isso propaga a nova posicao para todas as paginas
  // automaticamente (mesma posicao em todas), sem mexer no pageNumber de
  // cada uma. Para assinatura, so existe 1 campo, entao o efeito e o mesmo
  // de atualizar so ele.
  function updateFieldGroup(
    recipientIndex: number,
    tipo: FieldPosition["tipo"],
    patch: Partial<Pick<FieldPosition, "xPercent" | "yPercent" | "widthPercent" | "heightPercent">>,
  ) {
    onChange(
      fields.map((field) =>
        field.recipientIndex === recipientIndex && field.tipo === tipo
          ? { ...field, ...patch }
          : field,
      ),
    );
  }

  function setAssinaturaPage(recipientIndex: number, pageNumber: number) {
    onChange(
      fields.map((field) =>
        field.recipientIndex === recipientIndex && field.tipo === "assinatura"
          ? { ...field, pageNumber }
          : field,
      ),
    );
  }

  function addRubrica(recipientIndex: number) {
    if (!numPages) return;
    const defaults = FIELD_TIPO_DEFAULTS.rubrica;
    const rubricaFields: FieldPosition[] = Array.from({ length: numPages }, (_, i) => ({
      recipientIndex,
      tipo: "rubrica",
      pageNumber: i + 1,
      xPercent: 0.75,
      yPercent: 0.88,
      widthPercent: defaults.widthPercent,
      heightPercent: defaults.heightPercent,
    }));
    onChange([...fields, ...rubricaFields]);
  }

  function removeRubrica(recipientIndex: number) {
    onChange(fields.filter((field) => !(field.recipientIndex === recipientIndex && field.tipo === "rubrica")));
  }

  function handleDragOrResizeStop(
    recipientIndex: number,
    tipo: FieldPosition["tipo"],
    pxX: number,
    pxY: number,
    pxWidth: number,
    pxHeight: number,
  ) {
    const container = pageContainerRef.current;
    if (!container) return;
    const { width, height } = container.getBoundingClientRect();
    updateFieldGroup(recipientIndex, tipo, {
      xPercent: Math.max(0, Math.min(1, pxX / width)),
      yPercent: Math.max(0, Math.min(1, pxY / height)),
      widthPercent: Math.max(0.03, Math.min(1, pxWidth / width)),
      heightPercent: Math.max(0.02, Math.min(1, pxHeight / height)),
    });
  }

  const fieldsOnCurrentPage = fields.filter((field) => field.pageNumber === currentPage);

  return (
    <div>
      <div className="mb-3 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
          aria-label="Pagina anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm text-slate-600">
          Pagina {currentPage} de {numPages || "..."}
        </span>
        <button
          type="button"
          onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
          disabled={currentPage >= numPages}
          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
          aria-label="Proxima pagina"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex justify-center overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-4">
        <div ref={pageContainerRef} className="relative shrink-0">
          <Document
            file={documentUrl}
            onLoadSuccess={({ numPages: total }) => setNumPages(total)}
            loading={
              <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              </div>
            }
          >
            <Page pageNumber={currentPage} width={PAGE_WIDTH} />
          </Document>

          {fieldsOnCurrentPage.map((field) => {
            const container = pageContainerRef.current;
            const size = container?.getBoundingClientRect();
            const width = size?.width ?? PAGE_WIDTH;
            const height = size?.height ?? PAGE_WIDTH * 1.41;
            const recipient = recipients[field.recipientIndex];
            const role = getRoleOption(recipient?.role ?? "destinatario");
            const isRubrica = field.tipo === "rubrica";
            return (
              <Rnd
                key={`${field.recipientIndex}-${field.tipo}`}
                bounds="parent"
                size={{ width: field.widthPercent * width, height: field.heightPercent * height }}
                position={{ x: field.xPercent * width, y: field.yPercent * height }}
                onDragStop={(_e, d) =>
                  handleDragOrResizeStop(
                    field.recipientIndex,
                    field.tipo,
                    d.x,
                    d.y,
                    field.widthPercent * width,
                    field.heightPercent * height,
                  )
                }
                onResizeStop={(_e, _dir, ref, _delta, pos) =>
                  handleDragOrResizeStop(
                    field.recipientIndex,
                    field.tipo,
                    pos.x,
                    pos.y,
                    ref.offsetWidth,
                    ref.offsetHeight,
                  )
                }
                className={`flex items-center justify-center rounded-md border-2 text-center text-[11px] font-medium leading-tight ${
                  isRubrica ? "border-dashed" : "border-solid"
                } ${role.fieldBorderClassName} ${role.fieldBgClassName}`}
              >
                {isRubrica ? "Rubrica" : recipient?.name || "Assinatura"}
              </Rnd>
            );
          })}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {recipients.map((recipient, recipientIndex) => {
          const role = getRoleOption(recipient.role);
          const assinaturaField = fields.find(
            (f) => f.recipientIndex === recipientIndex && f.tipo === "assinatura",
          );
          const rubricaCount = fields.filter(
            (f) => f.recipientIndex === recipientIndex && f.tipo === "rubrica",
          ).length;

          return (
            <div
              key={recipientIndex}
              className={`rounded-lg border p-3 text-sm ${role.cardBorderClassName}`}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${role.dotClassName}`} />
                <span className="font-medium text-slate-700">{recipient.name || "(sem nome)"}</span>
                <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${role.badgeClassName}`}>
                  {role.label}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {assinaturaField && (
                  <label className="flex items-center gap-2 text-xs text-slate-500">
                    Assinatura na pagina:
                    <select
                      value={assinaturaField.pageNumber}
                      onChange={(e) => setAssinaturaPage(recipientIndex, Number(e.target.value))}
                      className="rounded-md border border-slate-200 px-2 py-1 text-slate-700 outline-none focus:border-blue-600"
                    >
                      {Array.from({ length: numPages }, (_, i) => i + 1).map((page) => (
                        <option key={page} value={page}>
                          {page}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {recipient.role !== "testemunha" &&
                  (rubricaCount > 0 ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>Rubrica em todas as {rubricaCount} paginas</span>
                      <button
                        type="button"
                        onClick={() => removeRubrica(recipientIndex)}
                        className="flex items-center gap-1 text-red-500 hover:underline"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remover
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addRubrica(recipientIndex)}
                      disabled={!numPages}
                      className={`flex items-center gap-1 text-xs font-medium disabled:opacity-40 ${role.buttonClassName}`}
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar Rubrica (todas as paginas)
                    </button>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
