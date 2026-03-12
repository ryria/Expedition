import { useMemo, useState } from "react";
import { Alert, Box, Button, MenuItem, Paper, TextField, Typography } from "@mui/material";
import { useSpacetimeDB, useTable } from "spacetimedb/react";
import { type DbConnection, tables } from "../../spacetime/generated";

interface PublicChallengeRow {
  id: bigint;
  slug: string;
  title: string;
  routeTargetKm: number;
  capacity: number;
  startEpoch: bigint;
  endEpoch: bigint;
  registrationClosesEpoch: bigint;
  status: string;
}

interface PublicChallengeParticipantRow {
  id: bigint;
  challengeId: bigint;
  memberId: bigint;
  completionState: string;
  totalDistanceKm: number;
  flagCount: number;
  isDisqualified: boolean;
}

interface ChallengeActivityLogRow {
  id: bigint;
  challengeId: bigint;
  memberId: bigint;
  activityType: string;
  distanceKm: number;
  durationMinutes: number;
  occurredAtEpoch: bigint;
  status: string;
  riskScore: number;
  flagsCsv: string;
}

interface MembershipRow {
  memberId: bigint;
  role: string;
  status: string;
  leftAt: unknown;
}

interface MemberRow {
  id: bigint;
  name: string;
}

interface ChallengeIntegrityEventRow {
  id: bigint;
  challengeId: bigint;
  challengeActivityLogId: bigint;
  memberId: bigint;
  riskScore: number;
  flagsCsv: string;
  action: string;
  reasonEnum: string;
}

interface OperationalCounterRow {
  key: string;
  operation: string;
  status: string;
  count: bigint;
  updatedAt: { toDate: () => Date };
}

interface Props {
  linkedMemberId: bigint | null;
}

type LeaderboardMode = "provisional" | "reviewed";

function formatEpoch(epoch: bigint): string {
  return new Date(Number(epoch) * 1000).toLocaleString();
}

function toSlug(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || `challenge-${Date.now()}`;
}

function toDateTimeInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function PublicChallengesPanel({ linkedMemberId }: Props) {
  const connectionState = useSpacetimeDB();
  const [challengeRows] = useTable(tables.public_challenge);
  const [participantRows] = useTable(tables.public_challenge_participant);
  const [logRows] = useTable(tables.challenge_activity_log);
  const [membershipRows] = useTable(tables.membership);
  const [memberRows] = useTable(tables.member);
  const [integrityRows] = useTable(tables.challenge_integrity_event);
  const [operationalCounterRows] = useTable(tables.operational_counter);

  const [activityType, setActivityType] = useState("run");
  const [distanceKm, setDistanceKm] = useState("5");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [note, setNote] = useState("");
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>("provisional");

  const defaultStart = useMemo(() => {
    const nextDay = new Date(Date.now() + 24 * 60 * 60 * 1000);
    nextDay.setSeconds(0, 0);
    return toDateTimeInputValue(nextDay);
  }, []);
  const [newChallengeTitle, setNewChallengeTitle] = useState("");
  const [newChallengeSlug, setNewChallengeSlug] = useState("");
  const [newChallengeRouteKm, setNewChallengeRouteKm] = useState("145");
  const [newChallengeCapacity, setNewChallengeCapacity] = useState("50");
  const [newChallengeStartAt, setNewChallengeStartAt] = useState(defaultStart);
  const [newChallengeDurationDays, setNewChallengeDurationDays] = useState("28");
  const [status, setStatus] = useState("");

  const challenges = useMemo(
    () => [...(challengeRows as readonly PublicChallengeRow[])].sort((a, b) => Number(a.startEpoch - b.startEpoch)),
    [challengeRows],
  );

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of memberRows as readonly MemberRow[]) {
      map.set(member.id.toString(), member.name);
    }
    return map;
  }, [memberRows]);

  const isChallengeAdmin = useMemo(() => {
    if (!linkedMemberId) return false;
    return (membershipRows as readonly MembershipRow[]).some(
      (row) =>
        row.memberId === linkedMemberId &&
        row.status.toLowerCase() === "active" &&
        (row.role === "owner" || row.role === "admin") &&
        row.leftAt == null,
    );
  }, [membershipRows, linkedMemberId]);

  const myParticipants = useMemo(() => {
    if (!linkedMemberId) return [];
    return (participantRows as readonly PublicChallengeParticipantRow[]).filter(
      (row) => row.memberId === linkedMemberId,
    );
  }, [participantRows, linkedMemberId]);

  const myParticipantByChallenge = useMemo(() => {
    const map = new Map<string, PublicChallengeParticipantRow>();
    for (const participant of myParticipants) {
      map.set(participant.challengeId.toString(), participant);
    }
    return map;
  }, [myParticipants]);

  const myChallengeLogs = useMemo(() => {
    if (!linkedMemberId) return [];
    return [...(logRows as readonly ChallengeActivityLogRow[])]
      .filter((row) => row.memberId === linkedMemberId)
      .sort((a, b) => Number(b.id - a.id))
      .slice(0, 10);
  }, [logRows, linkedMemberId]);

  const logsById = useMemo(() => {
    const map = new Map<string, ChallengeActivityLogRow>();
    for (const log of logRows as readonly ChallengeActivityLogRow[]) {
      map.set(log.id.toString(), log);
    }
    return map;
  }, [logRows]);

  const autoFlagEvents = useMemo(
    () => (integrityRows as readonly ChallengeIntegrityEventRow[]).filter((row) => row.action === "auto_flag"),
    [integrityRows],
  );

  const resolvedLogIds = useMemo(() => {
    const resolvedActions = new Set(["confirm", "exclude", "request_evidence"]);
    const ids = new Set<string>();
    for (const event of integrityRows as readonly ChallengeIntegrityEventRow[]) {
      if (resolvedActions.has(event.action)) {
        ids.add(event.challengeActivityLogId.toString());
      }
    }
    return ids;
  }, [integrityRows]);

  const pendingModerationEvents = useMemo(() => {
    return autoFlagEvents
      .filter((event) => !resolvedLogIds.has(event.challengeActivityLogId.toString()))
      .sort((a, b) => b.riskScore - a.riskScore);
  }, [autoFlagEvents, resolvedLogIds]);

  const monitorCounters = useMemo(() => {
    return [...(operationalCounterRows as readonly OperationalCounterRow[])]
      .filter((row) => row.operation.startsWith("public_challenge_monitor"))
      .sort((a, b) => a.operation.localeCompare(b.operation));
  }, [operationalCounterRows]);

  function withConnection(): DbConnection {
    const conn = connectionState.getConnection() as DbConnection | null;
    if (!conn) {
      throw new Error("SpacetimeDB not connected");
    }
    return conn;
  }

  function handleJoin(challengeId: bigint) {
    setStatus("");
    try {
      withConnection().reducers.joinPublicChallenge({ challengeId });
      setStatus("Joined challenge.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  function handleSubmitActivity(challengeId: bigint) {
    setStatus("");
    const parsedDistance = Number(distanceKm);
    const parsedDuration = Number(durationMinutes);
    if (!Number.isFinite(parsedDistance) || parsedDistance <= 0) {
      setStatus("Distance must be greater than 0.");
      return;
    }
    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      setStatus("Duration must be greater than 0.");
      return;
    }

    const occurredAtEpoch = BigInt(Math.floor(Date.now() / 1000));

    try {
      withConnection().reducers.submitChallengeActivity({
        challengeId,
        activityType,
        distanceKm: parsedDistance,
        durationMinutes: parsedDuration,
        occurredAtEpoch,
        note: note.trim(),
      });
      setStatus("Challenge activity submitted.");
      setNote("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  function handleCreateChallenge() {
    setStatus("");
    if (!isChallengeAdmin) {
      setStatus("Owner/admin role required to create challenges.");
      return;
    }

    const title = newChallengeTitle.trim();
    if (!title) {
      setStatus("Challenge title is required.");
      return;
    }

    const routeTargetKm = Number(newChallengeRouteKm);
    const capacity = Number(newChallengeCapacity);
    const durationDays = Number(newChallengeDurationDays);
    const startEpochMs = Date.parse(newChallengeStartAt);

    if (!Number.isFinite(routeTargetKm) || routeTargetKm <= 0) {
      setStatus("Route target must be greater than 0.");
      return;
    }
    if (!Number.isFinite(capacity) || capacity <= 0) {
      setStatus("Capacity must be greater than 0.");
      return;
    }
    if (!Number.isFinite(durationDays) || durationDays < 1) {
      setStatus("Duration days must be at least 1.");
      return;
    }
    if (!Number.isFinite(startEpochMs)) {
      setStatus("Start date is invalid.");
      return;
    }

    const startEpoch = BigInt(Math.floor(startEpochMs / 1000));
    const endEpoch = BigInt(Math.floor(startEpochMs / 1000) + durationDays * 24 * 60 * 60);
    const registrationClosesEpoch = startEpoch - 24n * 60n * 60n;
    const slug = toSlug(newChallengeSlug.trim() || title);

    try {
      withConnection().reducers.createPublicChallenge({
        slug,
        title,
        routeTargetKm,
        capacity,
        startEpoch,
        endEpoch,
        registrationClosesEpoch,
      });
      setStatus("Public challenge created.");
      setNewChallengeTitle("");
      setNewChallengeSlug("");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  function handleModerationAction(integrityEventId: bigint, action: "confirm" | "exclude" | "request_evidence") {
    setStatus("");
    try {
      withConnection().reducers.moderateIntegrityEvent({
        integrityEventId,
        action,
        reasonEnum: "manual_review",
      });
      setStatus(`Moderation action applied: ${action}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  function handleCloseChallenge(challengeId: bigint) {
    setStatus("");
    try {
      withConnection().reducers.closeChallengeStandings({ challengeId });
      setStatus("Challenge closeout requested.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  function handleRunMonitorNow() {
    setStatus("");
    try {
      withConnection().reducers.runPublicChallengeMonitorNow({});
      setStatus("Monitor run triggered.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }

  function leaderboardRowsForChallenge(challengeId: bigint, mode: LeaderboardMode) {
    const totals = new Map<string, { memberId: bigint; distanceKm: number }>();
    const logs = (logRows as readonly ChallengeActivityLogRow[]).filter((row) => row.challengeId === challengeId);

    const allowStatus = (status: string) => {
      if (mode === "provisional") {
        return status !== "excluded";
      }
      return status === "accepted" || status === "confirmed";
    };

    for (const log of logs) {
      if (!allowStatus(log.status)) continue;
      const key = log.memberId.toString();
      const existing = totals.get(key);
      if (existing) {
        existing.distanceKm += log.distanceKm;
      } else {
        totals.set(key, { memberId: log.memberId, distanceKm: log.distanceKm });
      }
    }

    return [...totals.values()].sort((a, b) => b.distanceKm - a.distanceKm).slice(0, 10);
  }

  if (!linkedMemberId) {
    return <Alert severity="info">Create your member profile first to join public challenges.</Alert>;
  }

  return (
    <div className="content-shell">
      <div className="stats-shell">
        <Paper className="dashboard-card" variant="outlined">
          <Typography variant="h6">Public Challenges</Typography>
          <Typography variant="body2" className="page-subtitle">
            28-day public routes with capped participation and integrity review.
          </Typography>
        </Paper>

        <Paper className="dashboard-card" variant="outlined">
          <Typography variant="h6">Monitor Health</Typography>
          {isChallengeAdmin && (
            <Box sx={{ mt: 1, mb: 1 }}>
              <Button size="small" variant="outlined" onClick={handleRunMonitorNow}>
                Run monitor now
              </Button>
            </Box>
          )}
          {monitorCounters.length === 0 ? (
            <Typography variant="body2" className="page-subtitle">
              No monitor telemetry yet.
            </Typography>
          ) : (
            monitorCounters.map((counter) => (
              <Typography key={counter.key} variant="body2">
                {counter.operation} ({counter.status}) — {counter.count.toString()} • {counter.updatedAt.toDate().toLocaleString()}
              </Typography>
            ))
          )}
        </Paper>

        {isChallengeAdmin && (
          <Paper className="dashboard-card" variant="outlined">
            <Typography variant="h6">Create Public Challenge</Typography>
            <Box sx={{ mt: 1.5, display: "flex", gap: 1, flexWrap: "wrap" }}>
              <TextField
                size="small"
                label="Title"
                value={newChallengeTitle}
                onChange={(e) => setNewChallengeTitle(e.target.value)}
                sx={{ minWidth: 220 }}
              />
              <TextField
                size="small"
                label="Slug (optional)"
                value={newChallengeSlug}
                onChange={(e) => setNewChallengeSlug(e.target.value)}
                sx={{ minWidth: 180 }}
              />
              <TextField
                size="small"
                type="number"
                label="Route km"
                value={newChallengeRouteKm}
                onChange={(e) => setNewChallengeRouteKm(e.target.value)}
                sx={{ minWidth: 130 }}
              />
              <TextField
                size="small"
                type="number"
                label="Capacity"
                value={newChallengeCapacity}
                onChange={(e) => setNewChallengeCapacity(e.target.value)}
                sx={{ minWidth: 120 }}
              />
              <TextField
                size="small"
                type="number"
                label="Duration days"
                value={newChallengeDurationDays}
                onChange={(e) => setNewChallengeDurationDays(e.target.value)}
                sx={{ minWidth: 140 }}
              />
              <TextField
                size="small"
                type="datetime-local"
                label="Start"
                value={newChallengeStartAt}
                onChange={(e) => setNewChallengeStartAt(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 220 }}
              />
              <Button variant="contained" onClick={handleCreateChallenge}>Create</Button>
            </Box>
          </Paper>
        )}

        <Paper className="dashboard-card" variant="outlined">
          <Typography variant="h6">Leaderboard Mode</Typography>
          <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
            <Button
              variant={leaderboardMode === "provisional" ? "contained" : "outlined"}
              onClick={() => setLeaderboardMode("provisional")}
            >
              Provisional
            </Button>
            <Button
              variant={leaderboardMode === "reviewed" ? "contained" : "outlined"}
              onClick={() => setLeaderboardMode("reviewed")}
            >
              Reviewed
            </Button>
          </Box>
        </Paper>

        {challenges.map((challenge) => {
          const participant = myParticipantByChallenge.get(challenge.id.toString()) ?? null;
          const completion = Math.min((participant?.totalDistanceKm ?? 0) / challenge.routeTargetKm, 1);
          const leaderboard = leaderboardRowsForChallenge(challenge.id, leaderboardMode);
          const canClose = Number(BigInt(Math.floor(Date.now() / 1000))) >= Number(challenge.endEpoch + 24n * 60n * 60n);
          return (
            <Paper key={challenge.id.toString()} className="dashboard-card" variant="outlined">
              <Typography variant="h6">{challenge.title}</Typography>
              <Typography variant="body2" className="page-subtitle">slug: {challenge.slug}</Typography>
              <Typography variant="body2">Window: {formatEpoch(challenge.startEpoch)} - {formatEpoch(challenge.endEpoch)}</Typography>
              <Typography variant="body2">Capacity: {challenge.capacity} • Status: {challenge.status}</Typography>
              <Typography variant="body2">Your progress: {(completion * 100).toFixed(1)}% ({(participant?.totalDistanceKm ?? 0).toFixed(1)} / {challenge.routeTargetKm.toFixed(1)} km)</Typography>
              <Typography variant="body2" className="page-subtitle" sx={{ mt: 0.75 }}>
                Top 10 ({leaderboardMode}):
              </Typography>
              {leaderboard.length === 0 ? (
                <Typography variant="body2" className="page-subtitle">No leaderboard data yet.</Typography>
              ) : (
                leaderboard.map((row, index) => (
                  <Typography key={`${challenge.id.toString()}:${row.memberId.toString()}`} variant="body2">
                    #{index + 1} {memberNameById.get(row.memberId.toString()) ?? `Member ${row.memberId.toString()}`} — {row.distanceKm.toFixed(1)} km
                  </Typography>
                ))
              )}
              {participant ? (
                <Box sx={{ mt: 1.5, display: "flex", gap: 1, flexWrap: "wrap" }}>
                  <TextField
                    select
                    size="small"
                    label="Type"
                    value={activityType}
                    onChange={(e) => setActivityType(e.target.value)}
                    sx={{ minWidth: 120 }}
                  >
                    <MenuItem value="run">Run</MenuItem>
                    <MenuItem value="walk">Walk</MenuItem>
                    <MenuItem value="cycle">Cycle</MenuItem>
                    <MenuItem value="row">Row</MenuItem>
                  </TextField>
                  <TextField
                    size="small"
                    type="number"
                    label="Distance km"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value)}
                    sx={{ minWidth: 130 }}
                  />
                  <TextField
                    size="small"
                    type="number"
                    label="Duration min"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    sx={{ minWidth: 130 }}
                  />
                  <TextField
                    size="small"
                    label="Note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    sx={{ minWidth: 220 }}
                  />
                  <Button variant="contained" onClick={() => handleSubmitActivity(challenge.id)}>
                    Submit
                  </Button>
                </Box>
              ) : (
                <Button variant="contained" onClick={() => handleJoin(challenge.id)} sx={{ mt: 1.5 }}>
                  Join challenge
                </Button>
              )}
              {isChallengeAdmin && challenge.status !== "closed" && canClose && (
                <Button variant="outlined" sx={{ mt: 1.5 }} onClick={() => handleCloseChallenge(challenge.id)}>
                  Close standings
                </Button>
              )}
            </Paper>
          );
        })}

        {isChallengeAdmin && (
          <Paper className="dashboard-card" variant="outlined">
            <Typography variant="h6">Integrity Review Queue</Typography>
            {pendingModerationEvents.length === 0 ? (
              <Typography variant="body2" className="page-subtitle">No pending flagged logs.</Typography>
            ) : (
              pendingModerationEvents.map((event) => {
                const log = logsById.get(event.challengeActivityLogId.toString());
                const challenge = challenges.find((c) => c.id === event.challengeId);
                return (
                  <Box key={event.id.toString()} sx={{ mt: 1.2, p: 1.2, border: "1px solid var(--border)", borderRadius: 1 }}>
                    <Typography variant="body2">
                      {challenge?.title ?? `Challenge ${event.challengeId.toString()}`} •
                      {" "}{memberNameById.get(event.memberId.toString()) ?? `Member ${event.memberId.toString()}`} • risk {event.riskScore}
                    </Typography>
                    {log && (
                      <Typography variant="body2" className="page-subtitle">
                        {log.activityType} {log.distanceKm.toFixed(1)} km / {log.durationMinutes.toFixed(0)} min • {log.flagsCsv || event.flagsCsv}
                      </Typography>
                    )}
                    <Box sx={{ mt: 0.8, display: "flex", gap: 1, flexWrap: "wrap" }}>
                      <Button size="small" variant="contained" onClick={() => handleModerationAction(event.id, "confirm")}>Confirm</Button>
                      <Button size="small" variant="outlined" color="warning" onClick={() => handleModerationAction(event.id, "request_evidence")}>Request evidence</Button>
                      <Button size="small" variant="outlined" color="error" onClick={() => handleModerationAction(event.id, "exclude")}>Exclude</Button>
                    </Box>
                  </Box>
                );
              })
            )}
          </Paper>
        )}

        <Paper className="dashboard-card" variant="outlined">
          <Typography variant="h6">Recent Challenge Logs</Typography>
          {myChallengeLogs.length === 0 ? (
            <Typography variant="body2" className="page-subtitle">No challenge logs yet.</Typography>
          ) : (
            myChallengeLogs.map((log) => (
              <Typography key={log.id.toString()} variant="body2">
                {log.activityType} • {log.distanceKm.toFixed(1)} km / {log.durationMinutes.toFixed(0)} min • {log.status}
                {log.flagsCsv ? ` (${log.flagsCsv})` : ""}
              </Typography>
            ))
          )}
        </Paper>

        {status && (
          <Alert severity={status.includes("submitted") || status.includes("Joined") ? "success" : "info"}>
            {status}
          </Alert>
        )}
      </div>
    </div>
  );
}
