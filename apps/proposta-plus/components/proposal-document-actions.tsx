"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { Download, MessageCircle, Share2 } from "lucide-react";
import {
  pdfFileName,
  whatsappUrl,
  type OrganizationDocumentFallback,
  type ProposalDocumentData,
  type ProposalTemplate,
} from "../lib/proposal-document";
import { ProposalPdf } from "./proposal-pdf";

export function ProposalDocumentActions({
  proposal,
  fallback,
  template,
  onNotice,
  onError,
}: {
  proposal: ProposalDocumentData;
  fallback: OrganizationDocumentFallback;
  template: ProposalTemplate;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const whatsapp = whatsappUrl(proposal);
  const createPdf = () => pdf(<ProposalPdf proposal={proposal} fallback={fallback} template={template} />).toBlob();
  async function download() {
    setGenerating(true);
    try {
      const blob = await createPdf();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = pdfFileName(proposal);
      link.click();
      URL.revokeObjectURL(url);
      onNotice("PDF gerado e download iniciado.");
    } catch {
      onError("Não foi possível gerar o PDF. Verifique o logotipo e tente novamente.");
    } finally {
      setGenerating(false);
    }
  }
  async function share() {
    setGenerating(true);
    try {
      const blob = await createPdf();
      const file = new File([blob], pdfFileName(proposal), { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ title: proposal.title, text: `Proposta ${proposal.number}`, files: [file] });
        onNotice("Compartilhamento concluído.");
      } else {
        await download();
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      onError("Não foi possível abrir o compartilhamento. Baixe o PDF manualmente.");
    } finally {
      setGenerating(false);
    }
  }
  return <div className="document-actions">
    <button className="outline" type="button" onClick={() => void download()} disabled={generating}><Download size={17} />{generating ? "Gerando PDF…" : "Baixar PDF"}</button>
    <button className="outline" type="button" onClick={() => void share()} disabled={generating}><Share2 size={17} />Compartilhar arquivo</button>
    {whatsapp ? <a className="whatsapp-button" href={whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={17} />Abrir no WhatsApp</a> : <p className="document-help">WhatsApp disponível quando o cliente tiver telefone válido.</p>}
  </div>;
}
