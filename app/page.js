import IssTracker from "./components/IssTracker";

export default function Page() {
  return (
    <main className="shell">
      <header className="masthead">
        <h1>ISS Live-Tracker</h1>
        <p className="masthead__sub">
          Live-Position der Internationalen Raumstation, aktualisiert alle 5 Sekunden.
        </p>
      </header>

      <IssTracker />
    </main>
  );
}
