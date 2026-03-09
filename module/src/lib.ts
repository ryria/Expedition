import { schema, table, t } from 'spacetimedb/server';

// ---------------------------------------------------------------------------
// Table definitions
// ---------------------------------------------------------------------------

export const activityLog = table(
  { name: 'activity_log', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    person_name: t.string(),
    activity_type: t.string(), // "run" | "row" | "walk" | "cycle"
    distance_km: t.f32(),
    note: t.string(),
    timestamp: t.timestamp(),
    ai_response: t.string(),
  }
);

export const reaction = table(
  { name: 'reaction', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    log_id: t.u64(),
    emoji: t.string(),
    reacted_by: t.string(),
    timestamp: t.timestamp(),
  }
);

export const comment = table(
  { name: 'comment', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    log_id: t.u64(),
    author: t.string(),
    body: t.string(),
    timestamp: t.timestamp(),
  }
);

// ---------------------------------------------------------------------------
// Schema + reducers
// ---------------------------------------------------------------------------

const spacetimedb = schema({ activityLog, reaction, comment });

export const log_activity = spacetimedb.reducer(
  'log_activity',
  {
    person_name: t.string(),
    activity_type: t.string(),
    distance_km: t.f32(),
    note: t.string(),
  },
  (ctx, { person_name, activity_type, distance_km, note }) => {
    if (!person_name.trim()) throw new Error('person_name is required');
    if (!['run', 'row', 'walk', 'cycle'].includes(activity_type)) {
      throw new Error(`Unknown activity_type: ${activity_type}`);
    }
    if (distance_km <= 0) throw new Error('distance_km must be positive');

    ctx.db.activityLog.insert({
      id: 0n, // auto-incremented
      person_name,
      activity_type,
      distance_km,
      note: note ?? '',
      timestamp: ctx.timestamp,
      ai_response: '',
    });
  }
);

export const add_reaction = spacetimedb.reducer(
  'add_reaction',
  {
    log_id: t.u64(),
    emoji: t.string(),
    reacted_by: t.string(),
  },
  (ctx, { log_id, emoji, reacted_by }) => {
    if (!reacted_by.trim()) throw new Error('reacted_by is required');
    ctx.db.reaction.insert({
      id: 0n,
      log_id,
      emoji,
      reacted_by,
      timestamp: ctx.timestamp,
    });
  }
);

export const add_comment = spacetimedb.reducer(
  'add_comment',
  {
    log_id: t.u64(),
    author: t.string(),
    body: t.string(),
  },
  (ctx, { log_id, author, body }) => {
    if (!author.trim()) throw new Error('author is required');
    if (!body.trim()) throw new Error('comment body cannot be empty');
    ctx.db.comment.insert({
      id: 0n,
      log_id,
      author,
      body,
      timestamp: ctx.timestamp,
    });
  }
);

// ---------------------------------------------------------------------------
// Procedure: call Claude and patch ai_response
// ---------------------------------------------------------------------------

const LANDMARKS = [
  { name: 'Sydney', km: 0, fact: 'Where the journey begins. The Harbour Bridge and Opera House mark the start line.' },
  { name: 'Brisbane', km: 1340, fact: "Queensland's capital. Gateway to the Great Barrier Reef and the tropical north." },
  { name: 'Cairns', km: 2120, fact: 'Tropical gateway to the Reef. Cassowaries roam the rainforest just behind the esplanade.' },
  { name: 'Darwin', km: 3200, fact: 'NT capital. Crocodiles in every waterway. Monsoonal lightning storms roll in each afternoon during the Wet.' },
  { name: 'Broome', km: 4700, fact: 'Famous for the Staircase to the Moon — full moon reflecting on tidal flats. Red pindan cliffs, turquoise sea.' },
  { name: 'Geraldton', km: 6060, fact: "The wreck of the Dutch vessel Batavia (1629) lies offshore — a story of mutiny and survival." },
  { name: 'Perth', km: 6720, fact: 'The most isolated major city on Earth. Closer to Singapore than to Sydney. Indian Ocean sunsets.' },
  { name: 'Albany', km: 8080, fact: "Australia's last whaling station closed here in 1978. Now a whale-watching mecca for Southern Rights and Humpbacks." },
  { name: 'Eucla', km: 9460, fact: "Population 50. The Nullarbor Plain. The world's longest straight road — 146 km without a bend." },
  { name: 'Adelaide', km: 11240, fact: 'City of Churches. The Barossa and McLaren Vale begin at the city\'s edge.' },
  { name: 'Melbourne', km: 12100, fact: "Australia's cultural capital. Laneways, coffee, street art. Claims most liveable city regularly." },
  { name: 'Eden', km: 12690, fact: 'Orcas and Humpbacks interact in Twofold Bay. The final stretch home begins.' },
  { name: 'Sydney', km: 14500, fact: 'Journey complete.' },
];

const TOTAL_KM = 14500;

function getLandmarkContext(totalKm: number): { last: typeof LANDMARKS[number]; next: typeof LANDMARKS[number]; kmToNext: number } {
  let last = LANDMARKS[0];
  let next = LANDMARKS[LANDMARKS.length - 1];

  for (let i = 0; i < LANDMARKS.length - 1; i++) {
    if (totalKm >= LANDMARKS[i].km) {
      last = LANDMARKS[i];
      next = LANDMARKS[i + 1];
    }
  }

  return { last, next, kmToNext: Math.max(0, next.km - totalKm) };
}

export const get_ai_response = spacetimedb.procedure(
  'get_ai_response',
  { log_id: t.u64() },
  t.string(),
  (ctx, { log_id }) => {
    const apiKey = process.env['ANTHROPIC_API_KEY'] ?? '';
    if (!apiKey) {
      return 'AI coach unavailable — API key not configured.';
    }

    // Fetch the target log entry
    const entry = ctx.db.activityLog.id.find(log_id);
    if (!entry) return 'Activity not found.';

    // Sum all activity km to compute total
    let totalKm = 0;
    for (const row of ctx.db.activityLog.iter()) {
      totalKm += row.distance_km;
    }

    const pct = ((totalKm / TOTAL_KM) * 100).toFixed(1);
    const { last, next, kmToNext } = getLandmarkContext(totalKm);

    const userMessage =
      `${entry.person_name} just logged ${entry.distance_km.toFixed(1)} km of ${entry.activity_type}.` +
      (entry.note ? ` Note: "${entry.note}"` : '') +
      `\nTeam total: ${totalKm.toFixed(1)} km (${pct}% of ${TOTAL_KM} km).` +
      `\nLast landmark: ${last.name} — ${last.fact}` +
      `\nNext landmark: ${next.name} in ${kmToNext.toFixed(0)} km.`;

    const body = JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 150,
      system:
        'You are the AI coach for The Expedition — three friends circumnavigating Australia together. ' +
        'Be short (2-3 sentences), specific to the location, and energetic without being cheesy.',
      messages: [{ role: 'user', content: userMessage }],
    });

    const response = ctx.http.fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body,
    });

    if (response.status !== 200) {
      return `Coach is taking a breather (HTTP ${response.status}).`;
    }

    let aiText = '';
    try {
      const parsed = JSON.parse(response.text()) as {
        content: Array<{ type: string; text: string }>;
      };
      aiText = parsed.content.find(c => c.type === 'text')?.text ?? '';
    } catch {
      return 'Coach response could not be parsed.';
    }

    // Patch the ai_response field back into the ActivityLog row
    ctx.db.activityLog.id.update({ ...entry, ai_response: aiText });

    return aiText;
  }
);

export default spacetimedb;
