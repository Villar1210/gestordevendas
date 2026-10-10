// src/features/pdf_tools/components/options/ToolOptionsPanel.tsx
// Um painel de opcoes por ferramenta (registrado pelo slug do catalogo).
"use client";

import type { ReactNode } from "react";
import { usePdfToolsStore } from "../../store/usePdfToolsStore";
import { validateRangeSyntax, validateRangesAgainstTotal } from "../../lib/format";
import { RASTER_MAX_PAGES, RASTER_MAX_PAGES_AT_300_DPI } from "../../catalog";
import { PasswordField, RadioCards, TextField, Toggle, useOption, Fieldset } from "./controls";

function useRangeError(value: string, allowEmpty: boolean): string | null {
  const total = usePdfToolsStore((s) => s.files[0]?.pages);
  if (!value.trim()) return null;
  return validateRangeSyntax(value, { allowEmpty }) ?? validateRangesAgainstTotal(value, total);
}

function TotalPagesNote() {
  const total = usePdfToolsStore((s) => s.files[0]?.pages);
  if (!total) return null;
  return (
    <p className="text-xs text-slate-500">
      Este PDF tem <span className="font-semibold text-slate-700">{total}</span> {total === 1 ? "página" : "páginas"}.
    </p>
  );
}

function SplitOptions() {
  const [mode, setMode] = useOption<string>("mode", "ranges");
  const [ranges, setRanges] = useOption<string>("ranges", "");
  const [pages, setPages] = useOption<string>("pages", "");
  const rangesError = useRangeError(ranges, false);
  const pagesError = useRangeError(pages, false);
  return (
    <>
      <RadioCards
        name="split-mode"
        legend="Como dividir"
        value={mode}
        onChange={setMode}
        options={[
          { value: "ranges", label: "Por intervalos", description: "Um PDF para cada intervalo, entregues num .zip." },
          { value: "extract", label: "Extrair páginas", description: "Um único PDF só com as páginas escolhidas." },
          { value: "every", label: "Uma página por arquivo", description: "Cada página vira um PDF, entregues num .zip." },
        ]}
      />
      {mode === "ranges" && (
        <TextField
          label="Intervalos"
          value={ranges}
          onChange={setRanges}
          placeholder="1-3, 4-6, 7-"
          hint="Separe os intervalos por vírgula. “7-” vai da página 7 até o fim."
          error={rangesError}
        />
      )}
      {mode === "extract" && (
        <TextField
          label="Páginas"
          value={pages}
          onChange={setPages}
          placeholder="1, 3, 5-7"
          hint="Páginas avulsas ou intervalos, separados por vírgula."
          error={pagesError}
        />
      )}
      <TotalPagesNote />
    </>
  );
}

function RotateOptions() {
  const [angle, setAngle] = useOption<number>("angle", 90);
  const [pages, setPages] = useOption<string>("pages", "");
  const error = useRangeError(pages, true);
  return (
    <>
      <RadioCards
        name="rotate-angle"
        legend="Girar"
        columns={3}
        value={angle}
        onChange={setAngle}
        options={[
          { value: 90, label: "90° direita" },
          { value: 180, label: "180°" },
          { value: 270, label: "90° esquerda" },
        ]}
      />
      <TextField
        label="Quais páginas (opcional)"
        value={pages}
        onChange={setPages}
        placeholder="Todas"
        hint="Deixe em branco para girar todas. Ex.: 1-3, 8"
        error={error}
      />
    </>
  );
}

function CompressOptions() {
  const [level, setLevel] = useOption<string>("level", "recomendada");
  return (
    <RadioCards
      name="compress-level"
      legend="Nível de compressão"
      value={level}
      onChange={setLevel}
      options={[
        { value: "leve", label: "Leve", description: "Qualidade quase igual à original. Boa para imprimir." },
        { value: "recomendada", label: "Recomendada", description: "Bom equilíbrio entre tamanho e qualidade." },
        { value: "extrema", label: "Extrema", description: "Menor arquivo possível; imagens perdem nitidez." },
      ]}
    />
  );
}

