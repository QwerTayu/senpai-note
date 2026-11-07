// data/demo/ の架空のデータを Firestore の sources に入れる（未処理の状態で）。
// --reset を付けると、知識カード・質問・計画・代なども消してやり直す。
// 使い方: npx tsx --env-file=.env.local scripts/seed.ts [--reset]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../src/lib/firebase";
import { generationOf, type SourceKind } from "../src/lib/types";

interface DemoSource {
  id: string;
  title: string;
  author: string;
  postedAt: string;
  body: string;
}

function load(kind: Exclude<SourceKind, "plan">): (DemoSource & { kind: SourceKind })[] {
  const items: DemoSource[] = JSON.parse(readFileSync(join(process.cwd(), "data/demo", `${kind}.json`), "utf8"));
  return items.map((s) => ({ ...s, kind }));
}

async function clear(name: string) {
  const db = firestore();
  const snap = await db.collection(name).get();
  for (const doc of snap.docs) await db.recursiveDelete(doc.ref);
  console.log(`${name}: ${snap.size}件を消しました`);
}

async function main() {
  const db = firestore();
  if (process.argv.includes("--reset")) {
    for (const name of ["cards", "questions", "senpaiQuestions", "sources", "planItems", "advice", "generations"]) await clear(name);
  }
  const sources = [...load("slack"), ...load("drive"), ...load("notion")];
  const batch = db.batch();
  for (const s of sources) {
    batch.set(db.collection("sources").doc(s.id), {
      kind: s.kind,
      title: s.title,
      author: s.author,
      postedAt: Timestamp.fromDate(new Date(s.postedAt)),
      url: `https://wakaba-fes.example/${s.kind}/${s.id}`,
      body: s.body,
      ingestedAt: null,
      generation: generationOf(s.postedAt),
    });
  }
  await batch.commit();
  console.log(`sources: ${sources.length}件を入れました`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
