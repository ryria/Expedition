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

interface Props {
  linkedMemberId: bigint | null;
}

function formatEpoch(epoch: bigint): string {
  return new Date(Number(epoch) * 1000).toLocaleString();
}

export function PublicChallengesPanel({ linkedMemberId }: Props) {
  const connectionState = useSpacetimeDB();
  const [challengeRows] = useTable(tables.public_challenge);
  const [participantRows] = useTable(tables.public_challenge_participant);
  const [logRows] = useTable(tables.challenge_activity_log);

  const [activityType, setActivityType] = useState("run");
  const [distanceKm, setDistanceKm] = useState("5");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");

  const challenges = useMemo(
    () => [...(challengeRows as readonly PublicChallengeRow[])].sort((a, b) => Number(a.startEpoch - b.startEpoch)),
    [challengeRows],
  );

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

        {challenges.map((challenge) => {
          const participant = myParticipantByChallenge.get(challenge.id.toString()) ?? null;
          const completion = Math.min((participant?.totalDistanceKm ?? 0) / challenge.routeTargetKm, 1);
          return (
            <Paper key={challenge.id.toString()} className="dashboard-card" variant="outlined">
              <Typography variant="h6">{challenge.title}</Typography>
              <Typography variant="body2" className="page-subtitle">slug: {challenge.slug}</Typography>
              <Typography variant="body2">Window: {formatEpoch(challenge.startEpoch)} - {formatEpoch(challenge.endEpoch)}</Typography>
              <Typography variant="body2">Capacity: {challenge.capacity} • Status: {challenge.status}</Typography>
              <Typography variant="body2">Your progress: {(completion * 100).toFixed(1)}% ({(participant?.totalDistanceKm ?? 0).toFixed(1)} / {challenge.routeTargetKm.toFixed(1)} km)</Typography>
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
            </Paper>
          );
        })}

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
