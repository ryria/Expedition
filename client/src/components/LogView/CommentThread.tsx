import { useState } from "react";
import { useAuth } from "react-oidc-context";
import { useComments } from "../../hooks/useComments";
import { useMembers } from "../../hooks/useMembers";
import { getConnection } from "../../spacetime/connection";

interface Props { logId: bigint; }

export function CommentThread({ logId }: Props) {
  const auth = useAuth();
  const { members } = useMembers();
  const { commentsFor } = useComments();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const comments = commentsFor(logId);
  const sub = auth.user?.profile?.sub as string | undefined;
  const linkedMember = members.find((m) => sub != null && m.ownerSub === sub) ?? null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!linkedMember || !body.trim()) return;
    setError("");
    try {
      getConnection().reducers.addComment({
        logId,
        author: linkedMember.name,
        body: body.trim(),
      });
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="comment-thread">
      <button className="toggle-comments" onClick={() => setOpen((o) => !o)}>
        {comments.length} comment{comments.length !== 1 ? "s" : ""} {open ? "▲" : "▼"}
      </button>
      {open && (
        <>
          {comments.map((c) => (
            <div key={String(c.id)} className="comment">
              <strong>{c.author}</strong>: {c.body}
              <span className="comment-ts">{c.timestamp.toDate().toLocaleTimeString()}</span>
            </div>
          ))}
          <form onSubmit={handleSubmit} className="comment-form">
            <input value={body} onChange={(e) => setBody(e.target.value)}
              placeholder={linkedMember ? "Add a comment" : "Create your member profile to comment"}
              maxLength={300}
              disabled={!linkedMember}
            />
            <button type="submit" disabled={!linkedMember || !body.trim()}>Post</button>
          </form>
          {error && <p className="field-error">{error}</p>}
        </>
      )}
    </div>
  );
}
