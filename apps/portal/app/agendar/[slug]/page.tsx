import { CalendarDays } from "lucide-react";
import { getPublicCatalog } from "../actions";
import { BookingJourney } from "./journey";
import { localDay } from "../../../lib/agenda/model";
import "../../agenda/agenda.css";

export const dynamic = "force-dynamic";

export default async function PublicAgendaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getPublicCatalog(slug);
  return <main className="agenda-shell agenda-public">
    <header className="agenda-public-header">
      <CalendarDays size={23} aria-hidden="true" />
      <h1>{result.catalog?.name ?? "Agendamento online"}</h1>
    </header>
    {result.catalog ? <BookingJourney catalog={result.catalog} slug={slug} today={localDay(new Date(), result.catalog.timezone)} />
      : <section className="agenda-paper"><p role="status">{result.error}</p></section>}
  </main>;
}
