"use client";

/**
 * Zeigt an, von wann der ausgelieferte Build stammt.
 *
 * Bei Docker steckt der Build im Image; ein "git pull" allein ändert nichts.
 * Ohne diese Angabe lässt sich von aussen kaum erkennen, ob nach einem Update
 * tatsächlich der neue Stand läuft.
 */
export default function BuildStamp() {
  const raw = process.env.NEXT_PUBLIC_BUILD_TIME;
  if (!raw) return null;

  const built = new Date(raw);
  if (Number.isNaN(built.getTime())) return null;

  const commit = process.env.NEXT_PUBLIC_COMMIT;

  return (
    <span title={`Build: ${raw}${commit ? ` · Commit ${commit}` : ""}`}>
      Stand:{" "}
      <time dateTime={raw}>
        {built.toLocaleString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </time>
      {commit && ` · ${commit}`}
    </span>
  );
}