function ImagesToPdfOptions() {
  const [pageSize, setPageSize] = useOption<string>("pageSize", "A4");
  const [orientation, setOrientation] = useOption<string>("orientation", "auto");
  const [margin, setMargin] = useOption<string>("margin", "pequena");
  return (
    <>
      <RadioCards
        name="img-size"
        legend="Tamanho da página"
        columns={3}
        value={pageSize}
        onChange={setPageSize}
        options={[
          { value: "A4", label: "A4" },
          { value: "Carta", label: "Carta" },
          { value: "ajustar", label: "Da imagem" },
        ]}
      />
      {pageSize !== "ajustar" && (
        <RadioCards
          name="img-orientation"
          legend="Orientação"
          columns={3}
          value={orientation}
          onChange={setOrientation}
          options={[
            { value: "auto", label: "Automática" },
            { value: "retrato", label: "Retrato" },
            { value: "paisagem", label: "Paisagem" },
          ]}
        />
      )}
      <RadioCards
        name="img-margin"
        legend="Margem"
        columns={3}
        value={margin}
        onChange={setMargin}
        options={[
          { value: "nenhuma", label: "Nenhuma" },
          { value: "pequena", label: "Pequena" },
          { value: "grande", label: "Grande" },
        ]}
      />
    </>
  );
}

function BatchPagesNote({ dpi }: { dpi: number }) {
  const files = usePdfToolsStore((s) => s.files);
  const known = files.every((f) => typeof f.pages === "number");
  const total = files.reduce((sum, f) => sum + (f.pages ?? 0), 0);
  const max = dpi === 300 ? RASTER_MAX_PAGES_AT_300_DPI : RASTER_MAX_PAGES;
  const over = known && total > max;
  return (
    <div className="space-y-1.5 rounded-xl bg-slate-50 px-3.5 py-3 text-sm leading-relaxed text-slate-600">
      <p>
        Todas as páginas de cada PDF serão convertidas. Você recebe um <span className="font-semibold">.zip</span> com
        uma pasta por PDF.
      </p>
      {known && (
        <p className={over ? "font-medium text-rose-700" : "text-slate-500"}>
          {files.length} PDFs · <span className="font-semibold">{total}</span> {total === 1 ? "página" : "páginas"} no
          total (máx. {max}
          {dpi === 300 ? " em 300 dpi" : ""}).
        </p>
      )}
    </div>
  );
}

function PdfToImagesOptions() {
  const [format, setFormat] = useOption<string>("format", "jpg");
  const [dpi, setDpi] = useOption<number>("dpi", 150);
  const [pages, setPages] = useOption<string>("pages", "");
  const fileCount = usePdfToolsStore((s) => s.files.length);
  const error = useRangeError(pages, true);
  return (
    <>
      <RadioCards
        name="raster-format"
        legend="Formato"
        columns={2}
        value={format}
        onChange={setFormat}
        options={[
          { value: "jpg", label: "JPG", description: "Arquivos menores" },
          { value: "png", label: "PNG", description: "Sem perda, fundo nítido" },
        ]}
      />
      <RadioCards
        name="raster-dpi"
        legend="Resolução"
        columns={3}
        value={dpi}
        onChange={setDpi}
        options={[
          { value: 72, label: "Tela", description: "72 dpi" },
          { value: 150, label: "Padrão", description: "150 dpi" },
          { value: 300, label: "Impressão", description: "300 dpi" },
        ]}
      />
      {fileCount > 1 ? (
        <BatchPagesNote dpi={dpi} />
      ) : (
        <TextField
          label="Quais páginas (opcional)"
          value={pages}
          onChange={setPages}
          placeholder="Todas (máx. 100)"
          hint="Uma página gera a imagem direto; várias vêm num .zip."
          error={error}
        />
      )}
    </>
  );
}

function PageNumbersOptions() {
  const [position, setPosition] = useOption<string>("position", "inferior-centro");
  const [format, setFormat] = useOption<string>("format", "n");
  const [startAt, setStartAt] = useOption<number>("startAt", 1);
  const [skipFirst, setSkipFirst] = useOption<boolean>("skipFirst", false);
  return (
    <>
      <RadioCards
        name="pn-position"
        legend="Posição"
        value={position}
        onChange={setPosition}
        options={[
          { value: "inferior-centro", label: "Rodapé, ao centro" },
          { value: "inferior-direita", label: "Rodapé, à direita" },
          { value: "superior-direita", label: "Topo, à direita" },
        ]}
      />
      <RadioCards
        name="pn-format"
        legend="Formato"
        columns={3}
        value={format}
        onChange={setFormat}
        options={[
          { value: "n", label: "1" },
          { value: "n-de-total", label: "1 de 9" },
          { value: "pagina-n", label: "Página 1" },
        ]}
      />
      <TextField
        label="Começar em"
        type="number"
        inputMode="numeric"
        value={String(startAt)}
        onChange={(v) => setStartAt(v === "" ? 0 : Math.trunc(Number(v)))}
      />
      <Toggle
        label="Pular a primeira página"
        description="Útil quando a primeira página é a capa."
        checked={skipFirst}
        onChange={setSkipFirst}
      />
    </>
  );
}

