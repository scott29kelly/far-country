import type { Metadata } from "next";

import { WorldClient } from "@/lib/world/WorldClient";

export const metadata: Metadata = {
  title: "World — Far Country",
  description:
    "A navigable 3D placeholder of the inner New Jerusalem. Phase 3 MVP — walkable, not true scale.",
};

/**
 * /world entry. Thin server shell hosting the client-only WorldClient,
 * which in turn lazy-loads the R3F Scene (Canvas cannot SSR).
 */
export default function WorldPage() {
  return (
    <div className="-mx-6 -my-10">
      <WorldClient />
    </div>
  );
}
