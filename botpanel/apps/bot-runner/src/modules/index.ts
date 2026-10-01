import type { BotModule } from "./types.js";
import { welcomeModule } from "./welcome.js";

/** Alle aktiven Module. Neue Module (tickets, antispam, …) hier eintragen. */
export const modules: BotModule[] = [welcomeModule];
