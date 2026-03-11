import { useMembers } from "../../hooks/useMembers";
import { Avatar, List, ListItem, ListItemAvatar, ListItemText, Paper, Typography } from "@mui/material";
import "./MembersPanel.css";

interface MembersPanelProps {
  activeExpeditionId: bigint;
}

export function MembersPanel({ activeExpeditionId }: MembersPanelProps) {
  const { members } = useMembers(activeExpeditionId);

  return (
    <Paper className="members-panel" variant="outlined">
      <Typography variant="h6" gutterBottom>
        Current Expedition Members
      </Typography>

      {!members.length && (
        <Typography className="members-empty">No members yet. Add yourself in Settings.</Typography>
      )}

      <List className="member-list" disablePadding>
        {members.map((m) => (
          <ListItem key={String(m.id)} className="member-row" disableGutters>
            <ListItemAvatar>
              <Avatar className="swatch" sx={{ bgcolor: m.colorHex }}>
                {m.name.slice(0, 1).toUpperCase()}
              </Avatar>
            </ListItemAvatar>
            <ListItemText primary={m.name} className="member-name" />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}
