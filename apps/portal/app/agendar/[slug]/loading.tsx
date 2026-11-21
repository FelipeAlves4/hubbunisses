import "../../agenda/agenda.css";

export default function LoadingBooking() {
  return <main className="agenda-shell agenda-public" aria-busy="true">
    <p role="status">Carregando opções de reserva…</p><div className="agenda-skeleton" aria-hidden="true" />
  </main>;
}
