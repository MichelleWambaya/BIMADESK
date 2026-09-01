import React, { useState } from "react";
import { useApp } from "@/data/appStore";
import { DocumentOwnerType } from "@/types";

export function NoteQuickForm({ ownerType, ownerId, onDone }: { ownerType: DocumentOwnerType; ownerId: string; onDone: () => void }) {
  const store = useApp();
  const [body, setBody] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    store.addNote(ownerType, ownerId, body.trim());
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <textarea
        className="wb-input"
        rows={4}
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Quick note…"
      />
      <div className="flex justify-end gap-2">
        <button type="submit" className="wb-btn-primary">Save note</button>
      </div>
    </form>
  );
}
