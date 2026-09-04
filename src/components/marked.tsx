/**
 * Renders marked text ("… a [[softmax]] …") as prose with clickable terms.
 * Clicking a term opens its pane to the right of `fromIndex` (-1 = the article).
 */
import { useReader, useStore } from "@/hooks";
import { scopedId, segments, strip } from "@/sdk";

export function Marked({ text, fromIndex = -1, context }: { text: string; fromIndex?: number; context?: string }) {
  const reader = useReader();
  const docId = useStore((s) => s.session.docId);
  const concepts = useStore((s) => s.library.concepts);

  const segs = segments(text, {
    labelFor: (id) => concepts[id]?.label,
    idFor: (term) => (docId ? scopedId(docId, term) : term),
  });
  const ctx = context ?? strip(text, (id) => concepts[id]?.label);

  return (
    <>
      {segs.map((sg, i) =>
        sg.kind === "text" ? (
          <span key={i}>{sg.text}</span>
        ) : (
          <span
            key={i}
            className="rh-term"
            onClick={() => reader.openConcept({ conceptId: sg.conceptId, label: sg.label, fromIndex, context: ctx })}
          >
            {sg.text}
          </span>
        ),
      )}
    </>
  );
}
