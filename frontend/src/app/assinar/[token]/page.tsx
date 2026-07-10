// src/app/assinar/[token]/page.tsx
// Pagina PUBLICA (sem login, fora do layout do dashboard) - o token da URL
// e a propria credencial de acesso. Ver GetEnvelopeByTokenUseCase /
// SignDocumentUseCase no backend.
"use client";

import { useEffect, useRef, useState, use as usePromise } from "react";
import dynamic from "next/dynamic";
import { CheckCircle2, PenLine, Type, AlertCircle, Loader2, Target } from "lucide-react";
import { apiRequest, ApiError, API_BASE_URL } from "@/core/api/client";
import type { HighlightField } from "@/features/edoc/components/PdfViewer";

// ssr:false e obrigatorio aqui - ver comentario em PdfViewer.tsx.
const PdfViewer = dynamic(
  () => import("@/features/edoc/components/PdfViewer").then((mod) => mod.PdfViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      </div>
    ),
  },
);

interface SignSessionData {
  envelope: { title: string; documentUrl: string; status: string };
  recipient: { name: string; email: string; status: string };
  fields: HighlightField[];
}

export default function AssinarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = usePromise(params);

  const [data, setData] = useState<SignSessionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signMethod, setSignMethod] = useState<"desenhar" | "digitar">("desenhar");
  const [typedName, setTypedName] = useState("");
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    apiRequest<SignSessionData>(`/edoc/sign/${token}`)
      .then((result) => {
        setData(result);
        setTypedName(result.recipient.name);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Nao foi possivel carregar o documento.");
      })
      .finally(() => setLoading(false));
  }, [token]);

  function getCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawingRef.current = true;
    const { x, y } = getCanvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCanvasPoint(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1e293b";
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawing(true);
  }

  function handlePointerUp() {
    drawingRef.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
  }

  async function handleSign() {
    if (!data) return;

    let signatureImageData: string;
    if (signMethod === "desenhar") {
      if (!hasDrawing || !canvasRef.current) {
        alert("Desenhe sua assinatura antes de continuar.");
        return;
      }
      signatureImageData = canvasRef.current.toDataURL("image/png");
    } else {
      if (!typedName.trim()) {
        alert("Digite seu nome antes de continuar.");
        return;
      }
      signatureImageData = typedName.trim();
    }

    setSigning(true);
    try {
      await apiRequest(`/edoc/sign/${token}`, {
        method: "POST",
        body: JSON.stringify({ signatureImageData }),
      });
      setSigned(true);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel assinar o documento.");
    } finally {
      setSigning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h1 className="mb-2 text-xl font-semibold text-slate-800">Link indisponivel</h1>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" />
          <h1 className="mb-2 text-xl font-semibold text-slate-800">Documento assinado!</h1>
          <p className="text-sm text-slate-500">
            Obrigado, {data?.recipient.name}. Sua assinatura foi registrada com sucesso.
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const alreadySigned = data.recipient.status === "assinado";
  const documentUrl = `${API_BASE_URL}${data.envelope.documentUrl}`;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
          <h1 className="text-lg font-semibold text-slate-800">{data.envelope.title}</h1>
          <p className="text-sm text-slate-500">Assinando como {data.recipient.name}</p>
        </div>

        {alreadySigned ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center text-sm text-green-700">
            Voce ja assinou este documento.
          </div>
        ) : (
          <>
            <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4">
              <PdfViewer documentUrl={documentUrl} highlightField={data.fields[0]} />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-1.5 text-sm font-medium text-blue-700">
                <Target className="h-4 w-4" />
                <p>
                  E aqui que sua assinatura vai aparecer no documento (destacado{" "}
                  {data.fields[0] ? `na pagina ${data.fields[0].pageNumber}` : "acima"}).
                </p>
              </div>

              <div className="mb-3 flex rounded-lg border border-slate-200 p-0.5">
                <button
                  onClick={() => setSignMethod("desenhar")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    signMethod === "desenhar"
                      ? "bg-blue-700 text-white"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <PenLine className="h-4 w-4" /> Desenhar assinatura
                </button>
                <button
                  onClick={() => setSignMethod("digitar")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    signMethod === "digitar"
                      ? "bg-blue-700 text-white"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Type className="h-4 w-4" /> Digitar nome
                </button>
              </div>

              {signMethod === "desenhar" ? (
                <div>
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={160}
                    className="w-full touch-none rounded-lg border border-slate-300 bg-slate-50"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                  />
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="mt-2 text-xs font-medium text-slate-500 hover:underline"
                  >
                    Limpar
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="text"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-3 text-2xl italic text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    style={{ fontFamily: "cursive" }}
                  />
                </div>
              )}

              <button
                onClick={handleSign}
                disabled={signing}
                className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {signing ? "Assinando..." : "Assinar Documento"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
