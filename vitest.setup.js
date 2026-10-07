import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Ohne `globals: true` kann Testing Library ihre automatische Aufräumroutine
// nicht selbst registrieren - sonst sammeln sich die gerenderten Bäume
// zwischen den Tests an.
afterEach(cleanup);
