/**
 * Découpage des absences en barres continues pour la vue mensuelle.
 *
 * La vue mensuelle se lit par SEMAINES : une absence qui traverse trois
 * semaines donne trois segments, chacun avec ses colonnes de début et de fin,
 * et deux drapeaux indiquant qu'elle continue au-delà du bord.
 *
 * Les segments d'une même semaine sont ensuite répartis en « pistes » : une
 * piste est une ligne sur laquelle aucun segment n'en chevauche un autre. C'est
 * ce qui permet d'afficher plusieurs absences simultanées sans qu'elles se
 * recouvrent.
 *
 * Ce module est volontairement pur — pas de JSX, pas de dépendance au rendu —
 * pour que la règle de placement reste lisible et vérifiable seule.
 */

export type AbsenceMin = {
  member_id: string;
  member_name: string;
  leave_type_name: string;
  leave_type_color: string;
  start_date: string;
  end_date: string;
  start_half?: string | null;
  end_half?: string | null;
  total_days: number;
};

export type Segment = {
  absence: AbsenceMin;
  /** Colonne de début, 0 = lundi. */
  colStart: number;
  /** Colonne de fin, 6 = dimanche. */
  colEnd: number;
  /** Numéro de piste, 0 = la plus haute. */
  piste: number;
  /** L'absence a commencé avant cette semaine. */
  suiteAvant: boolean;
  /** L'absence continue après cette semaine. */
  suiteApres: boolean;
};

export type Semaine = {
  debut: Date;
  jours: Date[];
  segments: Segment[];
  /** Nombre de pistes occupées, pour dimensionner la semaine. */
  pistes: number;
};

const MS_JOUR = 86400000;

export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const parseISO = (s: string) => new Date(s + "T00:00:00Z");
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};

/** Lundi de la semaine contenant `d`. */
export function debutSemaine(d: Date): Date {
  const dow = d.getUTCDay();
  return addDays(d, dow === 0 ? -6 : 1 - dow);
}

/** Nombre de jours entre deux dates, bornes exclues au départ. */
export function ecartJours(a: Date, b: Date): number {
  return Math.round((+b - +a) / MS_JOUR);
}

/** Une absence couvre-t-elle au moins un jour de l'intervalle ? */
function intersecte(a: AbsenceMin, debut: Date, fin: Date): boolean {
  return (
    a.start_date <= iso(fin) && a.end_date >= iso(debut)
  );
}

/**
 * Répartit les segments d'une semaine en pistes.
 *
 * Glouton, du plus long au plus court : placer d'abord les segments longs
 * limite les « trous » et donne des barres plus stables d'une semaine à
 * l'autre, ce qui rend la lecture d'un mois plus facile.
 */
function repartirEnPistes(segments: Omit<Segment, "piste">[]): Segment[] {
  const tries = [...segments].sort((a, b) => {
    const longueurA = a.colEnd - a.colStart;
    const longueurB = b.colEnd - b.colStart;
    if (longueurB !== longueurA) return longueurB - longueurA;
    if (a.colStart !== b.colStart) return a.colStart - b.colStart;
    return a.absence.member_name.localeCompare(b.absence.member_name);
  });

  const pistes: { colStart: number; colEnd: number }[][] = [];
  const resultat: Segment[] = [];

  for (const s of tries) {
    let piste = 0;
    for (; ; piste++) {
      const occupee = pistes[piste] ?? (pistes[piste] = []);
      const collision = occupee.some(
        (o) => s.colStart <= o.colEnd && o.colStart <= s.colEnd
      );
      if (!collision) {
        occupee.push({ colStart: s.colStart, colEnd: s.colEnd });
        break;
      }
    }
    resultat.push({ ...s, piste });
  }

  return resultat;
}

/** Construit les barres de chaque semaine couverte par l'intervalle affiché. */
export function decouperEnSemaines(
  absences: AbsenceMin[],
  rangeStart: Date,
  rangeEnd: Date
): Semaine[] {
  const semaines: Semaine[] = [];

  for (let debut = debutSemaine(rangeStart); +debut <= +rangeEnd; debut = addDays(debut, 7)) {
    const fin = addDays(debut, 6);
    const jours = Array.from({ length: 7 }, (_, i) => addDays(debut, i));

    const brut = absences
      .filter((a) => intersecte(a, debut, fin))
      .map((a) => {
        const debutAbsence = parseISO(a.start_date);
        const finAbsence = parseISO(a.end_date);

        const colStart = Math.max(0, Math.min(6, ecartJours(debut, debutAbsence)));
        const colEnd = Math.max(0, Math.min(6, ecartJours(debut, finAbsence)));

        return {
          absence: a,
          colStart,
          colEnd: Math.max(colStart, colEnd),
          suiteAvant: +debutAbsence < +debut,
          suiteApres: +finAbsence > +fin,
        };
      });

    const segments = repartirEnPistes(brut);
    const pistes = segments.reduce((max, s) => Math.max(max, s.piste + 1), 0);

    semaines.push({ debut, jours, segments, pistes });
  }

  return semaines;
}

/** Teinte de fond d'une barre, à partir de la couleur du type de congé. */
export function fondBarre(couleur: string, opacite = 0.16): string {
  const h = couleur.replace("#", "");
  if (h.length !== 6) return "rgba(148, 163, 184, 0.16)";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacite})`;
}
