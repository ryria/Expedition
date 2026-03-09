import { useState } from "react";
import { useComments } from "../../hooks/useComments";
import { getConnection } from "../../spacetime/connection";

interface Props { logId: bigint; }

export function CommentThread({ logId }: Props) {
  const { commentsFor } = useComments();
  const [open, setOpen] = useState(false);
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const comments = commentsFor(logId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!author.trim() || !body.trim()) return;
    getConnection().reducers.addComment({ logId, author: author.trim(), body: body.trim() });
    setBody("");
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
              <span className="comment-ts">{new Date(c.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
          <form onSubmit={handleSubmit} className="comment-form">
            <input value={author} onChange={(e) => setAuthor(e.target.value)}
              placeholder="Your name" maxLength={30} />
            <input value={body} onChange={(e) => setBody(e.target.value)}
              placeholder="Add a comment" maxLength={300} />
            <button type="submit">Post</button>
          </form>
        </>
      )}
    </div>
  );
}