function WatermarkOptions() {
  const [text, setText] = useOption<string>("text", "CONFIDENCIAL");
  const [opacity, setOpacity] = useOption<number>("opacity", 0.25);
  const [size, setSize] = useOption<string>("size", "medio");
  const [diagonal, setDiagonal] = useOption<boolean>("diagonal", true);
  return (
    <>
      <TextField
        label="Texto"
        value={text}
        onChange={setText}
        maxLength={60}
        hint={`${text.length}/60 caracteres`}
      />
      {/* Previa do carimbo: a parte mais importante desta ferramenta e ver o resultado antes. */}
      <div aria-hidden="true" className="relative flex aspect-[1.6] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="absolute inset-x-5 top-5 space-y-2">
          {[90, 75, 85, 60, 80].map((w, i) => (
            <div key={i} className="h-1.5 rounded-full bg-slate-100" style={{ width: `${w}%` }} />
          ))}
        </div>
        <span
          className="relative whitespace-nowrap font-bold text-slate-500"
          style={{
            opacity,
            transform: diagonal ? "rotate(-30deg)" : undefined,
            fontSize: size === "pequeno" ? 14 : size === "grande" ? 26 : 20,
          }}
        >
          {text.trim() || "Seu texto"}
        </span>
      </div>
      <div>
        <label htmlFor="wm-opacity" className="mb-1.5 flex justify-between text-sm font-semibold text-slate-800">
          Transparência <span className="font-normal text-slate-500">{Math.round(opacity * 100)}%</span>
        </label>
        <input
          id="wm-opacity"
          type="range"
          min={0.1}
          max={0.6}
          step={0.05}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="w-full accent-blue-700"
        />
      </div>
      <RadioCards
        name="wm-size"
        legend="Tamanho"
        columns={3}
        value={size}
        onChange={setSize}
        options={[
          { value: "pequeno", label: "Pequeno" },
          { value: "medio", label: "Médio" },
          { value: "grande", label: "Grande" },
        ]}
      />
      <Toggle label="Na diagonal" checked={diagonal} onChange={setDiagonal} />
    </>
  );
}

function ProtectOptions() {
  const [password, setPassword] = useOption<string>("password", "");
  const [confirm, setConfirm] = useOption<string>("confirm", "");
  const [allowPrint, setAllowPrint] = useOption<boolean>("allowPrint", true);
  const [allowCopy, setAllowCopy] = useOption<boolean>("allowCopy", false);
  const mismatch = confirm.length > 0 && confirm !== password;
  return (
    <>
      <PasswordField
        label="Senha"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        hint="De 4 a 64 caracteres. Guarde a senha: não é possível recuperá-la."
      />
      <div>
        <PasswordField label="Confirmar senha" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        {mismatch && <p className="mt-1.5 text-xs text-rose-600">As senhas não conferem.</p>}
      </div>
      <Fieldset legend="Quem abrir com a senha pode">
        <Toggle label="Imprimir" checked={allowPrint} onChange={setAllowPrint} />
        <Toggle label="Copiar texto" checked={allowCopy} onChange={setAllowCopy} />
      </Fieldset>
    </>
  );
}

function UnlockOptions() {
  const [password, setPassword] = useOption<string>("password", "");
  return (
    <PasswordField
      label="Senha atual do PDF"
      value={password}
      onChange={setPassword}
      autoComplete="current-password"
      hint="A senha é usada só para abrir o arquivo e não fica salva. Se o PDF abre sem senha mas bloqueia imprimir ou copiar, deixe em branco."
    />
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-slate-50 px-3.5 py-3 text-sm leading-relaxed text-slate-600">{children}</p>;
}

const PANELS: Record<string, () => ReactNode> = {
  juntar: () => <Note>Os arquivos serão unidos na ordem da lista. Arraste os cards para mudar a ordem.</Note>,
  dividir: SplitOptions,
  organizar: () => (
    <Note>Arraste as páginas para reordenar. Use os botões de cada página para girar ou excluir.</Note>
  ),
  girar: RotateOptions,
  comprimir: CompressOptions,
  "office-para-pdf": () => (
    <Note>A formatação é mantida o mais fiel possível. Fontes muito específicas podem ser substituídas.</Note>
  ),
  "imagens-para-pdf": ImagesToPdfOptions,
  "pdf-para-imagem": PdfToImagesOptions,
  "extrair-texto": () => (
    <Note>PDFs digitalizados (fotos de papel) não têm texto para extrair; o resultado pode vir vazio.</Note>
  ),
  "numeros-de-pagina": PageNumbersOptions,
  "marca-dagua": WatermarkOptions,
  proteger: ProtectOptions,
  desbloquear: UnlockOptions,
};

export function ToolOptionsPanel({ slug }: { slug: string }) {
  const Panel = PANELS[slug];
  return Panel ? <Panel /> : null;
}
